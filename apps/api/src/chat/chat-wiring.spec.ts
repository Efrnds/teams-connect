import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const API_SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB_APP = resolve(API_SRC, '../../web/src/app/app/page.tsx');

/** Garante que o PR entrega wiring ponta a ponta (não só lógica isolada). */
describe('u2u wiring no repositório', () => {
  it('AppModule importa ChatModule', () => {
    const src = readFileSync(resolve(API_SRC, 'app.module.ts'), 'utf8');
    expect(src).toContain('ChatModule');
  });

  it('web /app renderiza ChatShell (botão Ligar)', () => {
    const page = readFileSync(WEB_APP, 'utf8');
    expect(page).toContain('ChatShell');
  });

  it('gateway declara handlers call:accept/cancel/end', () => {
    const gw = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'chat.gateway.ts'), 'utf8');
    expect(gw).toContain("@SubscribeMessage('call:accept')");
    expect(gw).toContain("@SubscribeMessage('call:cancel')");
    expect(gw).toContain("@SubscribeMessage('call:end')");
    expect(gw).toContain('requireAuth');
  });
});