"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"

import type { CopyBlock, CopyBlocks } from "@lib/util/site-copy"

/**
 * Bloky z CMS pro komponenty hluboko ve stromu — bez protahování propů.
 *
 * ## Proč kontext, a ne prop jako jinde
 *
 * Většina sekcí dostává svůj blok propem od serverové stránky, a tak to má
 * zůstat. Jsou ale místa, kam prop vede přes pět komponent, které s textem
 * nemají nic společného: panel košíku v menu (menu → ikona košíku na počítači,
 * na telefonu i v dolní liště), hledání v menu, kroky pokladny (formulář →
 * krok → adresa). Každá mezikomponenta by kvůli jedné větě měnila svůj tvar —
 * a pokladna je přesně to místo, kde se tvar komponent měnit nemá.
 *
 * Provider dává vybrané bloky serverová stránka nebo layout (mají je načtené
 * tak jako tak); vnořený provider ty vnější doplní, ne zahodí. Mimo provider
 * vrací `useCopyBlock` `undefined` — a komponenta vykreslí své texty z kódu,
 * stejně jako při výpadku CMS.
 */
const CopyContext = createContext<CopyBlocks>({})

export function CopyProvider({
  blocks,
  children,
}: {
  /** Jen bloky, které komponenty pod providerem opravdu čtou. */
  blocks: CopyBlocks
  children: ReactNode
}) {
  const outer = useContext(CopyContext)
  const value = useMemo(() => ({ ...outer, ...blocks }), [outer, blocks])

  return <CopyContext.Provider value={value}>{children}</CopyContext.Provider>
}

/** Blok podle klíče (`pokladna.kroky`), nebo `undefined` mimo provider. */
export const useCopyBlock = (key: string): CopyBlock | undefined =>
  useContext(CopyContext)[key]
