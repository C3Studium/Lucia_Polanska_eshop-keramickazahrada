import { isFactKey } from "../facts"
import { flattenTokens, tokenize } from "../inline"
import type { LegalBlock, LegalDocumentVersion, LegalSlug } from "../types"
import { ALL_VERSIONS } from "./index"

/**
 * Kontrola tvaru právních dokumentů — za běhu se NEVOLÁ, spouští ji
 * orchestrátor / CI (např. `npx tsx -e "import('./src/lib/legal/documents/validate').then(m => m.assertDocumentsValid())"`).
 *
 * Hlídá to, co by se jinak projevilo až na webu nebo v PDF:
 * - unikátní `slug` + `version` a verze ve tvaru `YYYY-MM-DD`,
 * - unikátní kotvy kapitol v dokumentu (kotva je URL — dvě stejné = jedna
 *   nedosažitelná) a jejich tvar (malá písmena, číslice, pomlčky),
 * - žádná prázdná kapitola, blok ani řádek tabulky jiné délky než hlavička,
 * - jen známé `{{fakty}}` (překlep by se vykreslil jako „neznámý údaj"),
 * - neuzavřené `[[…` / `{{…`, prázdné `[[DOPLNIT: ]]`, lichý počet `**`
 *   a fakt / zástupný text uvnitř odkazu (ten se nerozkládá),
 * - každý dokument má aspoň jednu nearchivní verzi.
 */

export type LegalValidationIssue = {
  slug: LegalSlug
  version: string
  /** Kde: `#kotva` kapitoly, případně „dokument". */
  where: string
  message: string
}

const VERSION_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const ANCHOR_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const FACT_PATTERN = /\{\{([^}]*)\}\}/g
const PLACEHOLDER_PATTERN = /\[\[DOPLNIT:([^\]]*)\]\]/g

/** Všechny řetězce bloku včetně vnořených (rámeček) — pro kontrolu značky. */
const blockStrings = (block: LegalBlock): string[] => {
  switch (block.type) {
    case "p":
      return [block.text]
    case "ul":
    case "ol":
      return block.items
    case "table":
      return [block.caption ?? "", ...block.head, ...block.rows.reduce<string[]>((all, row) => all.concat(row), [])]
    case "box":
      return [block.title ?? "", ...block.blocks.reduce<string[]>((all, inner) => all.concat(blockStrings(inner)), [])]
    case "form":
      return [
        block.title ?? "",
        block.note ?? "",
        ...block.fields.reduce<string[]>((all, field) => all.concat([field.label, field.value ?? ""]), []),
      ]
  }
}

const isEmptyBlock = (block: LegalBlock): boolean => {
  switch (block.type) {
    case "p":
      return !block.text.trim()
    case "ul":
    case "ol":
      return !block.items.length || block.items.some((item) => !item.trim())
    case "table":
      return !block.head.length || !block.rows.length
    case "box":
      return !block.blocks.length || block.blocks.some(isEmptyBlock)
    case "form":
      return !block.fields.length || block.fields.some((field) => !field.label.trim())
  }
}

