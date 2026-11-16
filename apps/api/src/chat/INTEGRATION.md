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

Após o import, reinicie a API e confirme conexão WebSocket em `/chat` com token JWT.