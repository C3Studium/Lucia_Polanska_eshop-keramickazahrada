"use client"

import { createContext, useContext, type ReactNode } from "react"

import { FALLBACK_FACTS, type LegalFacts } from "./facts"

/**
 * Právní údaje obchodu pro KLIENTSKÉ komponenty hluboko ve stromu (předsmluvní
 * informace v pokladně a v rychlém nákupu, právní sekce na stránce Dotazy).
 *
 * Hodnoty načte jednou kořenový layout (`getLegalFacts()` — administrace
 * obchodu, záloha z kódu) a podá je sem; komponenta si je vezme `useLegalFacts()`
 * místo toho, aby se prop protahoval přes pět vrstev pokladny. Kde je serverový
 * rodič blízko (stránka dokumentu, odstoupení, rezervace kurzu), jdou fakty
 * dál jako prop — tam je vidět, odkud přišly.
 *
 * Bez poskytovatele (test, izolovaný náhled) vrací zálohu z kódu.
 */
const LegalFactsContext = createContext<LegalFacts | null>(null)

export function LegalFactsProvider({
  facts,
  children,
}: {
  facts: LegalFacts
  children: ReactNode
}) {
  return <LegalFactsContext.Provider value={facts}>{children}</LegalFactsContext.Provider>
}

export const useLegalFacts = (): LegalFacts => useContext(LegalFactsContext) ?? FALLBACK_FACTS