const checkMarkup = (text: string): string[] => {
  const problems: string[] = []

  FACT_PATTERN.lastIndex = 0
  let fact: RegExpExecArray | null
  while ((fact = FACT_PATTERN.exec(text)) !== null) {
    if (!isFactKey(fact[1])) problems.push(`neznámý fakt {{${fact[1]}}}`)
  }

  PLACEHOLDER_PATTERN.lastIndex = 0
  let placeholder: RegExpExecArray | null
  while ((placeholder = PLACEHOLDER_PATTERN.exec(text)) !== null) {
    if (!placeholder[1].trim()) problems.push("prázdné [[DOPLNIT: ]]")
  }

  const withoutPlaceholders = text.replace(PLACEHOLDER_PATTERN, "")
  if (withoutPlaceholders.indexOf("[[") !== -1) problems.push("neuzavřené nebo nepovolené „[[“")
  const withoutFacts = text.replace(FACT_PATTERN, "")
  if (withoutFacts.indexOf("{{") !== -1 || withoutFacts.indexOf("}}") !== -1) {
    problems.push("neuzavřené „{{“ / „}}“")
  }
  const bold = text.split("**").length - 1
  if (bold % 2 !== 0) problems.push("lichý počet „**“ (neuzavřené tučné písmo)")

  // Uvnitř odkazu se značka nerozkládá: `[{{fakt}}](…)` by na webu zůstalo
  // doslova „{{seller.email}}". (Tučné písmo se rozkládá rekurzivně —
  // `inline.tsx`, `children` — takže fakt v `**…**` je v pořádku; odkaz
  // uvnitř tučného písma se kontroluje taky, proto `flattenTokens`.)
  for (const token of flattenTokens(tokenize(text))) {
    if (token.kind === "link" && /\{\{|\[\[DOPLNIT/.test(`${token.label} ${token.href}`)) {
      problems.push("fakt nebo [[DOPLNIT]] uvnitř odkazu se nevykreslí")
    }
  }

  return problems
}

export const validateDocuments = (
  versions: LegalDocumentVersion[] = ALL_VERSIONS
): LegalValidationIssue[] => {
  const issues: LegalValidationIssue[] = []
  const seen: Record<string, true> = {}
  const hasCurrent: Partial<Record<LegalSlug, boolean>> = {}

  for (const doc of versions) {
    const at = (where: string, message: string) =>
      issues.push({ slug: doc.slug, version: doc.version, where, message })

    if (!VERSION_PATTERN.test(doc.version)) at("dokument", "verze není ve tvaru YYYY-MM-DD")
    const key = `${doc.slug}@${doc.version}`
    if (seen[key]) at("dokument", "stejná verze je v registru dvakrát")
    seen[key] = true

    if (!doc.title.trim()) at("dokument", "chybí název")
    if (!doc.sections.length) at("dokument", "dokument nemá žádnou kapitolu")
    if (!doc.archived) hasCurrent[doc.slug] = true
    else if (hasCurrent[doc.slug] === undefined) hasCurrent[doc.slug] = false

    for (const problem of checkMarkup(doc.summary ?? "")) at("úvod", problem)

    const anchors: Record<string, true> = {}
    for (const section of doc.sections) {
      const where = `#${section.id}`
      if (!ANCHOR_PATTERN.test(section.id)) at(where, "kotva smí mít jen malá písmena, číslice a pomlčky")
      if (anchors[section.id]) at(where, "kotva je v dokumentu dvakrát")
      anchors[section.id] = true
      if (!section.title.trim()) at(where, "kapitola nemá nadpis")
      if (!section.blocks.length) at(where, "kapitola je prázdná")

      for (const block of section.blocks) {
        if (isEmptyBlock(block)) at(where, `prázdný blok „${block.type}“`)
        if (block.type === "table") {
          block.rows.forEach((row, index) => {
            if (row.length !== block.head.length) {
              at(where, `řádek ${index + 1} tabulky má ${row.length} buněk místo ${block.head.length}`)
            }
          })
        }
        for (const text of blockStrings(block)) {
          for (const problem of checkMarkup(text)) at(where, problem)
        }
      }
    }
  }

  ;(Object.keys(hasCurrent) as LegalSlug[]).forEach((slug) => {
    if (!hasCurrent[slug]) {
      issues.push({ slug, version: "*", where: "dokument", message: "dokument nemá žádnou nearchivní verzi" })
    }
  })

  return issues
}

/** Vyhodí chybu se seznamem problémů; bez problémů nevrací nic. */
export const assertDocumentsValid = (versions: LegalDocumentVersion[] = ALL_VERSIONS): void => {
  const issues = validateDocuments(versions)
  if (!issues.length) return
  const lines = issues.map(
    (issue) => `- ${issue.slug} ${issue.version} ${issue.where}: ${issue.message}`
  )
  throw new Error(`Právní dokumenty neprošly kontrolou (${issues.length}):\n${lines.join("\n")}`)
}
