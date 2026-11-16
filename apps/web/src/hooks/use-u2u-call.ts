'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { resolveIceServers } from '@/lib/ice-servers';
import type { CallPeer, CallPhase } from '@/lib/call-events';
import {
  assertSignalingFromPeer,
  messageAfterInviteAck,
  messageForEndedReason,
  messageForMediaError,
  shouldRejectIncomingWhileBusy,
  shouldStartRingingAfterInvite,
} from '@/lib/u2u-call-flow';
import { useCallRingtone } from '@/hooks/use-call-ringtone';

type Options = {
  socket: Socket | null;
  selfUserId: string | null;
  authToken: string | null;
  resolveDisplayName: (userId: string) => string;
  ringTimeoutMs?: number;
};

function newCallId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `call-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useU2uCall({
  socket,
  selfUserId,
  authToken,
  resolveDisplayName,
  ringTimeoutMs = 45_000,
}: Options) {
  const [phase, setPhase] = useState<CallPhase>('idle');
  const [callId, setCallId] = useState<string | null>(null);
  const [peer, setPeer] = useState<CallPeer | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callIdRef = useRef<string | null>(null);
  const isCallerRef = useRef(false);
  const phaseRef = useRef<CallPhase>(phase);
  const peerRef = useRef(peer);

  callIdRef.current = callId;
  phaseRef.current = phase;
  peerRef.current = peer;

  useCallRingtone(phase === 'incoming');

  const clearRingTimer = useCallback(() => {
    if (ringTimerRef.current) {
      clearTimeout(ringTimerRef.current);
      ringTimerRef.current = null;
    }
  }, []);

  const teardownMedia = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  }, []);

  const resetCall = useCallback(
    (message?: string) => {
      clearRingTimer();
      teardownMedia();
      setCallId(null);
      setPeer(null);
      setPhase('idle');
      setStatusMessage(message ?? null);
      isCallerRef.current = false;
    },
    [clearRingTimer, teardownMedia],
  );

  const ensurePeerConnection = useCallback(async () => {
    if (pcRef.current) return pcRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;
    const iceServers = await resolveIceServers(authToken);
    const pc = new RTCPeerConnection({ iceServers });
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteAudioRef.current && remoteStream) {
        remoteAudioRef.current.srcObject = remoteStream;
        void remoteAudioRef.current.play().catch(() => undefined);
      }
    };
    pc.onicecandidate = (event) => {
      const id = callIdRef.current;
      if (!socket || !id) return;
      socket.emit('call:ice', {
        callId: id,
        candidate: event.candidate
          ? {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
            }
          : null,
      });
    };
    pcRef.current = pc;
    return pc;
  }, [authToken, socket]);

  const failMedia = useCallback(
    (err: unknown) => {
      const id = callIdRef.current;
      if (socket && id) {
        socket.emit('call:end', { callId: id });
      }
      resetCall(messageForMediaError(err));
    },
    [resetCall, socket],
  );

  const startOffer = useCallback(async () => {
    if (!socket || !callIdRef.current) return;
    setPhase('connecting');
    try {
      const pc = await ensurePeerConnection();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('call:offer', { callId: callIdRef.current, sdp: offer });
    } catch (err) {
      failMedia(err);
    }
  }, [ensurePeerConnection, failMedia, socket]);

  const hangUp = useCallback(() => {
    const id = callIdRef.current;
    if (socket && id) {
      socket.emit('call:end', { callId: id });
    }
    resetCall();
  }, [resetCall, socket]);

  const startCall = useCallback(
    (calleeUserId: string) => {
      if (!socket || !selfUserId) return;
      if (calleeUserId === selfUserId) {
        setStatusMessage('Não é possível ligar para você mesmo.');
        return;
      }
      if (phase !== 'idle') return;
      const id = newCallId();
      isCallerRef.current = true;
      callIdRef.current = id;
      setPeer({
        userId: calleeUserId,
        displayName: resolveDisplayName(calleeUserId),
      });
      setPhase('idle');
      setStatusMessage('Verificando disponibilidade…');
      socket.emit(
        'call:invite',
        { callId: id, calleeUserId },
        (ack?: { ok?: boolean; error?: string }) => {
          if (callIdRef.current !== id) return;
          if (!shouldStartRingingAfterInvite(ack)) {
            const msg = messageAfterInviteAck(ack);
            resetCall(msg ?? undefined);
            return;
          }
          setCallId(id);
          setPhase('outgoing');
          setStatusMessage(null);
          clearRingTimer();
          ringTimerRef.current = setTimeout(() => {
            if (callIdRef.current === id) {
              socket.emit('call:cancel', { callId: id });
              resetCall('Sem resposta.');
            }
          }, ringTimeoutMs);
        },
      );
    },
    [clearRingTimer, phase, resetCall, resolveDisplayName, ringTimeoutMs, selfUserId, socket],
  );

  const acceptCall = useCallback(async () => {
    if (!socket || !callIdRef.current) return;
    clearRingTimer();
    setPhase('connecting');
    try {
      await ensurePeerConnection();
      socket.emit('call:accept', { callId: callIdRef.current });
    } catch (err) {
      const id = callIdRef.current;
      if (socket && id) {
        socket.emit('call:reject', { callId: id });
      }
      resetCall(messageForMediaError(err));
    }
  }, [clearRingTimer, ensurePeerConnection, resetCall, socket]);

  const rejectCall = useCallback(() => {
    const id = callIdRef.current;
    if (socket && id) {
      socket.emit('call:reject', { callId: id });
    }
    resetCall();
  }, [resetCall, socket]);

  const cancelOutgoing = useCallback(() => {
    const id = callIdRef.current;
    if (socket && id) {
      socket.emit('call:cancel', { callId: id });
    }
    resetCall();
  }, [resetCall, socket]);

  useEffect(() => {
    if (!socket) return;

    const onIncoming = (payload: { callId: string; callerUserId: string }) => {
      if (shouldRejectIncomingWhileBusy(phaseRef.current)) {
        socket.emit('call:reject', { callId: payload.callId });
        return;
      }
      setCallId(payload.callId);
      callIdRef.current = payload.callId;
      isCallerRef.current = false;
      setPeer({
        userId: payload.callerUserId,
        displayName: resolveDisplayName(payload.callerUserId),
      });
      setPhase('incoming');
      setStatusMessage(null);
    };

    const onAccepted = async (payload: { callId: string }) => {
      if (callIdRef.current !== payload.callId || !isCallerRef.current) return;
      clearRingTimer();
      void startOffer();
    };

    const onRejected = (payload: { callId: string }) => {
      if (callIdRef.current !== payload.callId) return;
      resetCall('Chamada recusada.');
    };

    const onCancelled = (payload: { callId: string }) => {
      if (callIdRef.current !== payload.callId) return;
      resetCall();
    };

    const onEnded = (payload: { callId: string; reason?: string }) => {
      if (callIdRef.current !== payload.callId) return;
      resetCall(messageForEndedReason(payload.reason));
    };

    const onUnavailable = (payload: { callId: string }) => {
      if (callIdRef.current !== payload.callId) return;
      clearRingTimer();
      resetCall('Usuário indisponível.');
    };

    const onBusy = (payload: { callId: string }) => {
      if (callIdRef.current !== payload.callId) return;
      clearRingTimer();
      resetCall('Contato ocupado.');
    };

    const onOffer = async (payload: {
      callId: string;
      sdp: RTCSessionDescriptionInit;
      fromUserId?: string;
    }) => {
      if (callIdRef.current !== payload.callId) return;
      if (!assertSignalingFromPeer(peerRef.current?.userId, payload.fromUserId)) return;
      try {
        const pc = await ensurePeerConnection();
        await pc.setRemoteDescription(payload.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('call:answer', { callId: payload.callId, sdp: answer });
        setPhase('active');
      } catch (err) {
        const id = callIdRef.current;
        if (socket && id) {
          socket.emit('call:end', { callId: id });
        }
        resetCall(messageForMediaError(err));
      }
    };

    const onAnswer = async (payload: {
      callId: string;
      sdp: RTCSessionDescriptionInit;
      fromUserId?: string;
    }) => {
      if (callIdRef.current !== payload.callId || !pcRef.current) return;
      if (!assertSignalingFromPeer(peerRef.current?.userId, payload.fromUserId)) return;
      try {
        await pcRef.current.setRemoteDescription(payload.sdp);
        setPhase('active');
      } catch (err) {
        failMedia(err);
      }
    };

    const onIce = async (payload: {
      callId: string;
      candidate: RTCIceCandidateInit | null;
      fromUserId?: string;
    }) => {
      if (callIdRef.current !== payload.callId || !pcRef.current || !payload.candidate) return;
      if (!assertSignalingFromPeer(peerRef.current?.userId, payload.fromUserId)) return;
      try {
        await pcRef.current.addIceCandidate(payload.candidate);
      } catch {
        // candidato tardio ou duplicado
      }
    };

    socket.on('call:incoming', onIncoming);
    socket.on('call:accepted', onAccepted);
    socket.on('call:rejected', onRejected);
    socket.on('call:cancelled', onCancelled);
    socket.on('call:ended', onEnded);
    socket.on('call:unavailable', onUnavailable);
    socket.on('call:busy', onBusy);
    socket.on('call:offer', onOffer);
    socket.on('call:answer', onAnswer);
    socket.on('call:ice', onIce);

    return () => {
      socket.off('call:incoming', onIncoming);
      socket.off('call:accepted', onAccepted);
      socket.off('call:rejected', onRejected);
      socket.off('call:cancelled', onCancelled);
      socket.off('call:ended', onEnded);
      socket.off('call:unavailable', onUnavailable);
      socket.off('call:busy', onBusy);
      socket.off('call:offer', onOffer);
      socket.off('call:answer', onAnswer);
      socket.off('call:ice', onIce);
    };
  }, [
    clearRingTimer,
    ensurePeerConnection,
    resetCall,
    resolveDisplayName,
    socket,
    failMedia,
    startOffer,
  ]);

  useEffect(() => {
    return () => {
      clearRingTimer();
      teardownMedia();
    };
  }, [clearRingTimer, teardownMedia]);

  return {
    phase,
    peer,
    statusMessage,
    remoteAudioRef,
    startCall,
    acceptCall,
    rejectCall,
    cancelOutgoing,
    hangUp,
    resetCall,
  };
}