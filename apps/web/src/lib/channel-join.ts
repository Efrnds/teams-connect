import type { Socket } from 'socket.io-client';

/**
 * Garante join na sala do canal só depois do socket estar conectado.
 * Evita race: emit channel:join antes do server autenticar o socket.
 */
export function bindChannelJoin(
  socket: Socket,
  getChannelId: () => string | null,
) {
  const join = () => {
    const channelId = getChannelId();
    if (!channelId) return;
    socket.emit('channel:join', { channelId });
  };

  socket.on('connect', join);

  return {
    /** Chamar quando o channelId ativo mudar. */
    sync(channelId: string | null) {
      if (!channelId) return;
      if (socket.connected) {
        socket.emit('channel:join', { channelId });
      }
    },
    dispose() {
      socket.off('connect', join);
    },
  };
}
