'use client';

import { useEffect, useRef } from 'react';

/** Tom de chamada recebida (Web Audio API, sem arquivo externo). */
export function useCallRingtone(active: boolean) {
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!active) {
      stopRef.current?.();
      stopRef.current = null;
      return;
    }
    if (typeof window === 'undefined') return;

    const ctx = new AudioContext();
    let pulseTimer: ReturnType<typeof setInterval> | null = null;

    const playPulse = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.08;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime;
      osc.start(t);
      osc.stop(t + 0.35);
    };

    playPulse();
    pulseTimer = setInterval(playPulse, 1600);

    stopRef.current = () => {
      if (pulseTimer) clearInterval(pulseTimer);
      void ctx.close();
    };

    return () => {
      stopRef.current?.();
      stopRef.current = null;
    };
  }, [active]);
}