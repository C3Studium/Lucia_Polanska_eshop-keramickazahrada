import { BLOCK_LABEL, checkMarkup, validateDocuments } from "./documents/validate"
import { LEGAL_PATHS } from "./registry"
import type { LegalBlock, LegalDocumentVersion, LegalSection, LegalSlug } from "./types"

/**
 * Právní dokument ve Studiu (typ `pravniDokument`, `valecms.types.ts`) ⇄ verze
 * v registru (`LegalDocumentVersion`). Čisté funkce bez CMS a bez Nextu —
 * čte je registr (`@lib/data/legal-registry`), `/api/legal/versions`, seed
 * (`scripts/seed-legal.mjs`) i test `scripts/legal-cms-roundtrip.test.mjs`.
 *
 * ## Proč převod, a ne tvar registru přímo v CMS
 *
 * Studio staví formulář z polí a pole mají české popisky pro Lucii
 * („Kapitoly", „Rámeček", „Řádky tabulky"); polymorfní seznam bloků rozlišuje
 * položky podle `_type`. Registr, tisk do PDF a otisk zdroje (`source-hash.ts`)
 * ale stojí na tvaru `LegalDocumentVersion`. Převod je proto jediné místo, kde
 * se ty dva tvary potkávají, a musí být BEZEZTRÁTOVÝ: `fromCmsBody(toCmsBody(v))`
 * dá stejné JSON (i pořadí klíčů — z něj se počítá otisk PDF) pro každou verzi
 * v repu. Hlídá to test.
 *
 * ## Prázdné vs. chybějící
 *
 * CMS drží nevyplněné nepovinné pole jako `""` (popisek tabulky, nadpis
 * rámečku, hodnota řádku formuláře, úvod). Registr takový klíč vůbec nemá —
 * `""` se proto převádí na vynechaný klíč a zpátky.
 */

export { LEGAL_CMS_LEGACY_SOURCE, LEGAL_CMS_TYPE } from "./cms-type"

/* ------------------------------------------------------------ tvar v CMS -- */

export type CmsOdstavec = { _type: "odstavec"; text: string }
export type CmsSeznam = { _type: "seznam"; cislovany: boolean; polozky: string[] }
export type CmsTabulka = {
  _type: "tabulka"
  popisek: string
  hlavicka: string[]
  radky: { _type?: string; bunky: string[] }[]
}
export type CmsRamecek = { _type: "ramecek"; nadpis: string; bloky: (CmsOdstavec | CmsSeznam)[] }
export type CmsFormular = {
  _type: "formular"
  nadpis: string
  pole: { _type?: string; popisek: string; hodnota: string }[]
  poznamka: string
}
export type CmsBlok = CmsOdstavec | CmsSeznam | CmsTabulka | CmsRamecek | CmsFormular

export type CmsKapitola = { _type?: string; kotva: string; nadpis: string; bloky: CmsBlok[] }

export type LegalCmsBody = {
  dokument: LegalSlug
  platnost: string
  nazev: string
  uvod: string
  kapitoly: CmsKapitola[]
  pdf: boolean
  archivni: boolean
  poznamka: string
}

/* ------------------------------------------------------- registr → CMS -- */

const blockToCms = (block: LegalBlock): CmsBlok => {
  switch (block.type) {
    case "p":
      return { _type: "odstavec", text: block.text }
    case "ul":
    case "ol":
      return { _type: "seznam", cislovany: block.type === "ol", polozky: [...block.items] }
    case "table":
      return {
        _type: "tabulka",
        popisek: block.caption ?? "",
        hlavicka: [...block.head],
        radky: block.rows.map((row) => ({ _type: "radek", bunky: [...row] })),
      }
    case "box":
      return {
        _type: "ramecek",
        nadpis: block.title ?? "",
        bloky: block.blocks.map((inner) => {
          const converted = blockToCms(inner)
          // Rámeček je ve Studiu o úroveň mělčí (schémata nejdou zanořit do
          // sebe) — smí v něm být jen odstavec a seznam. Dnešní dokumenty víc
          // nepotřebují; kdyby přibyla tabulka v rámečku, spadne to tady
          // nahlas, ne tiše při ukládání ve Studiu.
          if (converted._type !== "odstavec" && converted._type !== "seznam") {
            throw new Error(`Rámeček smí ve Studiu obsahovat jen odstavce a seznamy (ne „${inner.type}“).`)
          }
          return converted
        }),
      }
    case "form":
      return {
        _type: "formular",
        nadpis: block.title ?? "",
        pole: block.fields.map((field) => ({ _type: "pole", popisek: field.label, hodnota: field.value ?? "" })),
        poznamka: block.note ?? "",
      }
  }
}

