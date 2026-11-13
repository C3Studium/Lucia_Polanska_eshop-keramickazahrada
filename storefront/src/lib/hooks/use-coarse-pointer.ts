"use client"

import { useEffect, useState } from "react"

/** Stejná podmínka jako `@include touch` ve stylech a LenisContext: prst, ne myš. */
const QUERY = "(hover: none) and (pointer: coarse)"

/**
 * Je tohle dotykové zařízení (telefon, tablet)? Na serveru a v prvním snímku
 * `false` — rozhoduje se až v prohlížeči, kde je `matchMedia`.
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(QUERY)
    const update = () => setCoarse(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  return coarse
}
