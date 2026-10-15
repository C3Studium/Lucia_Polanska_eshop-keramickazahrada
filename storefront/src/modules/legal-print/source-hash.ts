import "server-only"

import { createHash } from "crypto"
import { fact } from "@lib/legal/facts"
import type { LegalDocumentVersion } from "@lib/legal/types"
import { PRINT_LAYOUT_REVISION, usedFactKeys } from "./meta"

/**
 * Otisk zdroje PDF: znění verze + hodnoty faktů, které dokument (a hlavička)
 * opravdu používá + revize tiskové šablony.
 *
 * Záměrně BEZ `pdf` a `archived`: to jsou příznaky o dokumentu, ne jeho
 * znění. Když se verze později označí jako archivní, její PDF se nesmí změnit
 * (váže se k ní uzavřená smlouva a v R2 je uložené jako neměnné).
 */
export const printSourceHash = (doc: LegalDocumentVersion): string => {
  const facts: Record<string, string | null> = {}
  for (const key of usedFactKeys(doc)) facts[key] = fact(key)

  const source = JSON.stringify({
    revision: PRINT_LAYOUT_REVISION,
    document: {
      slug: doc.slug,
      title: doc.title,
      version: doc.version,
      summary: doc.summary ?? null,
      sections: doc.sections,
    },
    facts,
  })

  return createHash("sha256").update(source, "utf8").digest("hex")
}