/** Verze z registru jako tělo dokumentu `pravniDokument` (seed, porovnání). */
export const toCmsBody = (doc: LegalDocumentVersion, poznamka = ""): LegalCmsBody => ({
  dokument: doc.slug,
  platnost: doc.version,
  nazev: doc.title,
  uvod: doc.summary ?? "",
  kapitoly: doc.sections.map((section) => ({
    _type: "kapitola",
    kotva: section.id,
    nadpis: section.title,
    bloky: section.blocks.map(blockToCms),
  })),
  pdf: doc.pdf,
  archivni: Boolean(doc.archived),
  poznamka,
})

/* ------------------------------------------------------- CMS → registr -- */

export type FromCmsResult =
  | { doc: LegalDocumentVersion; reason: null }
  | { doc: null; reason: string }

/** Chyba tvaru — vyhodí se uvnitř převodu a `fromCmsBody` z ní udělá `reason`. */
class ShapeError extends Error {}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const str = (value: unknown, where: string): string => {
  if (typeof value !== "string") throw new ShapeError(`${where}: chybí text`)
  return value
}

/** Nepovinný text: chybějící nebo `""` = žádný. */
const optionalStr = (value: unknown, where: string): string | undefined => {
  if (value === undefined || value === null || value === "") return undefined
  return str(value, where)
}

const strList = (value: unknown, where: string): string[] => {
  if (!Array.isArray(value)) throw new ShapeError(`${where}: očekáván seznam`)
  return value.map((item, index) => str(item, `${where}, položka ${index + 1}`))
}

const list = (value: unknown, where: string): unknown[] => {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new ShapeError(`${where}: očekáván seznam`)
  return value
}

const blockFromCms = (value: unknown, where: string, inBox: boolean): LegalBlock => {
  if (!isObject(value)) throw new ShapeError(`${where}: blok je poškozený`)
  switch (value._type) {
    case "odstavec":
      return { type: "p", text: str(value.text, `${where} (odstavec)`) }
    case "seznam":
      return {
        type: value.cislovany === true ? "ol" : "ul",
        items: strList(value.polozky, `${where} (seznam)`),
      }
    case "tabulka": {
      if (inBox) break
      const caption = optionalStr(value.popisek, `${where} (tabulka), popisek`)
      return {
        type: "table",
        ...(caption !== undefined ? { caption } : {}),
        head: strList(value.hlavicka, `${where} (tabulka), záhlaví`),
        rows: list(value.radky, `${where} (tabulka), řádky`).map((row, index) => {
          if (!isObject(row)) throw new ShapeError(`${where} (tabulka): řádek ${index + 1} je poškozený`)
          return strList(row.bunky, `${where} (tabulka), řádek ${index + 1}`)
        }),
      }
    }
    case "ramecek": {
      if (inBox) break
      const title = optionalStr(value.nadpis, `${where} (rámeček), nadpis`)
      return {
        type: "box",
        ...(title !== undefined ? { title } : {}),
        blocks: list(value.bloky, `${where} (rámeček)`).map((inner, index) =>
          blockFromCms(inner, `${where} (rámeček), vnitřní blok ${index + 1}`, true)
        ),
      }
    }
    case "formular": {
      if (inBox) break
      const title = optionalStr(value.nadpis, `${where} (formulář), nadpis`)
      const note = optionalStr(value.poznamka, `${where} (formulář), poznámka`)
      return {
        type: "form",
        ...(title !== undefined ? { title } : {}),
        fields: list(value.pole, `${where} (formulář), řádky`).map((field, index) => {
          if (!isObject(field)) throw new ShapeError(`${where} (formulář): řádek ${index + 1} je poškozený`)
          const label = str(field.popisek, `${where} (formulář), řádek ${index + 1}`)
          const fieldValue = optionalStr(field.hodnota, `${where} (formulář), řádek ${index + 1}`)
          return fieldValue !== undefined ? { label, value: fieldValue } : { label }
        }),
        ...(note !== undefined ? { note } : {}),
      }
    }
  }
  throw new ShapeError(
    `${where}: neznámý druh bloku ${JSON.stringify(value._type)}${inBox ? " (v rámečku smí být jen odstavec a seznam)" : ""}`
  )
}

