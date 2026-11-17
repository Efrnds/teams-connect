# Ligação u2u — integração Nest + web

Este PR **inclui** o wiring completo (não é passo manual pós-merge):

- **API:** `apps/api/src/app.module.ts` importa `ChatModule` (Socket.IO `/chat`, `GET /api/chat/ice-servers`).
- **Web:** `apps/web/src/app/app/page.tsx` renderiza `ChatShell` (Pessoas/DM, **Ligar**, overlay atender/recusar, WebRTC).
- **Stack:** Auth, Users, Channels, Messages, Prisma, `socket.io` / `@nestjs/websockets`.

Subir: ver `apps/web/README.md` (API `:4000`, web `:3000`, `JWT_ACCESS_SECRET`, `NEXT_PUBLIC_API_URL`).

## Sinalização (`call:*`)

| Evento | Quem | Estado |
| --- | --- | --- |
| `call:invite` | caller | cria `ringing`, JWT + callee no diretório + online |
| `call:accept` | callee | `evaluateAccept` → `active`; SDP/ICE liberados |
| `call:reject` / `call:cancel` | callee / caller | só `ringing` |
| `call:end` | participante | encerra `active` ou `ringing` |

Cada evento passa por `requireAuth` (JWT revalidado no socket).

## Callee no diretório

`call:invite` exige usuário em `GET /users` **e** socket em `/chat`. Quem só fez login HTTP mas não abriu `/app` aparece indisponível (offline no Socket.IO).

## TTL

Ringing e active têm TTL em memória (`CALL_SIGNAL_LIMITS`). Várias réplicas da API exigem sticky WebSocket ou store compartilhado.