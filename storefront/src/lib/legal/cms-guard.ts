import { LEGAL_CMS_TYPE } from "./cms-type"

/**
 * Zámek právních dokumentů ve Studiu — ČISTÉ rozhodnutí (bez CMS, bez Nextu).
 *
 * ValeCMS publikovaný dokument zamknout neumí: kdokoli přihlášený ho může
 * upravit, publikovat, stáhnout, archivovat i smazat a knihovna nemá háčky,
 * kterými by se do toho dalo vstoupit. Jediný šev je naše catch-all routa
 * `app/api/cms/[...route]` — tam adaptér (`@lib/data/legal-cms-guard`)
 * přečte uložený dokument a zeptá se tady, jestli požadavek pustit dál.
 *
 * Pravidla pro typ `pravniDokument` (docs/cms/00-plan.md, „Neměnnost"):
 *
 * 1. **Vydané znění** (PDF zveřejněné v úložišti) — žádná změna: úprava,
 *    publikace, stažení, archivace, smazání. Výjimka: zahodit koncept
 *    (`DELETE …/draft`) jde vždy — vrací dokument do publikované podoby
 *    a na webu nic nezmění (vydané znění se bere z repa).
 * 2. **Znění, které už platilo** (publikované s `platnost <= dnes`) — nejde
 *    smazat, stáhnout ani archivovat (váží se k němu objednávky) a nejde mu
 *    změnit dokument ani datum (datum je číslo verze uložené k objednávce).
 *    Text upravit jde — dokud nemá zveřejněné PDF, je to pracovní znění.
 * 3. **Duplicitní** `dokument@platnost` — ani nový, ani změnou data.
 * 4. **Zpětná platnost** — publikovat znění s datem v minulosti jde jen tehdy,
 *    když už s tímhle datem publikované bylo (oprava pracovního znění).
 * 5. **Znění, které by web nepřijal** — publikace (i obnovení z archivu) těla,
 *    které převod `fromCmsBody` odmítne (překlep v `{{údaji}}`, neuzavřené
 *    `**` nebo `[[`, prázdná kapitola…), se odmítne s českým důvodem a místem.
 *    Jinak by Studio hlásilo „Publikováno", web by dál ukazoval staré znění a
 *    pokladna by dál zapisovala starou verzi. Koncept uložit jde.
 *
 * Ostatní typy dokumentů projdou beze změny.
 *
 * Odpověď má tvar chyby ValeCMS (`{ error: { code, message } }`), takže Studio
 * ukáže naši českou větu v hlášce „Uložení selhalo". Kód nikdy není
 * `conflict` — ten Studio čte jako souběh dvou editorů a otevře dialog
 * s rozdílem.
 */

export type GuardBody = Record<string, unknown>

/** Uložený dokument tak, jak ho vrací repozitář ValeCMS (`toDocument`). */
export type GuardStoredDoc = {
  id: string
  type: string
  status: string
  data: GuardBody | null
  draft: GuardBody | null
  archivedAt?: string | null
}

export type GuardOperation =
  | { kind: "create"; type: string; data: GuardBody | null }
  | { kind: "update"; data: GuardBody | null }
  /** `segments` = cesta k poli tak, jak ji rozloží ValeCMS; `null` = nečitelná. */
  | { kind: "patch"; segments: string[] | null; value: unknown }
  | { kind: "discardDraft" }
  | { kind: "delete" }
  | { kind: "transition"; action: string }

export type GuardContext = {
  /** Dokument z URL (`/documents/:id…`); `null` u založení nebo když neexistuje. */
  stored: GuardStoredDoc | null
  /** Všechny dokumenty `pravniDokument` (i archivované) — kvůli duplicitám. */
  siblings: GuardStoredDoc[]
  /** Pražské datum `YYYY-MM-DD`. */
  today: string
  /** Je verze vydaná (PDF se zveřejněnou https adresou v manifestu)? */
  isLocked: (slug: string, version: string) => boolean
  /** Název dokumentu do hlášky (`obchodni-podminky` → „Obchodní podmínky"). */
  titleOf?: (slug: string) => string
  /**
   * Proč by web tělo nepřijal (`fromCmsBody` → `reason`), nebo `null`. Bez
   * něj se tělo nekontroluje (testy, které o to nestojí).
   */
  problemOf?: (body: GuardBody) => string | null
}

