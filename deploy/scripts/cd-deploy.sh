#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/teams-texsa}"
COMPOSE_FILE="${COMPOSE_FILE:-deploy/compose/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-deploy/compose/.env}"
SHA_BEFORE=""
ROLLBACK_LOG="${DEPLOY_PATH}/.deploy/last-good-sha"

record_sha() {
  mkdir -p "$(dirname "$ROLLBACK_LOG")"
  git -C "$DEPLOY_PATH" rev-parse HEAD >"$ROLLBACK_LOG" 2>/dev/null || true
}

if [[ -f "$ROLLBACK_LOG" ]]; then
  SHA_BEFORE="$(cat "$ROLLBACK_LOG")"
fi

log() {
  echo "[deploy] $*"
}

rollback() {
  if [[ -z "$SHA_BEFORE" ]]; then
    log "rollback skipped: no previous good SHA recorded"
    return 1
  fi
  log "rolling back to $SHA_BEFORE"
  git -C "$DEPLOY_PATH" fetch --all --prune
  git -C "$DEPLOY_PATH" checkout "$SHA_BEFORE"
  git -C "$DEPLOY_PATH" reset --hard "$SHA_BEFORE"
  docker compose -f "$DEPLOY_PATH/$COMPOSE_FILE" --env-file "$DEPLOY_PATH/$ENV_FILE" up -d --build --remove-orphans
}

smoke() {
  local api_url="${SMOKE_API_HEALTH_URL:-http://127.0.0.1:4000/api/health}"
  local web_url="${SMOKE_WEB_URL:-http://127.0.0.1:3000/}"

  log "smoke: API $api_url"
  curl -fsS "$api_url" >/dev/null

  log "smoke: Web $web_url"
  local code
  code="$(curl -fsS -o /dev/null -w '%{http_code}' "$web_url")"
  if [[ "$code" != "200" ]]; then
    log "web smoke failed with HTTP $code"
    return 1
  fi
}

main() {
  if [[ ! -d "$DEPLOY_PATH/.git" ]]; then
    log "ERROR: $DEPLOY_PATH is not a git checkout"
    exit 1
  fi
  if [[ ! -f "$DEPLOY_PATH/$ENV_FILE" ]]; then
    log "ERROR: missing $DEPLOY_PATH/$ENV_FILE (copy from deploy/compose/.env.prod.example)"
    exit 1
  fi

  local target="${DEPLOY_REF:-main}"
  log "updating code in $DEPLOY_PATH (target=$target)"
  git -C "$DEPLOY_PATH" fetch --all --prune
  if git -C "$DEPLOY_PATH" rev-parse --verify "${target}^{commit}" >/dev/null 2>&1; then
    git -C "$DEPLOY_PATH" checkout "$target"
    git -C "$DEPLOY_PATH" reset --hard "$target"
  else
    git -C "$DEPLOY_PATH" checkout main
    git -C "$DEPLOY_PATH" pull --ff-only origin main
  fi

  log "building and starting docker compose"
  if ! docker compose -f "$DEPLOY_PATH/$COMPOSE_FILE" --env-file "$DEPLOY_PATH/$ENV_FILE" up -d --build --remove-orphans; then
    log "compose up failed"
    rollback || true
    exit 1
  fi

  if ! smoke; then
    log "smoke checks failed — executing rollback"
    rollback || true
    exit 1
  fi

  record_sha
  log "deploy finished successfully"
}

main "$@"