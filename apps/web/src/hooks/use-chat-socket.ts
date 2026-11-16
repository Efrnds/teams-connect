'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Message } from '@/lib/api';
import { bindChannelJoin } from '@/lib/channel-join';

const WS_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type Options = {
  token: string | null;
  channelId: string | null;
  onMessage: (message: Message) => void;
  onTyping?: (payload: {
    channelId: string;
    userId: string;
    typing: boolean;
  }) => void;
};

export function useChatSocket({
  token,
  channelId,
  onMessage,
  onTyping,
}: Options) {
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const binderRef = useRef<ReturnType<typeof bindChannelJoin> | null>(null);
  const channelIdRef = useRef<string | null>(channelId);
  const onMessageRef = useRef(onMessage);
  const onTypingRef = useRef(onTyping);
  channelIdRef.current = channelId;
  onMessageRef.current = onMessage;
  onTypingRef.current = onTyping;

  useEffect(() => {
    if (!token) return;
    const socket = io(`${WS_URL}/chat`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;
    setSocket(socket);

    const binder = bindChannelJoin(socket, () => channelIdRef.current);
    binderRef.current = binder;
    binder.sync(channelIdRef.current);

    socket.on('message:new', (message: Message) => {
      onMessageRef.current(message);
    });

    socket.on(
      'typing:update',
      (payload: { channelId: string; userId: string; typing: boolean }) => {
        onTypingRef.current?.(payload);
      },
    );

    return () => {
      binder.dispose();
      binderRef.current = null;
      socket.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [token]);

  useEffect(() => {
    binderRef.current?.sync(channelId);
  }, [channelId, token]);

  return {
    socket,
    getSocket: () => socketRef.current,
    typingStart: (id: string) =>
      socketRef.current?.emit('typing:start', { channelId: id }),
    typingStop: (id: string) =>
      socketRef.current?.emit('typing:stop', { channelId: id }),
  };
}
