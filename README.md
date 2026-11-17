# teams-texsa

Monorepo Texsa com `apps/api` (NestJS + Prisma) e `apps/web` (Next.js).

## Desenvolvimento local

Consulte `apps/api/README.md` e `apps/web/README.md`. Postgres/Redis de desenvolvimento: `deploy/compose/docker-compose.yaml`.

## CI/CD

- **CI** (`.github/workflows/ci.yml`): typecheck, lint, test e build em `apps/api` e `apps/web` em PRs e `main`.
- **CD** (`.github/workflows/deploy.yml`): runner self-hosted na rede Texsa; ver `deploy/README.md`.

## Produção (Docker Compose)

```bash
cp deploy/compose/.env.prod.example deploy/compose/.env
docker compose -f deploy/compose/docker-compose.prod.yml --env-file deploy/compose/.env up --build -d
```