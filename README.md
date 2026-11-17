# Texsa

Monorepo: `apps/api` (NestJS + Prisma) + `apps/web` (Next.js).

## Subir tudo (desenvolvimento)

```bash
pnpm dev
```

Na raiz com **pnpm** (não use só `npm install` dentro de `apps/api`).  
API `:4000`, browser em **http://localhost:3000** → redireciona para `/login` ou **`/app`**.  
Config: `apps/api/.env.example` e STUN/TURN em `apps/web/README.md`.

Postgres/Redis de desenvolvimento: `deploy/compose/docker-compose.yaml`.

## Testes (CI / local)

```bash
cd apps/api && pnpm exec prisma generate && pnpm test -- src/chat
cd apps/web && pnpm test
```

**QA manual (áudio u2u):** dois browsers — roteiro em [`apps/web/README.md`](apps/web/README.md).

## CI/CD

- **CI** (`.github/workflows/ci.yml`): typecheck, lint, test e build em `apps/api` e `apps/web` em PRs e `main`.
- **CD** (`.github/workflows/deploy.yml`): runner self-hosted na rede Texsa; ver [`deploy/README.md`](deploy/README.md).

## Produção (Docker Compose)

```bash
cp deploy/compose/.env.prod.example deploy/compose/.env
docker compose -f deploy/compose/docker-compose.prod.yml --env-file deploy/compose/.env up --build -d
```