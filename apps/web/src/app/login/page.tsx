'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { setSession } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('admin@texsa.local');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('texsa123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result =
        mode === 'login'
          ? await api.login(email, password)
          : await api.register(email, name || email.split('@')[0], password);
      setSession(result.accessToken, result.user);
      router.push('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <Card className="w-full max-w-md border-border shadow-[4px_4px_0_#1c1917]">
        <CardHeader>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-copper">
            Texsa
          </p>
          <CardTitle className="text-3xl">Texsa Chat</CardTitle>
          <CardDescription>
            Entre com a conta interna. Dados vêm do Postgres.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {mode === 'register' && (
              <label className="block space-y-1.5 text-sm">
                <span className="text-muted-foreground">Nome</span>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </label>
            )}
            <label className="block space-y-1.5 text-sm">
              <span className="text-muted-foreground">Email</span>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-muted-foreground">Senha</span>
              <Input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
              />
            </label>

            {error && (
              <p className="border border-copper/40 bg-copper/10 px-3 py-2 text-sm">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? 'Aguarde...'
                : mode === 'login'
                  ? 'Entrar no Chat'
                  : 'Criar conta'}
            </Button>
          </form>

          <button
            type="button"
            className="mt-4 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            onClick={() =>
              setMode((m) => (m === 'login' ? 'register' : 'login'))
            }
          >
            {mode === 'login'
              ? 'Não tem conta? Registrar'
              : 'Já tem conta? Entrar'}
          </button>
        </CardContent>
      </Card>
    </main>
  );
}
