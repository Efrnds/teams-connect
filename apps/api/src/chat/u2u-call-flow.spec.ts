import { describe, expect, it } from 'vitest';
import {
  messageAfterInviteAck,
  messageForEndedReason,
  messageForMediaError,
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
  });

  it('mapeia erro de microfone', () => {
    expect(
      messageForMediaError(new DOMException('blocked', 'NotAllowedError')),
    ).toContain('bloqueado');
  });
});