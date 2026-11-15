// Právní otázky stránky Dotazy z repa do Studia (typy `qna` a `qnaKategorie`).
//
// Spuštění (ze složky storefront):
//   node --import ./scripts/lib/ts-register.mjs scripts/seed-faq.mjs            # nasucho
//   node --import ./scripts/lib/ts-register.mjs scripts/seed-faq.mjs --write    # zapsat
//
// Volby:
//   --write                       založit chybějící otázky a kategorie (bez něj jen výpis plánu)
//   --i-know-this-is-production   povinné k --write, když cílem není souborové úložiště
//   --no-env                      nenačítat .env.local / .env (prostředí jen z procesu)
//
// Do 15. 11. 2026 byla sekce „Práva a podmínky" na stránce Dotazy napevno
// v kódu (`src/lib/legal/faq.ts`) a Lucie ji nemohla opravit. Teď je každá
// otázka běžný dokument `qna` ve Studiu a název skupiny je její kategorie
// (Zakázková výroba, Kurzy, Dárkové poukazy, …) — stejné čipy filtru jako
// u ostatních otázek.
//
// Opakované spuštění nic nerozbije: otázka se hledá podle `legacy_id`
// (id z repa) i podle znění otázky, kategorie podle názvu. Co ve Studiu už
// je, se NEPŘEPÍŠE — seed zakládá výchozí stav, opravy dělá Lucie ve Studiu.
//
// Nové otázky jdou za ty stávající (pořadí = nejvyšší dosavadní + 10, 20, …),
// nové kategorie za stávající čipy.

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
  console.log(`\nPrávní otázky Dotazů do CMS${WRITE ? "" : "  (nasucho)"}`)
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
  const bodyOf = (doc) => doc.draft ?? doc.data ?? {}

  const questions = await listAll("qna")
  const categories = await listAll("qnaKategorie")

  const seededIds = new Set(
    (await documents.listByLegacySource({ source: LEGACY_SOURCE }))
      .map((doc) => doc.legacyId ?? doc.legacy_id)
      .filter(Boolean)
  )
  const knownQuestions = new Set(questions.map((doc) => normalize(bodyOf(doc).question)))
  const knownCategories = new Set(categories.map((doc) => normalize(bodyOf(doc).nazev)))

  const maxOf = (rows) =>
    rows.reduce((max, doc) => {
      const value = Number(bodyOf(doc).poradi)
      return Number.isFinite(value) && value > max ? value : max
    }, 0)
  let nextQuestion = maxOf(questions)
  let nextCategory = maxOf(categories)

  console.log(`Ve Studiu: ${questions.length} otázek, ${categories.length} kategorií.\n`)

  const insert = async (type, data, legacyId) => {
    const now = new Date().toISOString()
    return documents.importRow({
      id: crypto.randomUUID(),
      type,
      status: "published",
      data,
      draft: null,
      created_at: now,
      updated_at: now,
      published_at: now,
      legacy_source: LEGACY_SOURCE,
      legacy_id: legacyId,
    })
  }

  let created = 0
  let kept = 0

  for (const group of LEGAL_FAQ) {
    const categoryKey = `kategorie:${group.id}`
    if (knownCategories.has(normalize(group.title)) || seededIds.has(categoryKey)) {
      kept += 1
      console.log(`  = kategorie „${group.title}" už ve Studiu je`)
    } else {
      nextCategory += 1
      const data = { nazev: group.title, poradi: nextCategory }
      if (WRITE) await insert("qnaKategorie", data, categoryKey)
      knownCategories.add(normalize(group.title))
      created += 1
      console.log(`  + kategorie „${group.title}" (pořadí ${nextCategory})`)
    }

    for (const item of group.items) {
      if (seededIds.has(item.id) || knownQuestions.has(normalize(item.question))) {
        kept += 1
        console.log(`  =   „${item.question}" už ve Studiu je — nepřepisuji`)
        continue
      }
      nextQuestion += 10
      const data = {
        question: item.question,
        answer: legalFaqAnswerText(item),
        kategorie: group.title,
        poradi: nextQuestion,
      }
      if (WRITE) await insert("qna", data, item.id)
      created += 1
      console.log(`  +   „${item.question}" → ${group.title} (pořadí ${nextQuestion})`)
    }
  }

  console.log(
    `\n${WRITE ? "Založeno" : "Založím"}: ${created} · beze změny: ${kept}` +
      (WRITE ? "" : "\nNic se nezapsalo — zápis s --write.")
  )
}

main().catch((error) => {
  console.error(`\n${error.message}`)
  process.exit(1)
})
