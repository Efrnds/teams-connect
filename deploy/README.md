# Deploy Texsa (self-hosted + Docker Compose)

Este guia cobre o runner GitHub Actions na rede interna da Texsa, o arquivo `.env` de produção e o stack `docker compose` com Postgres, Redis, API e Web.

## Pré-requisitos no servidor Linux

- Docker Engine 24+ com plugin **Compose v2** (`docker compose version`)
- Git
- Usuário dedicado (ex.: `texsa`) com permissão no grupo `docker`
- Portas liberadas na LAN: `3000` (Web), `4000` (API), ou as portas definidas no `.env`

## 1. Checkout de produção

```bash
sudo mkdir -p /opt/teams-texsa
sudo chown "$USER":"$USER" /opt/teams-texsa
git clone <url-do-repositorio> /opt/teams-texsa
cd /opt/teams-texsa
```

## 2. Variáveis de produção

```bash
cp deploy/compose/.env.prod.example deploy/compose/.env
$EDITOR deploy/compose/.env
```

Ajuste principalmente:

| Variável | Uso |
|----------|-----|
| `NEXT_PUBLIC_API_URL` | URL **LAN** da API (ex.: `http://192.168.1.50:4000`) — usada no build do Next |
| `CORS_ORIGIN` | Origem do browser (ex.: `http://192.168.1.50:3000`) |
| `JWT_ACCESS_SECRET` | Segredo forte (≥ 32 caracteres) |
| `POSTGRES_*` / `REDIS_PASSWORD` | Credenciais dos containers |

> Chat e WebSocket só funcionam fora do `localhost` quando `NEXT_PUBLIC_API_URL` e `CORS_ORIGIN` apontam para o host acessível pelos clientes na rede.

A imagem da API inclui o CLI do **Prisma** em dependências de produção para o entrypoint rodar `prisma migrate deploy` antes de subir o Nest.

## 3. Subir manualmente (validação)

```bash
docker compose -f deploy/compose/docker-compose.prod.yml --env-file deploy/compose/.env up --build -d
curl -fsS http://localhost:4000/api/health
curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:3000/
```

## 4. Registrar runner self-hosted (systemd)

No servidor, como o usuário do deploy:

```bash
mkdir -p ~/actions-runner && cd ~/actions-runner
curl -o actions-runner-linux-x64.tar.gz -L https://github.com/actions/runner/releases/download/v2.321.0/actions-runner-linux-x64-2.321.0.tar.gz
tar xzf ./actions-runner-linux-x64.tar.gz
./config.sh --url https://github.com/<org>/<repo> --token <TOKEN_GITHUB>
```

Crie o serviço systemd (`/etc/systemd/system/github-runner-texsa.service`):

```ini
[Unit]
Description=GitHub Actions Runner Texsa
After=network.target docker.service
Requires=docker.service

[Service]
User=texsa
WorkingDirectory=/home/texsa/actions-runner
ExecStart=/home/texsa/actions-runner/run.sh
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now github-runner-texsa
```

## 5. Habilitar CD no GitHub

1. Em **Settings → Actions → General**, permita workflows.
2. Em **Settings → Secrets and variables → Actions → Variables**:
   - `ENABLE_SELF_HOSTED_CD` = `true` (quando o runner estiver pronto)
   - `DEPLOY_PATH` = `/opt/teams-texsa` (opcional; padrão do workflow)
3. O workflow **Deploy (self-hosted)** dispara após CI verde em `main`, ou manualmente via **workflow_dispatch**.

## 6. Rollback

O script `deploy/scripts/cd-deploy.sh` grava o último SHA bem-sucedido em `/opt/teams-texsa/.deploy/last-good-sha`. Se o smoke check falhar após `docker compose up --build`, o job faz checkout do SHA anterior e recria os containers.

Logs úteis:

```bash
docker compose -f deploy/compose/docker-compose.prod.yml --env-file deploy/compose/.env logs -f api web
journalctl -u github-runner-texsa -f
```

## 7. Smoke checks do CD

- API: `GET /api/health` (porta `4000` por padrão)
- Web: HTTP `200` em `/` (ajuste `SMOKE_WEB_URL` no script se a rota pública mudar)

## CI

O workflow `.github/workflows/ci.yml` roda em PRs e pushes em `main`: install com lockfile congelado, `prisma generate`, typecheck, lint, testes e build por app (`apps/api`, `apps/web`).