/** Řetězce bloku se jménem místa v řeči Studia — pro čitelné chyby. */
const blockTexts = (block: LegalBlock): { where: string; text: string }[] => {
  switch (block.type) {
    case "p":
      return [{ where: "", text: block.text }]
    case "ul":
    case "ol":
      return block.items.map((text, index) => ({ where: `položka ${index + 1}`, text }))
    case "table":
      return [
        ...(block.caption ? [{ where: "popisek", text: block.caption }] : []),
        ...block.head.map((text, index) => ({ where: `záhlaví sloupce ${index + 1}`, text })),
        ...block.rows.flatMap((row, rowIndex) =>
          row.map((text, cellIndex) => ({ where: `řádek ${rowIndex + 1}, buňka ${cellIndex + 1}`, text }))
        ),
      ]
    case "box":
      return [
        ...(block.title ? [{ where: "nadpis rámečku", text: block.title }] : []),
        ...block.blocks.flatMap((inner, index) =>
          blockTexts(inner).map((item) => ({
            where: `vnitřní blok ${index + 1} (${BLOCK_LABEL[inner.type]})${item.where ? `, ${item.where}` : ""}`,
            text: item.text,
          }))
        ),
      ]
    case "form":
      return [
        ...(block.title ? [{ where: "nadpis formuláře", text: block.title }] : []),
        ...block.fields.flatMap((field, index) => [
          { where: `řádek ${index + 1}, popisek`, text: field.label },
          ...(field.value ? [{ where: `řádek ${index + 1}, předvyplněno`, text: field.value }] : []),
        ]),
        ...(block.note ? [{ where: "poznámka pod formulářem", text: block.note }] : []),
      ]
  }
}

const chapterName = (doc: LegalDocumentVersion, index: number) =>
  `Kapitola ${index + 1} „${doc.sections[index]?.title?.trim() || "bez nadpisu"}“`

/** Všechny chyby značky s místem: „Kapitola 2 „…“, blok 3 (odstavec): neznámý údaj …". */
const markupProblems = (doc: LegalDocumentVersion): string[] => {
  const problems: string[] = []
  const check = (where: string, text: string) => {
    for (const problem of checkMarkup(text)) problems.push(`${where}: ${problem}`)
  }
  check("Název", doc.title)
  if (doc.summary) check("Úvod", doc.summary)
  doc.sections.forEach((section, sectionIndex) => {
    const chapter = chapterName(doc, sectionIndex)
    check(`${chapter}, nadpis`, section.title)
    section.blocks.forEach((block, blockIndex) => {
      for (const item of blockTexts(block)) {
        check(
          `${chapter}, blok ${blockIndex + 1} (${BLOCK_LABEL[block.type]})${item.where ? `, ${item.where}` : ""}`,
          item.text
        )
      }
    })
  })
  return problems
}

/** `#kotva` z `validate.ts` → „Kapitola 3 „Nadpis“ (kotva …)". */
const placeOf = (doc: LegalDocumentVersion, where: string): string => {
  if (!where.startsWith("#")) return where === "dokument" ? "Dokument" : where
  const index = doc.sections.findIndex((section) => section.id === where.slice(1))
  return index === -1 ? `Kapitola s kotvou ${where.slice(1)}` : `${chapterName(doc, index)} (kotva ${where.slice(1)})`
}