export type GuardVerdict =
  | { allow: true }
  | { allow: false; status: number; code: "forbidden" | "invalid"; message: string }

/* ---------------------------------------------------------------- texty -- */

const datum = (version: string) => {
  const [y, m, d] = version.split("-").map(Number)
  return y && m && d ? `${d}. ${m}. ${y}` : version
}

export const LOCKED_MESSAGE =
  "Toto znění je vydané (má zveřejněné PDF) a nesmí se měnit. Pro změnu založte nové znění s pozdějším datem platnosti."

const inForceMessage = (version: string) =>
  `Toto znění platí od ${datum(version)} a mohou se k němu vázat objednávky — nejde ho smazat, stáhnout z webu ani archivovat. ` +
  "Pro změnu založte nové znění s pozdějším datem platnosti."

const KEY_IN_FORCE_MESSAGE =
  "U znění, které už platí, nejde měnit dokument ani datum platnosti — datum je číslo verze uložené u objednávek. " +
  "Pro změnu založte nové znění s pozdějším datem platnosti."

const lockedKeyMessage = (title: string, version: string) =>
  `${title} platné od ${datum(version)} je vydané znění (má zveřejněné PDF). Nové znění musí mít jiné, pozdější datum platnosti.`

const duplicateMessage = (title: string, version: string) =>
  `${title} platné od ${datum(version)} už ve Studiu je. Upravte ten záznam, nebo zvolte jiné datum platnosti.`

const unpublishableMessage = (reason: string) =>
  `Tohle znění by web nezobrazil, proto se nepublikuje: ${reason}. Opravte to a publikujte znovu (koncept zůstal uložený).`

const BAD_PATH_MESSAGE = "Neplatná cesta k poli — úprava se neprovede."

const retroMessage = (version: string) =>
  `Nové znění nemůže platit zpětně — datum platnosti ${datum(version)} už minulo. Zvolte dnešní nebo pozdější datum.`

/* --------------------------------------------------------------- pomocné -- */

const ALLOW: GuardVerdict = { allow: true }

const refuse = (status: number, code: "forbidden" | "invalid", message: string): GuardVerdict => ({
  allow: false,
  status,
  code,
  message,
})

const isFilled = (body: GuardBody | null | undefined): body is GuardBody =>
  Boolean(body && typeof body === "object" && Object.keys(body).length)

type Key = { slug: string; version: string }

const keyOf = (body: GuardBody | null | undefined): Key | null => {
  if (!body) return null
  const slug = typeof body.dokument === "string" ? body.dokument : ""
  const version = typeof body.platnost === "string" ? body.platnost : ""
  return slug && version ? { slug, version } : null
}

const sameKey = (a: Key | null, b: Key | null) =>
  Boolean(a && b && a.slug === b.slug && a.version === b.version)

/** Publikované tělo (`data`), jen když dokument opravdu publikovaný je. */
const publishedBody = (doc: GuardStoredDoc): GuardBody | null =>
  doc.status === "published" && isFilled(doc.data) ? doc.data : null

/** Tělo, se kterým editor pracuje (Smlouva 3 ValeCMS: `draft ?? data`). */
const editableBody = (doc: GuardStoredDoc): GuardBody | null =>
  isFilled(doc.draft) ? doc.draft : isFilled(doc.data) ? doc.data : null

/** Klíč, pod kterým dokument „je" — publikovaný, jinak rozepsaný. */
const storedKey = (doc: GuardStoredDoc): Key | null => keyOf(publishedBody(doc) ?? editableBody(doc))

/** Už platilo? = publikované s datem dnes nebo dřív. */
const inForceVersion = (doc: GuardStoredDoc, today: string): string | null => {
  const key = keyOf(publishedBody(doc))
  return key && key.version <= today ? key.version : null
}

