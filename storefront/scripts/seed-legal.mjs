// Právní dokumenty z repa do Studia (typ `pravniDokument`, docs/cms/00-plan.md, C).
//
// Spuštění (ze složky storefront):
//   node --import ./scripts/lib/ts-register.mjs scripts/seed-legal.mjs            # nasucho
//   node --import ./scripts/lib/ts-register.mjs scripts/seed-legal.mjs --write    # zapsat
//
// Volby:
//   --write                       založit chybějící dokumenty (bez něj jen výpis plánu)
//   --i-know-this-is-production   povinné k --write, když cílem není souborové úložiště
//                                 (Supabase / Postgres) — viz níž
//   --no-env                      nenačítat .env.local / .env (prostředí jen z procesu)
//
// Založí jeden dokument za každou verzi v repu (`src/lib/legal/documents`, TS
// moduly i otisky) — publikovaný, s revizí v archivu, aby měl Studio od prvního
// dne celé znění, ze kterého se dá vyjít při psaní nového. Vydané verze (se
// zveřejněným PDF) se založí taky: ve Studiu jsou vidět jako „Vydané (PDF) —
// uzamčeno", web je ale dál bere z repa a zámek je nepustí změnit.
//
// ---------------------------------------------------------------------------
// Opakované spuštění nic nerozbije
//
// Hledá se přes `legacy_source: "pravni-dokument"` + `legacy_id: slug@verze`
// (a pro jistotu i podle `dokument@platnost` u dokumentů založených ve Studiu).
// Existující dokument se NEPŘEPÍŠE: seed zakládá výchozí stav, ne pravdu —
// druhé spuštění by jinak tiše vrátilo Luciiny úpravy zpátky na znění z repa.
//
// ---------------------------------------------------------------------------
// Proti omylu do produkce
//
// Bez Supabase/Postgresu zapisuje ValeCMS do souborového úložiště
// (`.cms-dev/store.json`, nebo `CMS_FILE_STORE_DIR`). Jakmile je nastavené
// NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY nebo DATABASE_URL, míří
// zápis do ostrého CMS — a to se pustí jen s výslovným
// `--i-know-this-is-production`. Skript vždy napíše, kam zapisuje.
// (Dřívější seedy chtěly DATABASE_URL i tam, kde se jede na Supabase; tady
// rozhoduje totéž, co rozhoduje `getAdminClient` v knihovně.)

import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const args = new Set(process.argv.slice(2))
const WRITE = args.has("--write")
const PRODUCTION_OK = args.has("--i-know-this-is-production")
// --refresh: pracovní znění, která skript dřív založil a ve Studiu je od té
// doby NIKDO neupravil, přepíše aktuálním zněním z repa (opravy v kódu se jinak
// na web nedostanou — znění ve Studiu má před repem přednost). Upravená ve
// Studiu, vydaná (PDF) a s rozpracovaným konceptem nechá být.
const REFRESH = args.has("--refresh")
const known = new Set(["--write", "--refresh", "--i-know-this-is-production", "--no-env"])
for (const arg of args) {
  if (!known.has(arg)) {
    console.error(`Neznámý přepínač ${arg}. Povolené: ${[...known].join(", ")}`)
    process.exit(2)
  }
}

// Prostředí si skript načte sám (neběží v Nextu). Proměnnou, která už v procesu
// JE — i prázdnou —, soubor nepřepíše: `SUPABASE_SERVICE_ROLE_KEY=""` z příkazové
// řádky tak spolehlivě znamená „souborové úložiště", ne „vezmi klíč z .env.local".
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

/** Kam knihovna zapíše — stejné pořadí jako `getAdminClient` (supabaseAdmin.js). */
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
    // Supabase URL bez klíče: knihovna píše do souboru, ale je to znamení, že
    // tohle prostředí patří k ostrému webu — radši se zeptat.
    production: filled("NEXT_PUBLIC_SUPABASE_URL"),
    label: `souborové úložiště ${path.join(dir, "store.json")}`,
  }
}

