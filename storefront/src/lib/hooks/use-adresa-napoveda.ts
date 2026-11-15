"use client"

import { useEffect, useState } from "react"

export type NavrhAdresy = { ulice: string; psc: string; mesto: string }

/**
 * Návrhy adres při psaní do pole Adresa (15. 11. 2026, Mapy.cz přes
 * `/api/adresa`). Jen Česko, od 3 znaků, s prodlevou 300 ms. Bez klíče na
 * serveru vrací prázdný seznam — pole se chová jako dřív.
 */
export const useAdresaNapoveda = (text: string | null | undefined, zeme?: string | null) => {
  const [navrhy, setNavrhy] = useState<NavrhAdresy[]>([])
  const dotaz = String(text ?? "").trim()
  const ceska = !zeme || zeme.toLowerCase() === "cz"

  useEffect(() => {
    if (!ceska || dotaz.length < 3) {
      setNavrhy([])
      return
    }
    let zruseno = false
    const timer = window.setTimeout(() => {
      fetch(`/api/adresa?q=${encodeURIComponent(dotaz)}`)
        .then((r) => (r.ok ? r.json() : { adresy: [] }))
        .then((d: { adresy?: NavrhAdresy[] }) => {
          if (!zruseno) setNavrhy(Array.isArray(d?.adresy) ? d.adresy : [])
        })
        .catch(() => !zruseno && setNavrhy([]))
    }, 300)
    return () => {
      zruseno = true
      window.clearTimeout(timer)
    }
  }, [dotaz, ceska])

  return navrhy
}
