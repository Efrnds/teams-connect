import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const API_SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API_ROOT = resolve(API_SRC, '..');
const WEB_ROOT = resolve(API_SRC, '../../web');
const WEB_APP = resolve(WEB_ROOT, 'src/app/app/page.tsx');
const WEB_HOME = resolve(WEB_ROOT, 'src/app/page.tsx');
const WEB_LOGIN = resolve(WEB_ROOT, 'src/app/login/page.tsx');

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

  it('package.json da API inclui WebSocket (compila com gateway)', () => {
    const pkg = readFileSync(resolve(API_ROOT, 'package.json'), 'utf8');
    expect(pkg).toContain('@nestjs/websockets');
    expect(pkg).toContain('socket.io');
  });

  it('web inclui socket.io-client e componentes ui (build Next)', () => {
    const pkg = readFileSync(resolve(WEB_ROOT, 'package.json'), 'utf8');
    expect(pkg).toContain('socket.io-client');
    expect(pkg).toContain('vitest');
    const button = resolve(WEB_ROOT, 'src/components/ui/button.tsx');
    expect(readFileSync(button, 'utf8')).toContain('Button');
  });

  it('web expõe /login e home redireciona para /app ou /login', () => {
    const login = readFileSync(WEB_LOGIN, 'utf8');
    expect(login.length).toBeGreaterThan(20);
    const home = readFileSync(WEB_HOME, 'utf8');
    expect(home).toMatch(/\/app|\/login/);
  });

  it('gateway declara handlers call:accept/cancel/end', () => {
    const gw = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'chat.gateway.ts'), 'utf8');
    expect(gw).toContain("@SubscribeMessage('call:accept')");
    expect(gw).toContain("@SubscribeMessage('call:cancel')");
    expect(gw).toContain("@SubscribeMessage('call:end')");
    expect(gw).toContain('requireAuth');
  });
});