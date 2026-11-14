import { toast } from "@medusajs/ui"
import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Změna stavu s pěti vteřinami na rozmyšlenou (14. 11. 2026).
 *
 * Kliknutí na „Začít připravovat", „Vyzvednuto" nebo „Peníze přišly" se
 * v administraci nedá vrátit — stav jde jen dopředu a zákazník hned dostává
 * e-mail (u odběru se zapíše i platba a vystaví faktura). Omyl na řádku vedle
 * pak znamená omluvný e-mail. Proto se akce neprovede hned: ukáže se zpráva
 * „Za 5 s … · Vrátit" a teprve po lhůtě se odešle. Backend ani e-maily se
 * nemění; čeká jen prohlížeč.
 */

export type NaplanovanaAkce = {
  /** Zruší, pokud ještě neproběhla. Vrací, jestli se zrušení podařilo. */
  zrusit: () => boolean
  /** Provede hned (odchod ze stránky). */
  hned: () => void
}

/** Čisté plánování — bez Reactu a zpráv, ať jde otestovat. */
export const naplanujAkci = (provest: () => void, ms: number): NaplanovanaAkce => {
  let hotovo = false
  const spust = () => {
    if (hotovo) return
    hotovo = true
    clearTimeout(casovac)
    provest()
  }
  const casovac = setTimeout(spust, ms)
  return {
    zrusit: () => {
      if (hotovo) return false
      hotovo = true
      clearTimeout(casovac)
      return true
    },
    hned: spust,
  }
}

const LHUTA_MS = 5000

/**
 * `odlozit("Připravujeme", () => mutace.mutate())` — vrací i `ceka`, aby
 * tlačítko mezitím šlo zakázat (druhé kliknutí by naplánovalo akci dvakrát).
 */
export const useOdlozenaAkce = () => {
  const [ceka, setCeka] = useState(false)
  const plan = useRef<NaplanovanaAkce | null>(null)

  /* Kdo zavře záložku během lhůty, tomu se akce provede hned — jinak by se
     ztratila a on by si myslel, že je hotovo. */
  useEffect(() => {
    if (!ceka) return
    const pryc = () => plan.current?.hned()
    window.addEventListener("pagehide", pryc)
    return () => window.removeEventListener("pagehide", pryc)
  }, [ceka])

  const odlozit = useCallback((popis: string, provest: () => void) => {
    if (plan.current) return
    setCeka(true)
    const id = `odlozena-${Date.now()}`
    plan.current = naplanujAkci(() => {
      plan.current = null
      setCeka(false)
      toast.dismiss(id)
      provest()
    }, LHUTA_MS)
    toast.info(popis, {
      id,
      description: "Provede se za 5 vteřin.",
      duration: LHUTA_MS,
      action: {
        label: "Vrátit zpět",
        altText: `Vrátit zpět: ${popis}`,
        onClick: () => {
          if (plan.current?.zrusit()) {
            plan.current = null
            setCeka(false)
            toast.dismiss(id)
            toast.success("Vráceno — nic se nezměnilo.")
          }
        },
      },
    })
  }, [])

  return { odlozit, ceka }
}
