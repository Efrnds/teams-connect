# Texsa

Monorepo: `apps/api` + `apps/web`.

## Subir tudo

```bash
pnpm dev
```

Na raiz (pnpm). API `:4000`, web `/app` com chat e ligação u2u. Ver `apps/api/.env.example`.

## Testes (CI / local)

```bash
cd apps/api && pnpm exec prisma generate && pnpm test -- src/chat
cd apps/web && pnpm test
```

**QA manual (áudio real):** dois browsers, roteiro em [`apps/web/README.md`](apps/web/README.md).