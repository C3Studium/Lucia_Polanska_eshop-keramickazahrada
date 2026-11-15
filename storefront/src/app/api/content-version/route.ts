import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { getTexty } from "@lib/data/texty"
import { getLegalFacts } from "@lib/data/legal-facts"

export const dynamic = "force-dynamic"

/**
 * Verze obsahu webu (15. 11. 2026, Matěj: „klientka si nevzpomene na
 * Ctrl+Shift+R"). Otisk všeho, co se mění mimo nasazení:
 *
 * - Texty obchodu a Právní údaje z administrace (po uložení je backend
 *   rovnou obnoví — `refreshStorefront`),
 * - poslední změna čehokoli ve Studiu (dokument seřazený podle `updated_at`).
 *
 * Otevřená stránka se sem ptá (`ContentFreshness`) a při jiné verzi si
 * načte data znovu — bez přenačtení celé stránky. Odpověď je v paměti 10 s,
 * aby sto otevřených karet nedělalo sto dotazů do CMS.
 */
let memo: { at: number; version: string } | null = null
const MEMO_MS = 10_000

const latestCmsChange = async (): Promise<string> => {
  try {
    const { getAdminClient, createDocumentRepository } = (await import(
      "@c3studium/valecms/server"
    )) as unknown as {
      getAdminClient: () => unknown
      createDocumentRepository: (options: { client: unknown }) => {
        list: (args: Record<string, unknown>) => Promise<{ rows?: unknown[] }>
      }
    }
    const documents = createDocumentRepository({ client: getAdminClient() })
    const result = await documents.list({ page: 1, perPage: 1, archived: "all" })
    const row = result.rows?.[0] as { updatedAt?: string; updated_at?: string } | undefined
    return String(row?.updatedAt ?? row?.updated_at ?? "")
  } catch {
    return ""
  }
}

export async function GET() {
  const now = Date.now()
  if (!memo || now - memo.at > MEMO_MS) {
    const [texty, facts, cms] = await Promise.all([
      getTexty().catch(() => null),
      getLegalFacts().catch(() => null),
      latestCmsChange(),
    ])
    const version = createHash("sha1")
      .update(JSON.stringify([texty, facts, cms]))
      .digest("hex")
      .slice(0, 16)
    memo = { at: now, version }
  }
  return NextResponse.json(
    { version: memo.version },
    { headers: { "Cache-Control": "no-store" } }
  )
}
