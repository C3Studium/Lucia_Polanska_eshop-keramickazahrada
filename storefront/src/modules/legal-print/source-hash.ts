import "server-only"

import { createHash } from "crypto"
import { fact, type LegalFacts } from "@lib/legal/facts"
import type { LegalDocumentVersion } from "@lib/legal/types"
import { PRINT_LAYOUT_REVISION, usedFactKeys } from "./meta"

/**
 * Fakty, které verze (a tisková hlavička) opravdu používá, s hodnotami —
 * přesně to, co jde do otisku zdroje a co `pnpm legal:build` zapíše do
 * záznamu manifestu (`entry.facts`).
 */
export const usedFacts = (
  doc: LegalDocumentVersion,
  facts: LegalFacts
): Record<string, string | null> => {
  const used: Record<string, string | null> = {}
  for (const key of usedFactKeys(doc)) used[key] = fact(key, facts)
  return used
}

/**
 * Otisk zdroje PDF: znění verze + hodnoty faktů, které dokument (a hlavička)
 * opravdu používá + revize tiskové šablony.
 *
 * Záměrně BEZ `pdf` a `archived`: to jsou příznaky o dokumentu, ne jeho
 * znění. Když se verze později označí jako archivní, její PDF se nesmí změnit
 * (váže se k ní uzavřená smlouva a v R2 je uložené jako neměnné).
 *
 * `facts` = fakty, se kterými se verze tiskne (`registry.factsFor`): u vydané
 * verze otisk z manifestu, jinak živé z administrace. Shoda otisku tak
 * dokazuje, že se nezměnilo ani znění, ani údaje v něm.
 */
export const printSourceHash = (doc: LegalDocumentVersion, facts: LegalFacts): string => {
  const source = JSON.stringify({
    revision: PRINT_LAYOUT_REVISION,
    document: {
      slug: doc.slug,
      title: doc.title,
      version: doc.version,
      summary: doc.summary ?? null,
      sections: doc.sections,
    },
    facts: usedFacts(doc, facts),
  })

  return createHash("sha256").update(source, "utf8").digest("hex")
}
