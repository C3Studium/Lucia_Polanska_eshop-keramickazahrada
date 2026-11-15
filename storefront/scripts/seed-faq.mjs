// FAQ stránky Dotazy do Studia — typ `faq`: jedna kategorie = jeden dokument,
// otázky s odpověďmi uvnitř (15. 11. 2026).
//
// Spuštění (ze složky storefront):
//   node --import ./scripts/lib/ts-register.mjs scripts/seed-faq.mjs            # nasucho
//   node --import ./scripts/lib/ts-register.mjs scripts/seed-faq.mjs --write    # zapsat
//
// Volby:
//   --write                       založit kategorie FAQ (bez něj jen výpis plánu)
//   --i-know-this-is-production   povinné k --write, když cílem není souborové úložiště
//   --no-env                      nenačítat .env.local / .env (prostředí jen z procesu)
//
// Převod: dřív byly ve Studiu dvě sekce — „Dotazy" (otázka = dokument,
// kategorie jménem) a „Kategorie dotazů" — a právní otázky napevno v kódu
// (`src/lib/legal/faq.ts`). Skript ze všech tří poskládá kategorie FAQ:
// staré kategorie v jejich pořadí, pod nimi jejich otázky, pak právní
// skupiny (Zakázková výroba a Kurzy se přidají k existujícím, Dárkové poukazy,
// Nezávadnost a bezpečnost a Poškozená zásilka jako nové).
//
// Jednorázově: jakmile ve Studiu nějaká kategorie FAQ je, skript nic nedělá —
// od té chvíle je pravda ve Studiu. Staré dokumenty nemaže.

import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const args = new Set(process.argv.slice(2))
const WRITE = args.has("--write")
const PRODUCTION_OK = args.has("--i-know-this-is-production")
const known = new Set(["--write", "--i-know-this-is-production", "--no-env"])
for (const arg of args) {
  if (!known.has(arg)) {
    console.error(`Neznámý přepínač ${arg}. Povolené: ${[...known].join(", ")}`)
    process.exit(2)
  }
}

