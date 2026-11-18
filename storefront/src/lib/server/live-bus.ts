import "server-only"

/**
 * Rozhlas pro otevřené záložky (18. 11. 2026, přání majitele: „změna musí
 * být vidět hned — backend zavolá obchod, jinak nic nekontrolovat").
 *
 * `/api/live` drží s každou otevřenou záložkou jedno spojení (Server-Sent
 * Events). Když backend po uložení v administraci zaklepe na
 * `/api/revalidate`, obchod zahodí mezipaměť a tady to ohlásí všem —
 * záložky si obsah obnoví samy. Žádné pravidelné dotazování.
 *
 * Seznam spojení leží na `globalThis`: Next každou routu balí zvlášť, takže
 * obyčejná proměnná modulu by byla v `/api/live` a v `/api/revalidate`
 * dvakrát a ohlášení by nikam nedošlo. Obchod běží v jedné instanci.
 */
type Posluchac = (udalost: string, data: string) => void

const KLIC = "__kzLiveBus" as const
type Bus = { posluchaci: Set<Posluchac> }

const bus = (): Bus => {
  const g = globalThis as typeof globalThis & { [KLIC]?: Bus }
  if (!g[KLIC]) g[KLIC] = { posluchaci: new Set() }
  return g[KLIC]!
}

export const prihlasit = (posluchac: Posluchac): (() => void) => {
  bus().posluchaci.add(posluchac)
  return () => {
    bus().posluchaci.delete(posluchac)
  }
}

/** Ohlásí změnu všem otevřeným záložkám. Vrací, kolika se to poslalo. */
export const ohlasit = (udalost: string, data: Record<string, unknown> = {}): number => {
  const text = JSON.stringify({ ...data, at: Date.now() })
  let pocet = 0
  bus().posluchaci.forEach((posluchac) => {
    try {
      posluchac(udalost, text)
      pocet += 1
    } catch {
      // Spojení, které mezitím spadlo, se odhlásí samo.
    }
  })
  return pocet
}