const describeProblems = (problems: string[]): string => {
  const shown = problems.slice(0, 3).join("; ")
  const more = problems.length > 3 ? ` (a ${problems.length - 3} další)` : ""
  return `${shown}${more}`
}

const isSlug = (value: unknown): value is LegalSlug =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(LEGAL_PATHS, value)

/**
 * Tělo dokumentu `pravniDokument` → verze registru, nebo `null` s důvodem.
 *
 * Kromě tvaru projde verze stejnou kontrolou jako dokumenty v repu
 * (`documents/validate.ts`: kotvy, značka, prázdné bloky, známé `{{údaje}}`).
 * Neplatný dokument z CMS se na web nedostane — registr ho přeskočí a zaloguje,
 * a platí pak znění z repa.
 */
export const fromCmsBody = (body: unknown): FromCmsResult => {
  try {
    if (!isObject(body)) throw new ShapeError("dokument nemá obsah")
    if (!isSlug(body.dokument)) {
      throw new ShapeError(`neznámý dokument ${JSON.stringify(body.dokument ?? null)} (vyberte ho v poli Dokument)`)
    }
    const version = str(body.platnost, "Platí od")
    const summary = optionalStr(body.uvod, "Úvod")

    const sections: LegalSection[] = list(body.kapitoly, "kapitoly").map((value, index) => {
      const where = `Kapitola ${index + 1}`
      if (!isObject(value)) throw new ShapeError(`${where} je poškozená`)
      return {
        id: str(value.kotva, `${where}, kotva`),
        title: str(value.nadpis, `${where}, nadpis`),
        blocks: list(value.bloky, `${where}, obsah`).map((block, blockIndex) =>
          blockFromCms(block, `${where}, blok ${blockIndex + 1}`, false)
        ),
      }
    })

    const doc: LegalDocumentVersion = {
      slug: body.dokument,
      title: str(body.nazev, "Název"),
      version,
      ...(summary !== undefined ? { summary } : {}),
      pdf: body.pdf !== false,
      ...(body.archivni === true ? { archived: true } : {}),
      sections,
    }

    // Nejdřív značka s přesným místem (kapitola, blok, položka) — to je chyba,
    // kterou Lucie udělá nejspíš a kterou musí najít. Pak zbytek kontroly
    // jako u dokumentů v repu; „nemá nearchivní verzi" se týká celého
    // registru (archivní verze v CMS sama o sobě chybou není).
    const problems = markupProblems(doc)
    if (!problems.length) {
      for (const issue of validateDocuments([doc])) {
        if (issue.version === "*") continue
        problems.push(`${placeOf(doc, issue.where)}: ${issue.message}`)
      }
    }
    if (problems.length) return { doc: null, reason: describeProblems(problems) }
    return { doc, reason: null }
  } catch (error) {
    if (error instanceof ShapeError) return { doc: null, reason: error.message }
    throw error
  }
}

/** Klíč verze — `obchodni-podminky@2026-10-15`. Stejný tvar má `legacy_id` seedu. */
export const legalKey = (slug: string, version: string): string => `${slug}@${version}`

/**
 * Stejné znění? Porovnává se kanonický tvar (přes převod tam a zpátky), takže
 * nerozhoduje pořadí klíčů ani `archived: false` vs. chybějící klíč.
 */
export const sameLegalText = (a: LegalDocumentVersion, b: LegalDocumentVersion): boolean => {
  const canonical = (doc: LegalDocumentVersion) => {
    const parsed = fromCmsBody(toCmsBody(doc)).doc ?? doc
    return JSON.stringify({
      slug: parsed.slug,
      title: parsed.title,
      version: parsed.version,
      summary: parsed.summary ?? null,
      pdf: parsed.pdf,
      archived: Boolean(parsed.archived),
      sections: parsed.sections,
    })
  }
  return canonical(a) === canonical(b)
}