// Prostředí jako v seed-legal.mjs: proměnnou, která už v procesu je, soubor nepřepíše.
const loadEnv = (file) => {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (!match) continue
    const [, key, raw] = match
    if (key in process.env) continue
    process.env[key] = raw.replace(/^["']|["']$/g, "")
  }
}
if (!args.has("--no-env")) {
  loadEnv(path.join(ROOT, ".env.local"))
  loadEnv(path.join(ROOT, ".env"))
}

const filled = (name) => Boolean(String(process.env[name] ?? "").trim())

/** Kam knihovna zapíše — stejné pořadí jako `getAdminClient`. */
const describeTarget = () => {
  const dbUrl = process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL || ""
  if (dbUrl.trim()) {
    let host = "?"
    try {
      host = new URL(dbUrl).host
    } catch {}
    return { production: true, label: `Postgres (DATABASE_URL, ${host})` }
  }
  if (filled("SUPABASE_SERVICE_ROLE_KEY")) {
    let host = "?"
    try {
      host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
    } catch {}
    return { production: true, label: `Supabase (${host})` }
  }
  const dir = process.env.CMS_FILE_STORE_DIR || path.join(process.cwd(), ".cms-dev")
  return {
    production: filled("NEXT_PUBLIC_SUPABASE_URL"),
    label: `souborové úložiště ${path.join(dir, "store.json")}`,
  }
}

const LEGACY_SOURCE = "faq-pravni"

/** Malá písmena, bez diakritiky a interpunkce — párování znění otázky. */
const normalize = (text) =>
  String(text ?? "")
    .toLocaleLowerCase("cs")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

const main = async () => {
  const target = describeTarget()
  console.log(`\nFAQ do CMS (kategorie s otázkami)${WRITE ? "" : "  (nasucho)"}`)
  console.log(`Cíl: ${target.label}\n`)

  if (WRITE && target.production && !PRODUCTION_OK) {
    throw new Error(
      "Tohle prostředí míří do ostrého CMS (nastavené NEXT_PUBLIC_SUPABASE_URL / " +
        "SUPABASE_SERVICE_ROLE_KEY / DATABASE_URL). Zápis jen s výslovným --i-know-this-is-production."
    )
  }

  const { LEGAL_FAQ, legalFaqAnswerText } = await import("../src/lib/legal/faq.ts")
  const { getAdminClient, createDocumentRepository } = await import("@c3studium/valecms/server")

  const client = getAdminClient()
  const documents = createDocumentRepository({ client })

  const listAll = async (type) => {
    const rows = []
    for (let page = 1; ; page += 1) {
      const result = await documents.list({ type, page, perPage: 100, archived: "all" })
      rows.push(...result.rows)
      if (rows.length >= result.total || result.rows.length < 100) break
    }
    return rows
  }
  /** Publikované znění (koncept jen u nikdy nepublikovaného). */
  const bodyOf = (doc) => doc.data ?? doc.draft ?? {}
  const isArchived = (doc) => Boolean(doc.archived_at ?? doc.archivedAt)
  const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)

  const existingFaq = await listAll("faq")
  if (existingFaq.some((doc) => !isArchived(doc))) {
    console.log(`Ve Studiu už je ${existingFaq.length} kategorií FAQ — převod proběhl, nic nedělám.`)
    console.log("Další otázky přidávejte ve Studiu → FAQ.")
    return
  }

  // 1) Staré kategorie a otázky (sekce „Kategorie dotazů" a „Dotazy").
  const oldCategories = (await listAll("qnaKategorie")).filter((doc) => !isArchived(doc))
  const oldQuestions = (await listAll("qna")).filter((doc) => !isArchived(doc))
  console.log(`Staré dokumenty: ${oldCategories.length} kategorií, ${oldQuestions.length} otázek.\n`)

  /** nazev → { nazev, poradi, otazky: [{question, answer, poradi}] } */
  const groups = new Map()
  const groupFor = (nazev, poradi) => {
    const key = normalize(nazev)
    if (!groups.has(key)) groups.set(key, { nazev, poradi, otazky: [] })
    return groups.get(key)
  }
  for (const doc of [...oldCategories].sort((a, b) => num(bodyOf(a).poradi) - num(bodyOf(b).poradi))) {
    const nazev = String(bodyOf(doc).nazev ?? "").trim()
    if (nazev) groupFor(nazev, num(bodyOf(doc).poradi))
  }
  let nextPoradi = Math.max(0, ...[...groups.values()].map((group) => group.poradi))
  // Otázky bez kategorie byly na webu jen pod „Vše" — v FAQ musí mít kategorii.
  const BEZ_KATEGORIE = "Ostatní"
  for (const doc of oldQuestions) {
    const body = bodyOf(doc)
    const question = String(body.question ?? "").trim()
    if (!question) continue
    const nazev = String(body.kategorie ?? "").trim() || BEZ_KATEGORIE
    const group =
      groups.get(normalize(nazev)) ??
      groupFor(nazev, nazev === BEZ_KATEGORIE ? Number.MAX_SAFE_INTEGER : (nextPoradi += 1))
    group.otazky.push({ question, answer: String(body.answer ?? "").trim(), poradi: num(body.poradi) })
  }
  for (const group of groups.values()) group.otazky.sort((a, b) => a.poradi - b.poradi)

  // 2) Právní otázky z repa (dřív pevná sekce „Práva a podmínky").
  for (const legal of LEGAL_FAQ) {
    const group = groups.get(normalize(legal.title)) ?? groupFor(legal.title, (nextPoradi += 1))
    const known = new Set(group.otazky.map((item) => normalize(item.question)))
    for (const item of legal.items) {
      if (known.has(normalize(item.question))) continue
      group.otazky.push({ question: item.question, answer: legalFaqAnswerText(item), poradi: Infinity })
    }
  }

  const ordered = [...groups.values()].sort((a, b) => a.poradi - b.poradi)
  let created = 0
  for (const [index, group] of ordered.entries()) {
    const data = {
      nazev: group.nazev,
      poradi: (index + 1) * 10,
      otazky: group.otazky.map(({ question, answer }) => ({ question, answer })),
    }
    console.log(`  + ${group.nazev} (pořadí ${data.poradi}) — ${data.otazky.length} otázek`)
    for (const item of data.otazky) console.log(`      · ${item.question}`)
    if (WRITE) {
      const now = new Date().toISOString()
      await documents.importRow({
        id: crypto.randomUUID(),
        type: "faq",
        status: "published",
        data,
        draft: null,
        created_at: now,
        updated_at: now,
        published_at: now,
        legacy_source: LEGACY_SOURCE,
        legacy_id: `faq:${normalize(group.nazev).replace(/ /g, "-")}`,
      })
    }
    created += 1
  }

  console.log(
    `\n${WRITE ? "Založeno" : "Založím"}: ${created} kategorií FAQ.` +
      (WRITE
        ? "\nStaré dokumenty (Dotazy a Kategorie dotazů) zůstaly v databázi beze změny — web je už nečte."
        : "\nNic se nezapsalo — zápis s --write.")
  )
}

main().catch((error) => {
  console.error(`\n${error.message}`)
  process.exit(1)
})
