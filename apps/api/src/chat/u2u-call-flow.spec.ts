import { describe, expect, it } from 'vitest';
import {
  assertSignalingFromPeer,
  messageAfterInviteAck,
  messageForEndedReason,
  messageForMediaError,
  shouldRejectIncomingWhileBusy,
  shouldStartRingingAfterInvite,
} from '../../../web/src/lib/u2u-call-flow.js';

describe('u2u-call-flow (web client)', () => {
  it('só inicia ringing após ack ok', () => {
    expect(shouldStartRingingAfterInvite({ ok: true })).toBe(true);
    expect(shouldStartRingingAfterInvite({ ok: false, error: 'offline' })).toBe(false);
  });

  it('mapeia erros de invite', () => {
    expect(messageAfterInviteAck({ ok: false, error: 'offline' })).toBe(
      'Usuário indisponível.',
    );
    expect(messageAfterInviteAck({ ok: false, error: 'busy' })).toBe('Contato ocupado.');
  });

  it('mapeia encerramento', () => {
    expect(messageForEndedReason('ring_timeout')).toBe('Sem resposta.');
    expect(messageForEndedReason('active_timeout')).toContain('tempo limite');
  });

  it('rejeita incoming quando já em chamada', () => {
    expect(shouldRejectIncomingWhileBusy('idle')).toBe(false);
    expect(shouldRejectIncomingWhileBusy('incoming')).toBe(true);
    expect(shouldRejectIncomingWhileBusy('active')).toBe(true);
  });

  it('valida remetente de sinalização WebRTC', () => {
    expect(assertSignalingFromPeer('2', '2')).toBe(true);
    expect(assertSignalingFromPeer('2', '9')).toBe(false);
    expect(assertSignalingFromPeer(undefined, '9')).toBe(false);
    expect(assertSignalingFromPeer('2', undefined)).toBe(false);
  });

  it('mapeia erro de microfone', () => {
    expect(
      messageForMediaError(new DOMException('blocked', 'NotAllowedError')),
    ).toContain('bloqueado');
  });
});