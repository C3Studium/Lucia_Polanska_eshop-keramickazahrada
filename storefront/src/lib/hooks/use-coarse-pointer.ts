"use client"

import { useEffect, useState } from "react"

/** Stejná podmínka jako `@include touch` ve stylech a LenisContext: prst, ne myš. */
const QUERY = "(hover: none) and (pointer: coarse)"

/**
 * Je tohle dotykové zařízení (telefon, tablet)? Na serveru `false`, v prohlížeči
 * hned z `matchMedia` — už při prvním vykreslení.
 *
 * Proč hned: framer si `MotionConfig reducedMotion` přečte jen jednou, když se
 * prvek připojí. Dokud tu bylo `useState(false)` + `useEffect`, karty obchodu se
 * připojily ještě v režimu „user" a na telefonu dál vjížděly (změřeno 13. 11. 2026).
 * Do HTML se hodnota nepromítá (jen do kontextu a stavů po interakci), takže
 * rozdíl server/prohlížeč hydrataci nerozbije.
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(
    () => typeof window !== "undefined" && window.matchMedia(QUERY).matches
  )

  useEffect(() => {
    const media = window.matchMedia(QUERY)
    const update = () => setCoarse(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  return coarse
}
