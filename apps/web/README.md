This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Chamadas de voz (WebRTC / ICE)

### Como subir (Texsa + u2u)

1. **API:** `cd apps/api && pnpm install && pnpm exec prisma migrate deploy && pnpm start:dev` — o `AppModule` já importa `ChatModule` (Socket.IO `/chat`).
2. **Web:** `cd apps/web && pnpm install && pnpm dev` — a home redireciona para `/app` (`ChatShell` com **Ligar**).
3. Variáveis: `JWT_ACCESS_SECRET`, `NEXT_PUBLIC_API_URL=http://localhost:4000`, ICE opcional (tabela abaixo).

Detalhes técnicos extras: [`apps/api/src/chat/INTEGRATION.md`](../api/src/chat/INTEGRATION.md).

**Segredos:** não versionar `.env` com senhas (`deploy/compose/.env` no repositório deve usar só variáveis locais não commitadas; rotacionar credenciais expostas).

### Redes diferentes (NAT, firewall, VPN)

| Cenário | Configuração |
| --- | --- |
| Dois PCs na mesma LAN / rede aberta | STUN público (`NEXT_PUBLIC_ICE_STUN_URLS`) costuma bastar. |
| Um lado atrás de NAT simétrico, firewall corporativo ou 4G | Provável precisar de **TURN** na API (`ICE_TURN_URLS` + `ICE_TURN_REST_SECRET` em produção). |
| Só um browser conecta / áudio mudo | Verificar permissão de microfone; testar com TURN; conferir `NEXT_PUBLIC_API_URL` acessível dos dois clientes. |

O hook `use-u2u-call` busca ICE via JWT antes de abrir `RTCPeerConnection`.

STUN público pode ser definido no cliente (`NEXT_PUBLIC_ICE_STUN_URLS`, vírgula). Se omitido, usa `stun:stun.l.google.com:19302`.

**TURN e credenciais não vão no bundle do browser.** Com JWT válido, o cliente chama `GET /api/chat/ice-servers` na API e recebe STUN/TURN de variáveis **somente no servidor**:

| Variável (API) | Descrição |
| --- | --- |
| `ICE_STUN_URLS` | STUN opcional no servidor (vírgula). |
| `ICE_TURN_URLS` | URLs TURN (vírgula). |
| `ICE_TURN_REST_SECRET` | **Produção:** segredo coturn REST; gera credencial efêmera por usuário (`ICE_TURN_CREDENTIAL_TTL_SEC`, padrão 3600). |
| `ICE_TURN_USERNAME` | Fallback dev: usuário TURN estático (evitar em produção). |
| `ICE_TURN_CREDENTIAL` | Fallback dev: senha estática. |

O endpoint ICE é limitado a **6 requisições/minuto por usuário** autenticado.

Exemplo mínimo (somente STUN no cliente):

```env
NEXT_PUBLIC_ICE_STUN_URLS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
```

Exemplo com TURN na API (rede restritiva; credencial não exposta no front):

```env
# apps/api — .env do backend
ICE_STUN_URLS=stun:stun.l.google.com:19302
ICE_TURN_URLS=turn:turn.example.com:3478?transport=udp
ICE_TURN_USERNAME=seu_usuario
ICE_TURN_CREDENTIAL=sua_senha
```

A montagem fica em `src/lib/ice-servers.ts` (`resolveIceServers`) e no hook `use-u2u-call`.

Use credenciais TURN **dedicadas** ao Texsa (não reutilize senhas de admin do servidor TURN). Qualquer usuário autenticado pode obter o bloco ICE via JWT — trate vazamento como comprometimento: **revogue e rotacione** `ICE_TURN_*` no backend.

### Testes automatizados (cliente)

Lógica de UI/estado do invite (`src/lib/u2u-call-flow.ts`):

```bash
cd apps/web && pnpm test
```

Sinalização no servidor (sem importar o web): `cd apps/api && pnpm test -- src/chat`.

### Checklist manual — áudio bidirecional (critério 3)

Com API e web no ar e **dois usuários** (dois browsers ou anônimo + normal):

1. A em **Pessoas** ou DM → **Ligar** para B: B vê incoming; A fica em **Chamando…** só após o servidor aceitar o invite.
2. B **Atender**: o app envia aceite ao servidor **antes** de abrir o microfone (ICE só após sessão `active`); fala audível nos dois lados; UI **Em chamada**.
3. A **Encerrar**: ambos voltam ao chat; LED de microfone apagado nos dois.
4. B **Recusar** numa nova tentativa: A vê recusa, sem captura de áudio ativa.
5. B offline/aba fechada: A vê **Usuário indisponível** sem ficar em chamando.
6. Chat normal (mensagens/canais) sem chamada ativa: envio/leitura segue funcionando.

**CI não exercita microfone nem áudio WebRTC** — só testes unitários de sinalização/fluxo de UI. O áudio bidirecional exige este checklist manual.

### Registro de teste manual (PR #1)

**Data:** 2026-11-16 · **Responsável:** implementação factory (validação de áudio = QA humano obrigatório)

| # | Passo | Resultado |
| --- | --- | --- |
| 1 | A liga para B online; B vê incoming **com som** (só callee toca) | pass (lógica + UI) / **áudio ao vivo: pendente QA** |
| 2 | B atende; áudio bidirecional audível | **pendente QA** (não automatizável no CI) |
| 3 | A encerra; mic liberado nos dois | pass (teardown no hook) / **áudio: pendente QA** |
| 4 | B recusa; sem mídia ativa | pass (testes + fluxo UI) |
| 5 | B sem socket `/chat` ou ID fora do diretório; A vê indisponível | pass (testes + `UsersService`) |
| 6 | Chat normal sem regressão | **pendente QA** |
| 7 | Microfone negado; mensagem clara | pass (`messageForMediaError` + teste) |

**Status 2026-11-17:** API+web compilam; `ChatModule` no `AppModule`; `/app` → `ChatShell`. **Itens 2–3 (áudio bidirecional)** exigem QA humano com duas contas (comando rápido abaixo). CI não substitui microfone.

**Roteiro QA (2 contas, ~5 min):** subir API+web → login A em browser normal e B em anônimo → ambos em `/app` → A liga B → B atende → falar nos dois lados → A encerra → repetir com B recusando.

**Várias réplicas da API:** sessões de chamada ficam em memória por processo; use **sticky WebSocket** no load balancer ou uma réplica até haver store compartilhado.

### Escala / múltiplas instâncias da API

Sessões de chamada e rate limits vivem **na memória de cada processo**. Com mais de uma réplica, use **sticky session** no Socket.IO ou trate u2u como feature single-node até haver store compartilhado (fora deste escopo).

### TURN em produção

Com `NODE_ENV=production`, **TURN estático não é devolvido** — configure `ICE_TURN_REST_SECRET` (coturn REST) para credenciais efêmeras por usuário.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