const main = async () => {
  const target = describeTarget()
  console.log(`\nPrávní dokumenty do CMS${WRITE ? "" : "  (nasucho)"}`)
  console.log(`Cíl: ${target.label}\n`)

  if (WRITE && target.production && !PRODUCTION_OK) {
    throw new Error(
      "Tohle prostředí míří do ostrého CMS (nastavené NEXT_PUBLIC_SUPABASE_URL / " +
        "SUPABASE_SERVICE_ROLE_KEY / DATABASE_URL). Zápis jen s výslovným --i-know-this-is-production."
    )
  }

  const { ALL_VERSIONS } = await import("../src/lib/legal/documents/index.ts")
  const { toCmsBody, fromCmsBody, sameLegalText, legalKey, LEGAL_CMS_TYPE, LEGAL_CMS_LEGACY_SOURCE } =
    await import("../src/lib/legal/cms.ts")

  // Otisk znění, které skript zapsal — ukládá se do interní poznámky
  // (`[seed-legal:…]`). Při dalším --refresh se podle něj pozná, jestli znění
  // ve Studiu od té doby někdo upravil: upravené se nepřepisuje.
  const textHash = (doc) =>
    crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          title: doc.title,
          summary: doc.summary ?? null,
          sections: doc.sections,
        })
      )
      .digest("hex")
      .slice(0, 16)
  const MARK = /\[seed-legal:([0-9a-f]{16})\]/
  const noteFor = (doc, verb) =>
    `${verb} skriptem seed-legal ze znění v repu (${new Date().toISOString().slice(0, 10)}). [seed-legal:${textHash(doc)}]`
  const { PDF_ENTRIES } = await import("../src/lib/legal/registry.ts")
  const { isPublishedPdfUrl } = await import("../src/lib/legal/pdf-published.ts")
  const { getAdminClient, createDocumentRepository, createRevisionRepository } = await import(
    "@c3studium/valecms/server"
  )

  const client = getAdminClient()
  const documents = createDocumentRepository({ client })
  const revisions = createRevisionRepository({ client })

  const bySeed = new Map(
    (await documents.listByLegacySource({ source: LEGAL_CMS_LEGACY_SOURCE })).map((doc) => [
      doc.legacyId ?? doc.legacy_id,
      doc,
    ])
  )
  // Dokumenty založené ve Studiu (bez legacy_id) — podle klíče z publikovaného
  // těla i konceptu. Archivované taky: obnovit je jde a byla by z nich duplicita.
  // Po stránkách — jeden dotaz ValeCMS vrací nejvýš 100 dokumentů.
  const rows = []
  for (let page = 1; ; page += 1) {
    const result = await documents.list({ type: LEGAL_CMS_TYPE, page, perPage: 100, archived: "all" })
    rows.push(...result.rows)
    if (rows.length >= result.total || result.rows.length < 100) break
  }
  const byKey = new Set()
  for (const doc of rows) {
    for (const body of [doc.data, doc.draft]) {
      if (body?.dokument && body?.platnost) byKey.add(legalKey(body.dokument, body.platnost))
    }
  }

  const locked = new Set(
    PDF_ENTRIES.filter((entry) => isPublishedPdfUrl(entry.url)).map((entry) =>
      legalKey(entry.slug, entry.version)
    )
  )

  const versions = [...ALL_VERSIONS].sort(
    (a, b) => a.slug.localeCompare(b.slug) || a.version.localeCompare(b.version)
  )
  let created = 0
  let kept = 0
  let refreshed = 0

  for (const doc of versions) {
    const key = legalKey(doc.slug, doc.version)
    const mark = locked.has(key) ? "🔒" : "· "
    if (bySeed.has(key) || byKey.has(key)) {
      const seeded = bySeed.get(key)
      if (!REFRESH || !seeded || locked.has(key)) {
        kept += 1
        console.log(`  = ${mark} ${key.padEnd(36)} už v CMS — nepřepisuji`)
        continue
      }
      // --refresh: jen znění, které skript založil a nikdo ho ve Studiu neupravil.
      const current = fromCmsBody(seeded.data).doc
      const note = String(seeded.data?.poznamka ?? "")
      const mark2 = MARK.exec(note)
      const created_ = String(seeded.createdAt ?? seeded.created_at ?? "")
      const updated_ = String(seeded.updatedAt ?? seeded.updated_at ?? "")
      const untouched = current
        ? mark2
          ? mark2[1] === textHash(current)
          : created_ !== "" && created_ === updated_
        : false
      if (seeded.draft) {
        kept += 1
        console.log(`  = ${mark} ${key.padEnd(36)} ve Studiu je rozpracovaný koncept — nepřepisuji`)
        continue
      }
      if (current && sameLegalText(current, doc)) {
        kept += 1
        console.log(`  = ${mark} ${key.padEnd(36)} ve Studiu je totéž znění jako v repu`)
        continue
      }
      if (!untouched) {
        kept += 1
        console.log(`  ! ${mark} ${key.padEnd(36)} upravené ve Studiu — nepřepisuji, rozdíl doplňte ručně`)
        continue
      }
      if (!WRITE) {
        refreshed += 1
        console.log(`  ~ ${mark} ${key.padEnd(36)} přepíšu aktuálním zněním z repa (ve Studiu neupravené)`)
        continue
      }
      await documents.update({ id: seeded.id, data: toCmsBody(doc, noteFor(doc, "Obnoveno")) })
      const published = await documents.publish({ id: seeded.id })
      try {
        await revisions.record({ document: published, reason: "publish", at: new Date().toISOString() })
      } catch (error) {
        console.warn(`    ! revize k ${key} se nezapsala: ${error.message}`)
      }
      refreshed += 1
      console.log(`  ~ ${mark} ${key.padEnd(36)} přepsáno aktuálním zněním z repa`)
      continue
    }

    const body = toCmsBody(doc, noteFor(doc, "Založeno"))
    const bytes = Buffer.byteLength(JSON.stringify(body), "utf8")

    if (!WRITE) {
      created += 1
      console.log(`  + ${mark} ${key.padEnd(36)} „${doc.title}" — ${doc.sections.length} kapitol, ${(bytes / 1024).toFixed(1)} kB`)
      continue
    }

    const now = new Date().toISOString()
    const inserted = await documents.importRow({
      id: crypto.randomUUID(),
      type: LEGAL_CMS_TYPE,
      status: "published",
      data: body,
      draft: null,
      created_at: now,
      updated_at: now,
      published_at: now,
      legacy_source: LEGAL_CMS_LEGACY_SOURCE,
      legacy_id: key,
    })
    // `importRow` revizi nepíše (píše ji jen Studio při publikaci) — archiv má
    // ale vědět, odkdy a s jakým tělem dokument v CMS je.
    try {
      await revisions.record({ document: inserted, reason: "publish", at: now })
    } catch (error) {
      console.warn(`    ! revize k ${key} se nezapsala: ${error.message}`)
    }
    created += 1
    console.log(`  + ${mark} ${key.padEnd(36)} „${doc.title}" — založeno (${inserted.id})`)
  }

  console.log(
    `\n${WRITE ? "Hotovo" : "Nasucho"}: ${created} ${WRITE ? "založeno" : "k založení"}, ` +
      `${refreshed} ${WRITE ? "přepsáno" : "k přepsání"} zněním z repa, ${kept} ponecháno beze změny.`
  )
  if (!WRITE && (created || refreshed)) console.log("Spusťte znovu s --write.")
  console.log("🔒 = vydané znění (PDF zveřejněné) — ve Studiu jen pro čtení, web ho bere z repa.\n")
}

main().catch((error) => {
  console.error(`\nSeed selhal: ${error.message}\n`)
  process.exitCode = 1
})
