import "server-only"

// Jmenný import: deklarace knihovny popisují `@c3studium/valecms/server` jen
// jako `Record<string, unknown>` (export =), jednotlivé funkce v nich nejsou.
import * as cmsServer from "@c3studium/valecms/server"

import {
  guardOperationOf,
  legalGuardDecision,
  type GuardBody,
  type GuardStoredDoc,
} from "@lib/legal/cms-guard"
import { fromCmsBody } from "@lib/legal/cms"
import { LEGAL_CMS_TYPE } from "@lib/legal/cms-type"
import { isPublishedPdfUrl } from "@lib/legal/pdf-published"
import { PDF_ENTRIES, pragueToday } from "@lib/legal/registry"
import type { LegalSlug } from "@lib/legal/types"

/**
 * Zámek právních dokumentů — adaptér pro catch-all routu CMS
 * (`app/api/cms/[...route]/route.ts`). Rozhodnutí je čisté
 * (`@lib/legal/cms-guard`); tady se jen přečte, co k němu potřebuje: kdo
 * je přihlášený, uložený dokument, ostatní právní dokumenty a manifest PDF.
 *
 * Vrací `Response` s odmítnutím, nebo `null` = pustit k obsluze ValeCMS.
 *
 * - Čtení (`GET`) a cokoli mimo `/documents` projde bez jediného dotazu.
 * - Nepřihlášený požadavek projde taky — obsluha ho odmítne sama (401) a zámek
 *   tak neprozradí nic o dokumentu, ke kterému volající nemá přístup.
 * - Tělo požadavku se čte z KOPIE (`request.clone()`), obsluha dostane
 *   nedotčený proud.
 * - Když nejde přečíst uložený dokument (úložiště neodpovídá), zámek
 *   odmítne: pustit úpravu, o které nevíme, jestli nemíří na vydané znění,
 *   je horší než chvilková chyba. Obsluha by v té situaci stejně selhala.
 */

/* Tvar toho, co z `@c3studium/valecms/server` opravdu voláme (server/documents.js, auth.js). */
type DocumentRepository = {
  get: (args: { id: string }) => Promise<GuardStoredDoc>
  list: (args: {
    type: string
    page?: number
    perPage?: number
    archived?: boolean | "all"
  }) => Promise<{ rows: GuardStoredDoc[]; total: number }>
}
const server = cmsServer as unknown as {
  createDocumentRepository: (args: { client: unknown }) => DocumentRepository
  getAdminClient: () => unknown
  getSessionUser: (req: { headers: Record<string, string> }) => Promise<unknown>
}
const repository = () => server.createDocumentRepository({ client: server.getAdminClient() })
const sessionUser = (req: { headers: Record<string, string> }) => server.getSessionUser(req)

const TITLES: Record<LegalSlug, string> = {
  "obchodni-podminky": "Obchodní podmínky",
  "reklamacni-rad": "Reklamační řád",
  "reklamacni-protokol": "Reklamační protokol",
  "odstoupeni-od-smlouvy": "Odstoupení od smlouvy",
  "ochrana-osobnich-udaju": "Ochrana osobních údajů",
  cookies: "Používání cookies",
  "doprava-a-platba": "Doprava a platba",
}

const LOCKED_KEYS = new Set(
  PDF_ENTRIES.filter((entry) => isPublishedPdfUrl(entry.url)).map(
    (entry) => `${entry.slug}@${entry.version}`
  )
)

/*
 * Všechny právní dokumenty (i archivované) po stránkách — ValeCMS vrací
 * nejvýš 100 na dotaz (query.js MAX_PER_PAGE). Strop 20 stránek je pojistka
 * proti zacyklení; kdyby právních dokumentů bylo víc, zámek raději odmítne,
 * než aby duplicitu přehlédl.
 */
const PAGE_SIZE = 100
const MAX_PAGES = 20

class TooManyDocuments extends Error {}

const listAllLegalDocuments = async (repo: DocumentRepository): Promise<GuardStoredDoc[]> => {
  const rows: GuardStoredDoc[] = []
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await repo.list({ type: LEGAL_CMS_TYPE, page, perPage: PAGE_SIZE, archived: "all" })
    rows.push(...result.rows)
    if (rows.length >= result.total || result.rows.length < PAGE_SIZE) return rows
  }
  throw new TooManyDocuments(`víc než ${PAGE_SIZE * MAX_PAGES} právních dokumentů`)
}

/** Proč by web tělo nepřijal — stejný převod, jakým ho čte registr. */
const problemOf = (body: GuardBody): string | null => fromCmsBody(body).reason

const refusal = (status: number, code: string, message: string) =>
  Response.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store, max-age=0" } }
  )

const readBody = async (request: Request): Promise<GuardBody | null> => {
  const method = request.method.toUpperCase()
  if (method !== "POST" && method !== "PUT" && method !== "PATCH") return null
  try {
    const parsed = await request.clone().json()
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as GuardBody) : null
  } catch {
    // Prázdné nebo neplatné tělo odmítne obsluha sama (`readJson`).
    return null
  }
}

const isNotFound = (error: unknown) =>
  Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "not_found")

export const guardLegalCmsRequest = async (
  request: Request,
  params: Record<string, string | string[] | undefined>
): Promise<Response | null> => {
  const route = params.route
  const segments = (Array.isArray(route) ? route : [route]).filter(
    (segment): segment is string => typeof segment === "string" && segment.length > 0
  )
  if (segments[0] !== "documents") return null

  const body = await readBody(request)
  const parsed = guardOperationOf(request.method, segments, body)
  if (!parsed) return null
  // Založení jiného typu se úložiště vůbec netýká.
  if (parsed.op.kind === "create" && parsed.op.type !== LEGAL_CMS_TYPE) return null

  let user: unknown = null
  try {
    user = await sessionUser({ headers: Object.fromEntries(request.headers.entries()) })
  } catch {
    // Ověření přihlášení selhalo — totéž selže v obsluze a ta odpoví sama.
    return null
  }
  if (!user) return null

  try {
    const repo = repository()
    let stored: GuardStoredDoc | null = null
    if (parsed.id) {
      try {
        stored = await repo.get({ id: parsed.id })
      } catch (error) {
        if (!isNotFound(error)) throw error
        return null // neexistuje → 404 z obsluhy
      }
      if (stored?.type !== LEGAL_CMS_TYPE) return null
    }

    const siblings = await listAllLegalDocuments(repo)
    const verdict = legalGuardDecision(parsed.op, {
      stored,
      siblings,
      today: pragueToday(),
      isLocked: (slug, version) => LOCKED_KEYS.has(`${slug}@${version}`),
      titleOf: (slug) => TITLES[slug as LegalSlug] ?? slug,
      problemOf,
    })
    if (verdict.allow) return null

    console.warn(
      `[legal] Studio: odmítnuto ${request.method} /api/cms/${segments.join("/")} — ${verdict.message}`
    )
    return refusal(verdict.status, verdict.code, verdict.message)
  } catch (error) {
    console.error("[legal] Zámek právních dokumentů se nepodařilo ověřit.", error)
    return refusal(
      503,
      "server",
      "Teď nejde ověřit, jestli úprava nemíří na vydané znění právního dokumentu. Zkuste to prosím za chvíli."
    )
  }
}
