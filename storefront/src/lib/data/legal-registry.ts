import "server-only"

import { draftMode } from "next/headers"
import { cache } from "react"
import { readerFor } from "@c3studium/valecms/server/site"

import { fromCmsBody, LEGAL_CMS_TYPE, legalKey } from "@lib/legal/cms"
import { createLegalRegistry, type LegalRegistry } from "@lib/legal/registry"
import type { LegalDocumentVersion } from "@lib/legal/types"

/**
 * Registr právních dokumentů pro tento požadavek — kopie v repu + znění ze
 * Studia (typ „Právní dokumenty") + manifest PDF. Pravidla slučování jsou
 * v `@lib/legal/registry` (`createLegalRegistry`); tady se jen čte z CMS.
 *
 * Nikdy nevyhodí. CMS nedostupné, prázdné i neplatný dokument dopadnou stejně:
 * platí kopie v repu. Čtečky ValeCMS chybu neohlásí (vrací `[]`), takže
 * „CMS neběží" a „v CMS nic není" se zvenku nerozliší — obojí je ale stav,
 * ve kterém má web ukázat znění z repa, takže to nevadí.
 *
 * Neplatný dokument ze Studia (rozbitá kotva, neznámý `{{údaj}}`, blok, který
 * převod nezná) se přeskočí a zaloguje — jednou za proces, ne při každém
 * požadavku. Na webu pak platí znění z repa, nebo ta verze chybí, dokud ji
 * Lucie neopraví.
 */

type Reader = (options: { type: string; perPage?: number }) => Promise<Record<string, unknown>[]>

const reported = new Set<string>()
const reportOnce = (message: string) => {
  if (reported.has(message)) return
  reported.add(message)
  console.error(message)
}

const labelOf = (body: Record<string, unknown>) =>
  `${String(body?.dokument ?? "?")}@${String(body?.platnost ?? "?")}`

const readCmsVersions = async (
  draft: boolean
): Promise<{ docs: LegalDocumentVersion[]; skipped: number }> => {
  try {
    /* `readerFor` je v deklaracích knihovny `(): unknown` — tvar viz `getButtons`. */
    const read = readerFor({ draft }) as Reader
    // 100 = strop jednoho dotazu v ValeCMS (query.js MAX_PER_PAGE). Na sedm
    // dokumentů s pár zněními ročně je to rezerva na desítky let.
    const rows = await read({ type: LEGAL_CMS_TYPE, perPage: 100 })
    if (rows.length >= 100) {
      reportOnce(
        "[legal] Ze Studia přišlo 100 právních dokumentů — strop jednoho dotazu ValeCMS. " +
          "Další znění se nemusela načíst; je čas archivovat stará nebo číst po stránkách."
      )
    }

    const out: LegalDocumentVersion[] = []
    let skipped = 0
    const seen = new Set<string>()
    for (const body of rows) {
      const { doc, reason } = fromCmsBody(body)
      if (!doc) {
        skipped += 1
        reportOnce(`[legal] Právní dokument ze Studia ${labelOf(body)} je neplatný a na webu se nepoužije: ${reason}`)
        continue
      }
      const key = legalKey(doc.slug, doc.version)
      if (seen.has(key)) {
        // Zámek Studia (`cms-guard.ts`) duplicitu nepustí; tohle je pojistka
        // pro data z doby před ním. Bere se naposledy upravený (čtečka řadí
        // od nejnovější úpravy).
        reportOnce(`[legal] ${key} je ve Studiu dvakrát — použito naposledy upravené znění.`)
        continue
      }
      seen.add(key)
      out.push(doc)
    }
    return { docs: out, skipped }
  } catch (error) {
    reportOnce(`[legal] Právní dokumenty ze Studia se nepodařilo načíst — platí kopie v repu. ${error}`)
    return { docs: [], skipped: 0 }
  }
}

/** Jeden registr na požadavek a režim (náhled / publikované). */
const registryFor = cache(
  async (draft: boolean): Promise<LegalRegistry> => {
    const { docs, skipped } = await readCmsVersions(draft)
    return createLegalRegistry({ cms: docs, cmsSkipped: skipped })
  }
)

/**
 * Registr pro vykreslení stránky. V náhledu Studia („Náhled webu" → draft
 * mode) s koncepty, aby Lucie viděla rozepsané znění dřív, než ho publikuje.
 */
export const getLegalRegistry = async (): Promise<LegalRegistry> => {
  /*
   * `draftMode()` schválně MIMO try/catch — je to dynamické API a Next se
   * o přepnutí na vykreslení za běhu dozví vyhozením vlastní výjimky. Viz
   * `getPageCopy` v `./site-copy.ts`.
   */
  const preview = (await draftMode()).isEnabled
  return registryFor(preview)
}

/**
 * Registr jen z PUBLIKOVANÉHO — pro všechno, co verzi ukládá (souhlas
 * v pokladně, rezervace kurzu, poptávka zakázky) nebo ji tiskne do PDF.
 * K objednávce se nesmí zapsat verze, která existuje jen jako koncept ve
 * Studiu, ani když objednává někdo se zapnutým náhledem.
 */
export const getPublishedLegalRegistry = (): Promise<LegalRegistry> => registryFor(false)
