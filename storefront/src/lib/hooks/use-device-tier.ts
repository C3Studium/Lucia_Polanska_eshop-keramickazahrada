"use client"

import { useEffect, useState } from "react"

/**
 * What the device can actually do, as opposed to how wide its window is.
 *
 * Width cannot answer either question this returns. A 1024px viewport is a tablet or a desktop
 * window; a 932px one is a phone lying on its side. Both need different animation from a laptop
 * at the same width, and only these queries can tell them apart.
 *
 * Mirrors the `touch` / `fine-pointer` / `reduced-motion` mixins in styles/system/_mixins.scss,
 * so CSS and JS branch on the same facts.
 */
export type DeviceTier = {
  /** No hover, coarse pointer. Mouse-driven animation must not run. */
  isTouch: boolean
  /** Small touch screen: the quality budget for anything GPU-bound is much lower. */
  isPhone: boolean
  /** The OS motion preference. */
  reducedMotion: boolean
}

const QUERIES = {
  touch: "(hover: none) and (pointer: coarse)",
  /* A phone on its side is 932px wide and 430px tall: wide enough to clear a width-only test,
     and still a phone. Matches the `phs` stop in _breakpoints.scss, which guards on height for
     exactly this reason. */
  phone:
    "(hover: none) and (pointer: coarse) and ((max-width: 900px) or (max-height: 520px))",
  reduced: "(prefers-reduced-motion: reduce)",
} as const

/**
 * Starts pessimistic on the server and on first paint — assuming a pointer device would mean
 * mounting the expensive path on a phone and only then tearing it down, which is the cost we are
 * trying to avoid.
 */
const INITIAL: DeviceTier = { isTouch: false, isPhone: false, reducedMotion: false }

export function useDeviceTier(): DeviceTier {
  const [tier, setTier] = useState<DeviceTier>(INITIAL)

  useEffect(() => {
    const touch = window.matchMedia(QUERIES.touch)
    const phone = window.matchMedia(QUERIES.phone)
    const reduced = window.matchMedia(QUERIES.reduced)

    const sync = () =>
      setTier({
        isTouch: touch.matches,
        isPhone: phone.matches,
        reducedMotion: reduced.matches,
      })

    sync()

    // Rotating a phone changes `isPhone`, so these have to stay subscribed rather than be read
    // once on mount.
    touch.addEventListener("change", sync)
    phone.addEventListener("change", sync)
    reduced.addEventListener("change", sync)

    return () => {
      touch.removeEventListener("change", sync)
      phone.removeEventListener("change", sync)
      reduced.removeEventListener("change", sync)
    }
  }, [])

  return tier
}