/** Obsazuje jiný živý (nearchivovaný) dokument tenhle klíč — publikovaně nebo konceptem? */
const duplicateOf = (key: Key, ctx: GuardContext, selfId: string | null): boolean =>
  ctx.siblings.some((other) => {
    if (other.id === selfId || other.archivedAt) return false
    return sameKey(keyOf(publishedBody(other)), key) || sameKey(keyOf(editableBody(other)), key)
  })

/**
 * Kontroly nového klíče (založení, změna data, publikace, obnovení):
 * vydaná verze se nesmí založit znovu a jeden klíč nesmí mít dva dokumenty.
 */
const checkNewKey = (key: Key | null, ctx: GuardContext, selfId: string | null): GuardVerdict => {
  if (!key) return ALLOW // bez dokumentu/data ho nepustí validace typu
  const title = ctx.titleOf?.(key.slug) ?? key.slug
  if (ctx.isLocked(key.slug, key.version)) return refuse(423, "forbidden", lockedKeyMessage(title, key.version))
  if (duplicateOf(key, ctx, selfId)) return refuse(409, "invalid", duplicateMessage(title, key.version))
  return ALLOW
}

/** Úprava těla (PUT celého, PATCH dokumentu/data) — pravidla 1–3. */
const checkEdit = (stored: GuardStoredDoc, next: GuardBody | null, ctx: GuardContext): GuardVerdict => {
  const nextKey = keyOf(next)
  const inForce = inForceVersion(stored, ctx.today)
  if (inForce && !sameKey(keyOf(publishedBody(stored)), nextKey)) {
    return refuse(423, "forbidden", KEY_IN_FORCE_MESSAGE)
  }
  // Klíč se kontroluje jen při změně: uložení bez změny data nesmí spadnout
  // kvůli duplicitě, která vznikla před zámkem (vyřeší se při publikaci).
  const editableKey = keyOf(editableBody(stored))
  if (!sameKey(editableKey, nextKey)) return checkNewKey(nextKey, ctx, stored.id)
  return ALLOW
}

/* ------------------------------------------------------------ rozhodnutí -- */

export const legalGuardDecision = (op: GuardOperation, ctx: GuardContext): GuardVerdict => {
  if (op.kind === "create") {
    if (op.type !== LEGAL_CMS_TYPE) return ALLOW
    // Koncept smí mít i minulé datum — opraví se před publikací (pravidlo 4).
    return checkNewKey(keyOf(op.data), ctx, null)
  }

  const stored = ctx.stored
  // Neznámé id nebo jiný typ: rozhodne obsluha CMS (404, oprávnění…).
  if (!stored || stored.type !== LEGAL_CMS_TYPE) return ALLOW

  const key = storedKey(stored)
  const locked = Boolean(key && ctx.isLocked(key.slug, key.version))

  // Zahodit koncept jde vždy — vrací publikovanou podobu, na webu nic nemění.
  if (op.kind === "discardDraft") return ALLOW
  if (locked) return refuse(423, "forbidden", LOCKED_MESSAGE)

  switch (op.kind) {
    case "update":
      return checkEdit(stored, op.data, ctx)

    case "patch": {
      // Nečitelná cesta: odmítnout, ne pustit dál — kdyby ji ValeCMS přečetla
      // jinak než my, prošla by změna data bez kontroly.
      if (!op.segments) return refuse(422, "invalid", BAD_PATH_MESSAGE)
      const top = op.segments[0]
      if (top !== "dokument" && top !== "platnost") return ALLOW
      // Zápis do vnitřku pole (`platnost.0`) dokument ani datum nenastaví.
      if (op.segments.length > 1) return refuse(422, "invalid", BAD_PATH_MESSAGE)
      const next = { ...(editableBody(stored) ?? {}), [top]: op.value }
      return checkEdit(stored, next, ctx)
    }

    case "delete": {
      const inForce = inForceVersion(stored, ctx.today)
      return inForce ? refuse(423, "forbidden", inForceMessage(inForce)) : ALLOW
    }

    case "transition": {
      switch (op.action) {
        case "unpublish":
        case "archive":
        case "reject": {
          const inForce = inForceVersion(stored, ctx.today)
          return inForce ? refuse(423, "forbidden", inForceMessage(inForce)) : ALLOW
        }

        case "restore":
        case "requeue": {
          const keyCheck = checkNewKey(storedKey(stored), ctx, stored.id)
          if (!keyCheck.allow) return keyCheck
          // Obnovení vrací na web publikované tělo — to musí web přijmout.
          const published = publishedBody(stored)
          const problem = published ? ctx.problemOf?.(published) : null
          return problem ? refuse(422, "invalid", unpublishableMessage(problem)) : ALLOW
        }

        case "publish": {
          const next = editableBody(stored)
          const nextKey = keyOf(next)
          const published = keyOf(publishedBody(stored))
          const inForce = inForceVersion(stored, ctx.today)
          if (inForce && !sameKey(published, nextKey)) return refuse(423, "forbidden", KEY_IN_FORCE_MESSAGE)
          const keyCheck = checkNewKey(nextKey, ctx, stored.id)
          if (!keyCheck.allow) return keyCheck
          // Pravidlo 4: minulé datum smí jen znění, které s ním už publikované je.
          if (nextKey && nextKey.version < ctx.today && !sameKey(published, nextKey)) {
            return refuse(422, "invalid", retroMessage(nextKey.version))
          }
          // Pravidlo 5: tělo, které by registr zahodil, se nepublikuje.
          const problem = next ? ctx.problemOf?.(next) : null
          if (problem) return refuse(422, "invalid", unpublishableMessage(problem))
          return ALLOW
        }

        default:
          return ALLOW
      }
    }
  }
  return ALLOW
}

