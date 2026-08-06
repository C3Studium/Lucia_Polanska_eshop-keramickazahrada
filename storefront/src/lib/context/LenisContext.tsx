"use client";
import { useEffect, useRef } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

export default function LenisProvider({ children }: { children: React.ReactNode }) {
  const rafId = useRef<number | null>(null);
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    // Reduced-motion visitors get the browser's own scrolling: smooth-scroll hijacking is
    // exactly the kind of motion the preference asks us to drop.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const lenis = new Lenis({
      /*
       * Lerp rather than duration+easing.
       *
       * The previous config paired duration: 1.2 with an expo-out curve, which sounds slow but
       * is the opposite: that curve covers half the distance in 120ms and three quarters in
       * 240ms, spending its remaining second travelling the last 3%. The glide was over before
       * it could be seen, so the page read as if it were scrolling natively — and every
       * scroll-linked animation inherited that abruptness.
       *
       * Lerp eases toward the target by a fraction of the remaining distance each frame, so the
       * motion keeps a visible tail for as long as there is distance left, and a second wheel
       * tick blends into the first instead of restarting a tween.
       */
      /* 0.06 puts roughly 90% of the travel in the first 620ms with a tail past a second —
         slow enough to read as a glide rather than a jump. 0.085 measured only 40ms slower
         than the old curve, which was not a perceptible difference. */
      lerp: 0.06,
      smoothWheel: true,
      /*
       * Touch scrolling stays native. Momentum on a phone is the operating system's to own —
       * intercepting it fights the platform's own physics and feels worse, not better.
       */
      syncTouch: false,
      // A wheel notch should still move roughly what the OS intends.
      wheelMultiplier: 1,
      touchMultiplier: 1.6,
    });
    lenisRef.current = lenis;

    // Expose globally for scroll links
    window.lenis = lenis;

    function raf(time: number) {
      lenis.raf(time);
      rafId.current = requestAnimationFrame(raf);
    }

    rafId.current = requestAnimationFrame(raf);

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      lenis.destroy();

      delete window.lenis;
    };
  }, []);

  // The 3-second scroll lock that used to live here is gone (spec §8.3). It called
  // lenis.stop(), which preventDefault()s wheel and touch, while keyboard scrolling still
  // worked and then snapped back — the site read as frozen for the first three seconds.
  // The intro still plays: `firstLoad` in StateContext continues to drive the hero's timing,
  // it just no longer holds the page still.

  return <>{children}</>;
}
