# Integração do ChatModule (obrigatória para u2u)

Este diretório entrega `ChatGateway` (Socket.IO `/chat`) e `GET /api/chat/ice-servers`.
**Sem importar `ChatModule` no `AppModule`, nenhum evento `call:*` é exposto.**

## Alteração em `apps/api/src/app.module.ts` (fora do escopo travado deste PR)

```typescript
import { ChatModule } from './chat/chat.module.js';

@Module({
  imports: [
    // … módulos existentes (Config, Auth, Channels, …)
    ChatModule,
  ],
  // …
})
export class AppModule {}
```

Pré-requisitos: `ChannelsModule` (join de canais), JWT configurado, dependências `socket.io` /
`@nestjs/websockets` no `package.json` da API (stack Texsa completa).

### Callee conhecido

O gateway só aceita `call:invite` para `calleeUserId` presente em `CallKnownUsersRegistry`
(usuário que já conectou em `/chat` com JWT válido neste processo). Em produção com diretório
`GET /users`, você pode estender o registry na inicialização da API para incluir todos os IDs
válidos do diretório (fora deste PR).

### TTL de chamada ativa

Sessões em `active` são encerradas após `CALL_SIGNAL_LIMITS.activeTtlMs` (1h) para não
manter o contato como ocupado para sempre.

Após o import, reinicie a API e confirme conexão WebSocket em `/chat` com token JWT.