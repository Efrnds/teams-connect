'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getToken() ? '/app' : '/login');
  }, [router]);

  return (
    <main className="grid min-h-dvh place-items-center text-muted-foreground">
      Abrindo Texsa Chat...
    </main>
  );
}
