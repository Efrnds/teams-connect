import { describe, expect, it } from 'vitest';
import { isValidCallId } from './call-signaling-limits.js';

describe('isValidCallId', () => {
  it('aceita UUID v4', () => {
    expect(isValidCallId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('rejeita id curto arbitrário', () => {
    expect(isValidCallId('call-1')).toBe(false);
    expect(isValidCallId('c1')).toBe(false);
  });
});