/*
 * Cesta k poli přesně jako `splitPath` v ValeCMS (server/fieldPatch.js):
 * ořezat, rozdělit tečkami, každý kus jméno pole nebo index, nejvýš 8 kusů,
 * žádné `__proto__` & spol. Cokoli jiného = `null` (zámek odmítne).
 */
const FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/
const FIELD_INDEX = /^(0|[1-9][0-9]*)$/
const FORBIDDEN_SEGMENTS = ["__proto__", "constructor", "prototype"]

export const fieldSegments = (path: unknown): string[] | null => {
  const raw = String(path ?? "").trim()
  if (!raw) return null
  const segments = raw.split(".")
  if (segments.length > 8) return null
  for (const segment of segments) {
    if (FORBIDDEN_SEGMENTS.indexOf(segment) !== -1) return null
    if (!FIELD_NAME.test(segment) && !FIELD_INDEX.test(segment)) return null
  }
  return segments
}

/**
 * Která operace to je, podle metody a segmentů za `/api/cms` — nebo `null`,
 * když se požadavek dokumentů netýká nebo nic nemění (čtení projde bez dotazu
 * do úložiště).
 */
export const guardOperationOf = (
  method: string,
  segments: string[],
  body: GuardBody | null
): { op: GuardOperation; id: string | null } | null => {
  const [head, id, action] = segments
  if (head !== "documents") return null
  const verb = method.toUpperCase()
  if (verb === "GET" || verb === "HEAD" || verb === "OPTIONS") return null

  if (!id) {
    if (verb !== "POST") return null
    const type = typeof body?.type === "string" ? body.type : ""
    const data = body?.data && typeof body.data === "object" ? (body.data as GuardBody) : null
    return { op: { kind: "create", type, data }, id: null }
  }

  if (action === "field") {
    if (verb !== "PATCH") return null
    return { op: { kind: "patch", segments: fieldSegments(body?.field), value: body?.value ?? null }, id }
  }
  if (action === "draft") return verb === "DELETE" ? { op: { kind: "discardDraft" }, id } : null
  if (action) return verb === "POST" ? { op: { kind: "transition", action }, id } : null

  if (verb === "PUT") {
    const data = body?.data && typeof body.data === "object" ? (body.data as GuardBody) : null
    return { op: { kind: "update", data }, id }
  }
  if (verb === "DELETE") return { op: { kind: "delete" }, id }
  return null
}
