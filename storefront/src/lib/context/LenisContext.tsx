"use client";
import { useEffect, useRef } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

export default function LenisProvider({ children }: { children: React.ReactNode }) {
  const rafId = useRef<number | null>(null);
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    // The reduced-motion early return is switched off for now, with the other two layers —
    // see lib/context/MotionPreferenceProvider.tsx. It read:
    //
    //   if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    //
    // Smooth-scroll hijacking is exactly the kind of motion that preference asks us to drop, so
    // this is the first thing to restore when the proper mechanism lands.

    // Touch devices skip Lenis entirely, and lose nothing by it.
    //
    // Without `syncTouch` — which is not set, deliberately — Lenis does not smooth touch
    // scrolling at all; the finger drives the native scroller exactly as it would on any other
    // site. What it does do on a phone is keep a requestAnimationFrame loop running for the
    // lifetime of the page, calling raf() on every frame to animate nothing. That is a frame
    // callback per frame, on a battery, for no visible return.
    //
    // Anchor navigation still works: scrollWithLenis (lib/helpers) checks for `window.lenis`
    // and falls back to a native scrollTo with `behavior: "smooth"`, honouring the same
    // scroll-margin-top offset. The legal pages' chapter index is the main caller and behaves
    // identically either way.
    if (window.matchMedia("(hover: none) and (pointer: coarse)").matches) {
      return
    }

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      lerp: 0.8,
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1,
      autoRaf: false,
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
      // The rAF is cancelled as well as the instance destroyed: without it the loop keeps
      // calling raf() on a destroyed Lenis after unmount.
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
