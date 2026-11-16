'use client';

import type { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import type { CallPeer, CallPhase } from '@/lib/call-events';

type Props = {
  phase: CallPhase;
  peer: CallPeer | null;
  statusMessage: string | null;
  remoteAudioRef: RefObject<HTMLAudioElement | null>;
  onAccept: () => void;
  onReject: () => void;
  onCancel: () => void;
  onHangUp: () => void;
};

function phaseLabel(phase: CallPhase): string {
  switch (phase) {
    case 'outgoing':
      return 'Chamando…';
    case 'incoming':
      return 'Chamada recebida';
    case 'connecting':
      return 'Conectando áudio…';
    case 'active':
      return 'Em chamada';
    default:
      return '';
  }
}

export function CallOverlay({
  phase,
  peer,
  statusMessage,
  remoteAudioRef,
  onAccept,
  onReject,
  onCancel,
  onHangUp,
}: Props) {
  if (phase === 'idle' && !statusMessage) return null;

  const showPanel = phase !== 'idle';
  const label = phaseLabel(phase);

  return (
    <>
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      {(showPanel || statusMessage) && (
        <div className="border-b border-border bg-card px-4 py-3">
          {showPanel && peer && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{peer.displayName}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {phase === 'incoming' && (
                  <>
                    <Button size="sm" onClick={onAccept}>
                      Atender
                    </Button>
                    <Button size="sm" variant="secondary" onClick={onReject}>
                      Recusar
                    </Button>
                  </>
                )}
                {phase === 'outgoing' && (
                  <Button size="sm" variant="secondary" onClick={onCancel}>
                    Cancelar
                  </Button>
                )}
                {(phase === 'active' || phase === 'connecting') && (
                  <Button size="sm" variant="destructive" onClick={onHangUp}>
                    Encerrar
                  </Button>
                )}
              </div>
            </div>
          )}
          {statusMessage && (
            <p className="mt-2 text-xs text-muted-foreground">{statusMessage}</p>
          )}
        </div>
      )}
    </>
  );
}