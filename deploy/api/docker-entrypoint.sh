#!/bin/sh
set -eu

cd /app

echo "[api] applying prisma migrations..."
pnpm exec prisma migrate deploy

echo "[api] starting application..."
exec "$@"