# Texsa

Monorepo: `apps/api` + `apps/web`.

## Subir tudo (pós-merge, sem passo manual)

```bash
pnpm dev
```

Na raiz com **pnpm** (não use só `npm install` dentro de `apps/api`).  
API `:4000`, browser em **http://localhost:3000** → redireciona para `/login` ou **`/app`** (`ChatShell`, botão **Ligar**).  
Config: `apps/api/.env.example` e STUN/TURN em `apps/web/README.md`.

**Áudio entre duas pessoas:** dois browsers (ou anônimo) — roteiro no README do web; o CI não testa microfone.

## Testes (CI / local)

```bash
cd apps/api && pnpm exec prisma generate && pnpm test -- src/chat
cd apps/web && pnpm test
```

**QA manual (áudio real):** dois browsers, roteiro em [`apps/web/README.md`](apps/web/README.md).