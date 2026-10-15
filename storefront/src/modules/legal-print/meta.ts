import { fact, isFactKey, type LegalFactKey } from "@lib/legal/facts"
import { flattenTokens, hasPlaceholder, tokenize, type Token } from "@lib/legal/inline"
import type { LegalBlock, LegalDocumentVersion, LegalSlug } from "@lib/legal/types"

/**
 * Tisk právních dokumentů do PDF — sdílené údaje tiskové stránky
 * (`app/[countryCode]/(print)/pravni-dokument/[slug]/[version]`), JSON routy
 * `/api/legal/versions` a skriptu `pnpm legal:build`.
 *
 * Bez Node API a bez klientských závislostí — importuje to stránka i routa.
 */

/**
 * Revize tiskové šablony. Zvýšit při každé změně vzhledu PDF (CSS, hlavička,
 * pořadí bloků) — změní se tím otisk zdroje a `pnpm legal:build` vygeneruje
 * všechna PDF znovu. Pozor: už nahraná PDF v R2 jsou neměnná (immutable),
 * nové vygenerování vydané verze vyžaduje `legal:upload --overwrite`.
 */
export const PRINT_LAYOUT_REVISION = 1

/** Kód země v URL tiskové stránky (routy žijí pod `app/[countryCode]`). */
export const PRINT_COUNTRY = "cz"

/** Cesta tiskové stránky verze dokumentu. */
export const printPath = (slug: LegalSlug, version: string): string =>
  `/${PRINT_COUNTRY}/pravni-dokument/${slug}/${version}`

/**
 * Odkazy v PDF vedou na ostrou doménu obchodu (ne na localhost, ze kterého
 * se PDF tiskne). Doména je fakt z `facts.ts`, ať je jen na jednom místě.
 */
export const printSiteBase = (): string =>
  `${(fact("seller.webUrl") ?? "https://keramickazahrada.cz").replace(/\/+$/, "")}/${PRINT_COUNTRY}`

export const printHrefFor = (path: string): string => `${printSiteBase()}${path}`

/** Fakty, které tisková hlavička vypisuje vždy (identita prodávající). */
export const PRINT_HEADER_FACTS: LegalFactKey[] = [
  "seller.name",
  "seller.address",
  "seller.ico",
  "seller.email",
  "seller.phone",
  "seller.web",
  "seller.webUrl",
]

const blockStrings = (block: LegalBlock): string[] => {
  switch (block.type) {
    case "p":
      return [block.text]
    case "ul":
    case "ol":
      return block.items
    case "table":
      return [...(block.caption ? [block.caption] : []), ...block.head, ...block.rows.flat()]
    case "box":
      return [...(block.title ? [block.title] : []), ...block.blocks.flatMap(blockStrings)]
    case "form":
      return [
        ...(block.title ? [block.title] : []),
        ...block.fields.flatMap((field) => [field.label, ...(field.value ? [field.value] : [])]),
        ...(block.note ? [block.note] : []),
      ]
    default:
      return []
  }
}

/** Všechny řetězce dokumentu se značkou (nadpisy, odstavce, buňky, pole formulářů). */
export const documentStrings = (doc: LegalDocumentVersion): string[] => [
  doc.title,
  ...(doc.summary ? [doc.summary] : []),
  ...doc.sections.flatMap((section) => [section.title, ...section.blocks.flatMap(blockStrings)]),
]

/** Fakty `{{…}}`, na které dokument odkazuje, plus fakty hlavičky. Seřazené. */
export const usedFactKeys = (doc: LegalDocumentVersion): LegalFactKey[] => {
  const keys = new Set<LegalFactKey>(PRINT_HEADER_FACTS)
  const pattern = /\{\{([a-zA-Z0-9.]+)\}\}/g
  for (const text of documentStrings(doc)) {
    let match: RegExpExecArray | null
    pattern.lastIndex = 0
    while ((match = pattern.exec(text)) !== null) {
      if (isFactKey(match[1])) keys.add(match[1])
    }
  }
  return Array.from(keys).sort()
}

/** Počet zástupných údajů `[[DOPLNIT]]` (i přes chybějící fakt), hlavička včetně. */
export const placeholderCount = (doc: LegalDocumentVersion): number => {
  const header = PRINT_HEADER_FACTS.filter((key) => fact(key) === null).length
  return (
    header +
    documentStrings(doc).reduce(
      (count, text) =>
        count +
        flattenTokens(tokenize(text)).filter((token) => token.kind === "placeholder").length,
      0
    )
  )
}

export const documentHasPlaceholder = (doc: LegalDocumentVersion): boolean =>
  PRINT_HEADER_FACTS.some((key) => fact(key) === null) ||
  documentStrings(doc).some((text) => hasPlaceholder(text))

/** Řetězec se značkou → čistý text tak, jak ho vysází PDF (odkaz = jen popisek). */
export const printedText = (input: string): string => printedTokens(tokenize(input))

const printedTokens = (tokens: Token[]): string =>
  tokens
    .map((token) => {
      switch (token.kind) {
        case "text":
          return token.value
        case "bold":
          return printedTokens(token.children)
        case "link":
          return token.label
        case "placeholder":
          return `[[DOPLNIT: ${token.value}]]`
      }
    })
    .join("")

/**
 * Úryvky, které musí jít z vygenerovaného PDF přečíst jako text — kontrola
 * diakritiky v `pnpm legal:build` (vložené písmo + mapa ToUnicode).
 */
export const printProbes = (doc: LegalDocumentVersion): string[] =>
  [doc.title, ...doc.sections.slice(0, 3).map((section) => section.title)]
    .map(printedText)
    .filter((text) => text.trim().length > 0)
