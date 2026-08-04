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
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
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