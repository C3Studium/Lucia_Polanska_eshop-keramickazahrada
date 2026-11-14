"use client"

import { useEffect, useState } from "react"
import { normalizujPsc } from "@lib/util/psc"

/**
 * Po napsání PSČ (ČR) zjistí obce (14. 11. 2026). Vrací seznam pro nabídku
 * u pole Město; jednu jedinou obec volající rovnou dosadí, když je město
 * prázdné (viz `doplnMesto`). Selhání = prázdný seznam, nic se neděje.
 */
export const usePscMesto = (
  psc: string | null | undefined,
  zeme: string | null | undefined,
  doplnMesto?: (mesto: string) => void
) => {
  const [obce, setObce] = useState<string[]>([])
  const cisty = normalizujPsc(psc)
  const ceska = !zeme || zeme.toLowerCase() === "cz"

  useEffect(() => {
    if (!cisty || !ceska) {
      setObce([])
      return
    }
    let zruseno = false
    fetch(`/api/psc?psc=${cisty}`)
      .then((r) => (r.ok ? r.json() : { obce: [] }))
      .then((d: { obce?: string[] }) => {
        if (zruseno) return
        const seznam = Array.isArray(d?.obce) ? d.obce : []
        setObce(seznam)
        if (seznam.length === 1) doplnMesto?.(seznam[0])
      })
      .catch(() => !zruseno && setObce([]))
    return () => {
      zruseno = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cisty, ceska])

  return obce
}
