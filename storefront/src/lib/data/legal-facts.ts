import "server-only"

import { cache } from "react"
import { FALLBACK_FACTS, mergeFacts, type LegalFacts } from "@lib/legal/facts"

/**
 * Právní údaje obchodu (číslo účtu, DPH, záloha, storno kurzů …) z backendu.
 *
 * Vyplňují se v administraci obchodu („Právní údaje", merchant settings
 * `legal_facts`) — patří k obchodu, ne k redakčnímu obsahu, a čte je i
 * backend (patička e-mailů, potvrzení rezervace). Web je dosazuje za
 * `{{klíč}}` v právních textech.
 *
 * `GET /store/legal/facts` → `{ facts: Record<klíč, string | null>, updated_at }`.
 *
 * Nikdy nevyhodí: když backend neodpovídá, vrátí zálohu z kódu
 * (`FALLBACK_FACTS` — identita prodávající vyplněná, zbytek `[[DOPLNIT]]`).
 * Krátká cache: změna v administraci se na webu projeví do minuty.
 */

export type LegalFactsResponse = {
  facts: Record<string, string | null>
  updated_at?: string | null
}

/*
 * Hlášení o výpadku nejvýš jednou za pět minut — ne jednou za proces: další
 * výpadek po hodinách by jinak zůstal v logu neviditelný, a ne při každém
 * požadavku, aby výpadek backendu nezahltil log.
 */
const WARN_EVERY_MS = 5 * 60 * 1000
let lastWarnAt = 0

const warnOnce = (message: string, error?: unknown) => {
  const now = Date.now()
  if (now - lastWarnAt < WARN_EVERY_MS) return
  lastWarnAt = now
  if (error === undefined) console.error(message)
  else console.error(message, error)
}

const fetchLegalFacts = async (): Promise<LegalFacts> => {
  const base = process.env.MEDUSA_BACKEND_URL || process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
  if (!base) return FALLBACK_FACTS

  // Publikovatelný klíč MUSÍ jít s dotazem — viz `getShopStatus`.
  const pk = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

  try {
    const response = await fetch(`${base.replace(/\/+$/, "")}/store/legal/facts`, {
      headers: pk ? { "x-publishable-api-key": pk, "x-publishable-key": pk } : {},
      next: { revalidate: 60, tags: ["legal-facts"] },
    })
    if (!response.ok) {
      warnOnce(`[legal-facts] Backend odmítl dotaz: HTTP ${response.status} — používám zálohu z kódu.`)
      return FALLBACK_FACTS
    }
    const body = (await response.json()) as LegalFactsResponse
    return mergeFacts(body?.facts)
  } catch (error) {
    warnOnce("[legal-facts] Backend neodpovídá — používám zálohu z kódu.", error)
    return FALLBACK_FACTS
  }
}

/** Fakty pro jeden požadavek (deduplikované přes `cache`). */
export const getLegalFacts = cache(fetchLegalFacts)
