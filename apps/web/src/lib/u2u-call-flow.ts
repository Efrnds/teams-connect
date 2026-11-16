export type InviteAck = { ok?: boolean; error?: string } | undefined;

export type ClientCallPhase = 'idle' | 'incoming' | 'outgoing' | 'connecting' | 'active';

/** Callee ocupa: rejeita invite automático se já há outra chamada local. */
export function shouldRejectIncomingWhileBusy(phase: ClientCallPhase): boolean {
  return phase !== 'idle';
}

/** Bloqueia SDP/ICE se o servidor rotular remetente diferente do peer esperado. */
export function assertSignalingFromPeer(
  expectedPeerUserId: string | undefined,
  fromUserId: string | undefined,
): boolean {
  if (!expectedPeerUserId || !fromUserId) return true;
  return fromUserId === expectedPeerUserId;
}

/** Só entra em "Chamando…" após o servidor aceitar o invite. */
export function shouldStartRingingAfterInvite(ack: InviteAck): boolean {
  return ack?.ok === true;
}

export function messageAfterInviteAck(ack: InviteAck): string | null {
  if (ack?.ok) return null;
  switch (ack?.error) {
    case 'busy':
      return 'Contato ocupado.';
    case 'offline':
      return 'Usuário indisponível.';
    case 'self_call':
      return 'Não é possível ligar para você mesmo.';
    case 'rate_limited':
      return 'Muitas tentativas. Aguarde um instante.';
    default:
      return ack?.error ? 'Não foi possível iniciar a chamada.' : null;
  }
}

export function messageForEndedReason(reason?: string): string | undefined {
  if (reason === 'peer_disconnected') return 'A outra parte desconectou.';
  if (reason === 'ring_timeout') return 'Sem resposta.';
  if (reason === 'active_timeout') return 'Chamada encerrada por tempo limite no servidor.';
  return undefined;
}

export function messageForMediaError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return 'Microfone bloqueado. Permita o acesso nas configurações do navegador.';
    }
    if (err.name === 'NotFoundError') {
      return 'Nenhum microfone encontrado neste dispositivo.';
    }
  }
  return 'Não foi possível acessar o microfone.';
}