#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = resolve(root, 'apps/api');
const webDir = resolve(root, 'apps/web');

function run(cmd, args, cwd, { optional = false } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit', env: process.env, shell: false });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0 || optional) resolvePromise();
      else reject(new Error(`${cmd} exit ${code}`));
    });
  });
}

async function ensureApiEnv() {
  const envPath = resolve(apiDir, '.env');
  const examplePath = resolve(apiDir, '.env.example');
  if (!existsSync(envPath) && existsSync(examplePath)) {
    copyFileSync(examplePath, envPath);
    console.log('Criado apps/api/.env a partir de .env.example.');
  }
}

async function bootstrap() {
  await run('pnpm', ['install'], apiDir);
  await run('pnpm', ['install'], webDir);
  await ensureApiEnv();
  await run('pnpm', ['exec', 'prisma', 'generate'], apiDir);
  await run('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], apiDir, { optional: true });
  await run('pnpm', ['run', 'seed'], apiDir, { optional: true });
}

const children = [];

function startApps() {
  const api = spawn('pnpm', ['run', 'start:dev'], { cwd: apiDir, stdio: 'inherit', env: process.env });
  const web = spawn('pnpm', ['run', 'dev'], {
    cwd: webDir,
    stdio: 'inherit',
    env: { ...process.env, NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000' },
  });
  children.push(api, web);
  const shutdown = () => {
    for (const c of children) {
      try {
        c.kill('SIGTERM');
      } catch {
        // ignore
      }
    }
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

try {
  console.log('Texsa — preparando API + web…');
  await bootstrap();
  console.log('\nAPI http://localhost:4000 | Web http://localhost:3000/app\n');
  startApps();
} catch (err) {
  console.error(err?.message ?? err);
  process.exit(1);
}