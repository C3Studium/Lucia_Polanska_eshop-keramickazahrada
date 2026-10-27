"use client"

import { useEffect, useRef } from "react"

/**
 * Opakovaná kontrola platby, dokud `check` nevrátí `true` (hotovo).
 *
 * Každé 3 s první 3 minuty, potom každých 10 s až do 20 minut — a hned, když
 * se zákazník vrátí do záložky (platil v jiném okně, telefon zhasl). Dva
 * dotazy najednou nikdy: další čeká, až doběhne předchozí.
 *
 * Používá to košík (`CartPaymentWatcher`) i rezervace kurzu (`RezervaceDetail`).
 */
const FAST_MS = 3000
const SLOW_MS = 10000
const FAST_FOR_MS = 3 * 60 * 1000
const STOP_AFTER_MS = 20 * 60 * 1000

export const usePaymentWatch = (check: () => Promise<boolean>, enabled = true) => {
  const checkRef = useRef(check)
  checkRef.current = check

  useEffect(() => {
    if (!enabled) return
    const started = Date.now()
    let stopped = false
    let running = false
    let timer: number | undefined

    const tick = async () => {
      if (stopped || running) return
      running = true
      try {
        if (await checkRef.current()) {
          stopped = true
          return
        }
      } catch {
        // Výpadek sítě — zkusí se znovu při dalším kroku.
      } finally {
        running = false
      }
      schedule()
    }
    const schedule = () => {
      if (stopped) return
      const elapsed = Date.now() - started
      if (elapsed > STOP_AFTER_MS) return
      timer = window.setTimeout(tick, elapsed < FAST_FOR_MS ? FAST_MS : SLOW_MS)
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        window.clearTimeout(timer)
        void tick()
      }
    }

    void tick()
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)
    return () => {
      stopped = true
      window.clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
    }
  }, [enabled])
}
