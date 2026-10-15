#!/usr/bin/env node
/**
 * pnpm legal:build — PDF právních dokumentů (A4) z tiskové stránky storefrontu.
 *
 * Postup:
 *  1. Zeptá se běžícího storefrontu na seznam verzí (`/api/legal/versions`) —
 *     registr je TypeScript a čisté .mjs ho importovat nemůže.
 *  2. Každou verzi s `pdf: true` otevře v Chromiu (Playwright) na
 *     `/cz/pravni-dokument/<slug>/<verze>` a uloží jako A4 PDF
 *     do `public/legal/<slug>-<verze>.pdf` (název = `pdfFileName()`).
 *  3. Nezměněné verze přeskočí (otisk zdroje `sourceHash` v manifestu).
 *  4. Každé PDF zkontroluje: vložená písma, text čitelný včetně diakritiky.
 *  5. Zapíše `src/lib/legal/pdf-manifest.json` a kopii pro backend
 *     `backend/src/lib/legal/legal-manifest.json` (fakty o prodávající +
 *     verze dokumentů s daty účinnosti) — patička e-mailů čte tytéž údaje.
 *     Do každého záznamu manifestu zapíše `facts` — hodnoty `{{údajů}}`, se
 *     kterými PDF vzniklo; u vydané verze s nimi web vykresluje i stránku.
 *     Záznamu, kterému `facts` chybí a jehož otisk zdroje sedí, je doplní
 *     (shoda otisku dokazuje, že se údaje od tisku nezměnily).
 *  6. Znění, které přišlo ze Studia a v repu ho nikdo nemá, zapíše jako otisk
 *     `src/lib/legal/documents/snapshots/<slug>@<verze>.json` (+ vygeneruje
 *     `snapshots/index.ts`). Po zveřejnění PDF se web vykresluje jen z něj.
 *
 * Vydané znění (PDF se zveřejněnou https adresou) se NIKDY nepřegeneruje: když
 * jeho otisk nesedí (změnil se text v repu nebo fakty v otisku), skript skončí
 * chybou — vydané znění se nesmí měnit, změna = nová verze s pozdějším datem.
 *
 * Použití (storefront musí běžet):
 *   pnpm legal:build                    # BASE_URL výchozí http://localhost:8000
 *   BASE_URL=http://localhost:8123 pnpm legal:build
 *   pnpm legal:build --force            # vygenerovat znovu i nezměněné
 *   pnpm legal:build --only=obchodni-podminky@2026-10-15
 *   pnpm legal:build --check            # nic negenerovat, jen ověřit stav
 *
 * Nahrání do R2 je samostatný krok: `pnpm legal:upload` v backendu.
 */
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { verifyPdfText } from "./legal-pdf-text.mjs"

const STOREFRONT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const REPO = path.resolve(STOREFRONT, "..")
const PUBLIC_DIR = path.join(STOREFRONT, "public", "legal")
const MANIFEST_PATH = path.join(STOREFRONT, "src", "lib", "legal", "pdf-manifest.json")
const SNAPSHOT_DIR = path.join(STOREFRONT, "src", "lib", "legal", "documents", "snapshots")
const SNAPSHOT_INDEX = path.join(SNAPSHOT_DIR, "index.ts")
const BACKEND_MANIFEST_PATH = path.join(
  REPO,
  "backend",
  "src",
  "lib",
  "legal",
  "legal-manifest.json"
)

/**
 * Revize voleb tisku (okraje, zápatí, normalizace). Zvýšit při změně —
 * všechna PDF se pak vygenerují znovu. Vzhled stránky má vlastní revizi
 * (`PRINT_LAYOUT_REVISION` v modules/legal-print/meta.ts).
 */
const PDF_OPTIONS_REVISION = 1

const HELP = `pnpm legal:build [--force] [--check] [--strict] [--only=<slug>[@<verze>],…] [--base-url=<url>]

  --force      vygenerovat znovu i PDF, jejichž zdroj se nezměnil (vydaná PDF
               v R2 nikdy — ta se nepřegenerovávají)
  --check      nic negenerovat ani nezapisovat — jen ověřit PDF, manifesty
               (i \`facts\` v záznamech) a otisky znění ze Studia
  --strict     kontrola před spuštěním obchodu: chybou skončí i „PLATNÉ, ALE
               NEVYDANÉ" (znění, které už platí, ale jeho PDF není zveřejněné).
               Kontrola na ostro: pnpm legal:build --check --strict
  --only=…     jen vybrané dokumenty / verze (čárkou, lze opakovat)
  --base-url=… adresa běžícího storefrontu (nebo proměnná BASE_URL),
               výchozí http://localhost:8000`

const parseArgs = (argv) => {
  const options = { force: false, check: false, strict: false, only: [], baseUrl: null, help: false }
  for (const arg of argv) {
    if (arg === "--force") options.force = true
    else if (arg === "--check") options.check = true
    else if (arg === "--strict") options.strict = true
    else if (arg === "--help" || arg === "-h") options.help = true
    else if (arg.startsWith("--only=")) {
      options.only.push(...arg.slice(7).split(",").map((item) => item.trim()).filter(Boolean))
    } else if (arg.startsWith("--base-url=")) options.baseUrl = arg.slice(11)
    else {
      console.error(`Neznámý přepínač ${arg}\n\n${HELP}`)
      process.exit(2)
    }
  }
  return options
}

const sha256 = (data) => createHash("sha256").update(data).digest("hex")

/** „15. 10. 2026" z `2026-10-15` — stejně jako `formatVersionDate()` v registru. */
const formatVersionDate = (version) => {
  const [y, m, d] = String(version).split("-").map(Number)
  return y && m && d ? `${d}. ${m}. ${y}` : version
}

const escapeHtml = (text) =>
  String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

const formatSize = (bytes) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} kB`
    : `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`

const readJson = async (file, fallback) => {
  try {
    return JSON.parse(await readFile(file, "utf8"))
  } catch (error) {
    if (error?.code === "ENOENT") return fallback
    throw new Error(`${path.relative(REPO, file)} není platný JSON: ${error.message}`)
  }
}

/** Zapíše JSON jen při změně. Vrací, zda se soubor změnil. */
const writeJsonIfChanged = async (file, value, dryRun) =>
  writeTextIfChanged(file, `${JSON.stringify(value, null, 2)}\n`, dryRun)

/** Zapíše text jen při změně. Vrací, zda se soubor změnil. */
const writeTextIfChanged = async (file, next, dryRun) => {
  let current = null
  try {
    current = await readFile(file, "utf8")
  } catch {
    current = null
  }
  if (current === next) return false
  if (!dryRun) {
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, next, "utf8")
  }
  return true
}

/** `obchodni-podminky@2026-11-01.json` — klíč verze je i jméno otisku. */
const snapshotFile = (version) => `${version.slug}@${version.version}.json`

/**
 * `snapshots/index.ts` se statickými importy všech otisků ve složce — Next je
 * tak zabalí do serverového balíku. Hlavička je stejná jako u ručně založeného
 * souboru, takže běh bez otisků soubor nezmění.
 */
const snapshotIndex = (files) => {
  const imports = files.map((file, index) => `import snapshot${index} from "./${file}"`)
  const list = files.map((_, index) => `  snapshot${index} as unknown as LegalDocumentVersion,`)
  return [
    "// Generuje `pnpm legal:build` (storefront/scripts/legal-build.mjs) — needitovat ručně.",
    "//",
    "// Otisky znění právních dokumentů, jejichž text přišel ze Studia (typ",
    "// „Právní dokumenty\"). Soubor `<slug>@<verze>.json` je přesně to znění,",
    "// ze kterého `legal:build` vytiskl PDF; po zveřejnění PDF (`legal:upload`)",
    "// se web vykresluje jen z něj, ne z CMS. Statické importy, aby je Next",
    "// zabalil do serverového balíku.",
    'import type { LegalDocumentVersion } from "../../types"',
    ...imports,
    "",
    files.length
      ? `export const SNAPSHOTS: LegalDocumentVersion[] = [\n${list.join("\n")}\n]`
      : "export const SNAPSHOTS: LegalDocumentVersion[] = []",
    "",
  ].join("\n")
}

const listSnapshotFiles = async () => {
  try {
    return (await readdir(SNAPSHOT_DIR)).filter((file) => /^[a-z0-9-]+@\d{4}-\d{2}-\d{2}\.json$/.test(file))
  } catch (error) {
    if (error?.code === "ENOENT") return []
    throw error
  }
}

/** Otisk faktů v pevném pořadí klíčů (stabilní diff manifestu). */
const sortedFacts = (facts) =>
  facts && typeof facts === "object"
    ? Object.fromEntries(Object.keys(facts).sort().map((key) => [key, facts[key] ?? null]))
    : undefined

const fail = (message) => {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}

/** Seznam verzí z běžícího storefrontu, s lidskou chybou, když neběží. */
const fetchVersions = async (baseUrl) => {
  const endpoint = new URL("/api/legal/versions", baseUrl).toString()
  let response
  try {
    // První požadavek na dev server kompiluje routu — proto štědrý limit.
    response = await fetch(endpoint, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(180_000),
    })
  } catch (error) {
    const code = error?.cause?.code ?? error?.name ?? "neznámá chyba"
    fail(
      `Storefront na ${baseUrl} neodpovídá (${code}).\n\n` +
        "  PDF se tisknou z běžícího storefrontu. Spusťte ho v jiném terminálu:\n" +
        "      cd storefront && pnpm dev          (poslouchá na portu 8000)\n" +
        "  a pak znovu:\n" +
        "      pnpm legal:build\n" +
        "  Storefront na jiném portu:\n" +
        "      BASE_URL=http://localhost:8123 pnpm legal:build"
    )
  }
  if (response.status === 404) {
    fail(
      `${endpoint} vrátil 404 — na ${baseUrl} běží storefront bez routy /api/legal/versions ` +
        "(starší verze, nebo jiná aplikace). Restartujte dev server z aktuální větve."
    )
  }
  if (!response.ok) fail(`${endpoint} vrátil HTTP ${response.status}.`)
  const body = await response.json()
  if (!body || !Array.isArray(body.versions) || !body.facts || !body.paths) {
    fail(`${endpoint} vrátil neočekávaný tvar odpovědi.`)
  }
  return body
}

const launchBrowser = async () => {
  let chromium
  try {
    ;({ chromium } = await import("playwright"))
  } catch {
    fail("Playwright není nainstalovaný — spusťte `pnpm install` ve storefrontu.")
  }
  try {
    return await chromium.launch({ headless: true })
  } catch (error) {
    if (/Executable doesn't exist|browserType\.launch/.test(String(error?.message))) {
      fail(
        "Chybí Chromium pro Playwright. Nainstalujte ho:\n" +
          "      cd storefront && npx playwright install chromium"
      )
    }
    throw error
  }
}

const footerTemplate = (entry, sellerName) => `
<div style="box-sizing:border-box;width:100%;padding:0 16mm;display:flex;justify-content:space-between;gap:6mm;font-family:Arial,Helvetica,sans-serif;font-size:7.5pt;line-height:1.3;color:#5c574e;">
  <span>${escapeHtml(entry.title)} · znění platné od ${escapeHtml(formatVersionDate(entry.version))}${
    sellerName ? ` · ${escapeHtml(sellerName)}` : ""
  }</span>
  <span style="white-space:nowrap;">strana <span class="pageNumber"></span> z <span class="totalPages"></span></span>
</div>`

/**
 * Chromium do PDF zapisuje čas vytvoření a náhodné identifikátory — dvě PDF
 * ze stejného zdroje by se lišila v bajtech, a `legal:upload` by je pak měl
 * za různé soubory. Hodnoty se přepíšou na odvozené ze zdroje SE STEJNOU
 * DÉLKOU, takže tabulka xref (bajtové offsety) zůstane platná.
 */
const normalizePdf = (buf, entry, seed) => {
  const day = entry.version.replace(/-/g, "")
  const hex = sha256(seed)
  let text = buf.toString("latin1")
  // /CreationDate (D:20261014103015…) a /ModDate.
  text = text.replace(/\(D:\d{14}/g, `(D:${day}000000`)
  // XMP: <xmp:CreateDate>2026-10-14T10:30:15…
  text = text.replace(
    /(<xmp:(?:CreateDate|ModifyDate|MetadataDate)>)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g,
    `$1${entry.version}T00:00:00`
  )
  // uuid:… v XMP (DocumentID / InstanceID).
  text = text.replace(
    /uuid:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
    `uuid:${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
  )
  // /ID [<…> <…>] v trailer.
  text = text.replace(/\/ID\s*\[\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\]/g, (match, a, b) =>
    match.replace(a, hex.slice(0, a.length).padEnd(a.length, "0")).replace(b, hex.slice(0, b.length).padEnd(b.length, "0"))
  )
  const out = Buffer.from(text, "latin1")
  return out.length === buf.length ? out : buf
}

const renderPdf = async (browser, baseUrl, entry, sellerName, seed) => {
  const context = await browser.newContext({
    locale: "cs-CZ",
    timezoneId: "Europe/Prague",
    colorScheme: "light",
    reducedMotion: "reduce",
  })
  try {
    const page = await context.newPage()
    const url = new URL(entry.printPath, baseUrl).toString()
    const response = await page.goto(url, { waitUntil: "load", timeout: 180_000 })
    if (!response || response.status() !== 200) {
      throw new Error(`${url} vrátil HTTP ${response?.status() ?? "bez odpovědi"}`)
    }
    await page.waitForSelector("[data-legal-print-ready]", { state: "attached", timeout: 60_000 })

    // Všechna tisková písma musí být načtená, jinak by PDF vysázelo náhradní.
    const faces = await page.evaluate(async () => {
      const list = Array.from(document.fonts).filter((face) => /KZ Print/.test(face.family))
      await Promise.all(list.map((face) => face.load().catch(() => null)))
      await document.fonts.ready
      return list.map((face) => ({
        family: face.family.replace(/["']/g, ""),
        weight: face.weight,
        style: face.style,
        status: face.status,
      }))
    })
    const broken = faces.filter((face) => face.status !== "loaded")
    if (!faces.length) throw new Error(`${url}: tiskový styl se nenačetl (žádné písmo KZ Print).`)
    if (broken.length) {
      throw new Error(
        `${url}: nenačetla se písma ${broken.map((f) => `${f.family} ${f.weight} ${f.style}`).join(", ")}`
      )
    }

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: footerTemplate(entry, sellerName),
      margin: { top: "16mm", bottom: "18mm", left: "16mm", right: "16mm" },
      outline: true,
      tagged: true,
    })
    return normalizePdf(Buffer.from(pdf), entry, seed)
  } finally {
    await context.close()
  }
}

const matchesOnly = (only, entry) =>
  !only.length ||
  only.some((item) => {
    const [slug, version] = item.split("@")
    return slug === entry.slug && (!version || version === entry.version)
  })

const SELLER_KEYS = {
  name: "seller.name",
  address: "seller.address",
  ico: "seller.ico",
  email: "seller.email",
  phone: "seller.phone",
  web: "seller.web",
  webUrl: "seller.webUrl",
}

/** Kopie pro backend: fakty o prodávající + verze dokumentů s daty účinnosti a PDF. */
const backendManifest = (api, entries) => {
  const seller = {}
  for (const [key, factKey] of Object.entries(SELLER_KEYS)) {
    seller[key] = api.facts[factKey] ?? null
  }

  const documents = {}
  for (const [slug, docPath] of Object.entries(api.paths)) {
    documents[slug] = { title: null, path: docPath, versions: [] }
  }
  const sorted = [...api.versions].sort(
    (a, b) => a.slug.localeCompare(b.slug) || a.version.localeCompare(b.version)
  )
  for (const version of sorted) {
    const doc = (documents[version.slug] ??= { title: null, path: null, versions: [] })
    // Název podle nejnovější verze (seřazeno vzestupně → poslední vyhrává).
    doc.title = version.title
    const pdf = entries.get(`${version.slug}@${version.version}`)
    doc.versions.push({
      version: version.version,
      effectiveFrom: version.version,
      title: version.title,
      archived: Boolean(version.archived),
      // `draft` = PDF má nedoplněné údaje [[DOPLNIT]] — backend ho zákazníkům
      // nepřikládá ani neodkazuje (jen stránku dokumentu).
      pdf: pdf
        ? {
            file: pdf.file,
            url: pdf.url,
            sha256: pdf.sha256,
            bytes: pdf.bytes,
            draft: Number(version.placeholders) > 0,
          }
        : null,
    })
  }

  return {
    _generated:
      "Generuje `pnpm legal:build` (storefront/scripts/legal-build.mjs) z registru storefrontu; URL doplňuje `pnpm legal:upload`. Needitovat ručně.",
    schema: 1,
    seller,
    documents,
  }
}

const main = async () => {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(HELP)
    return
  }
  const baseUrl = (options.baseUrl || process.env.BASE_URL || "http://localhost:8000").replace(/\/+$/, "")

  console.log(`Právní dokumenty → PDF  (storefront ${baseUrl})`)
  const api = await fetchVersions(baseUrl)
  const sellerName = api.facts["seller.name"] ?? ""

  const manifest = await readJson(MANIFEST_PATH, { entries: [] })
  const previous = new Map(
    (Array.isArray(manifest.entries) ? manifest.entries : []).map((entry) => [
      `${entry.slug}@${entry.version}`,
      entry,
    ])
  )

  // Kolik znění přišlo ze Studia — prázdné nebo nečitelné CMS musí být vidět,
  // jinak by běh tiše počítal jen s kopiemi v repu.
  if (api.cms) {
    console.log(
      `Studio: načteno ${api.cms.read} znění (na webu platí ${api.cms.used}, neplatných ${api.cms.skipped})`
    )
    if (!api.cms.read) {
      console.warn(
        "! Ze Studia se nenačetlo žádné znění. Je CMS dostupné (proměnné Supabase v tomhle storefrontu)?\n" +
          "  U prázdného CMS je to v pořádku — pak platí jen kopie v repu."
      )
    }
    if (api.cms.skipped) {
      console.warn(`! ${api.cms.skipped} znění ve Studiu je neplatných a web je nepoužívá — viz log storefrontu ([legal]).`)
    }
  }

  const pdfVersions = api.versions.filter((version) => version.pdf)
  const known = new Set(pdfVersions.map((version) => `${version.slug}@${version.version}`))
  // Vydaný záznam (PDF v R2), který registr jako PDF nevede: CMS se při běhu
  // nenačetlo, nebo někdo verzi přepnul na „bez PDF". Vypustit ho z manifestu
  // by zrušilo zámek i přílohu v e-mailech — proto se nic nezapíše a běh
  // skončí chybou. Pracovní (místní) záznamy se vynechají jako dřív.
  const orphanIssued = []
  for (const [key, entry] of previous) {
    if (known.has(key)) continue
    if (/^https:\/\//.test(entry.url ?? "")) {
      orphanIssued.push(key)
    } else {
      console.warn(
        `! ${key} je v manifestu, ale registr ho jako PDF nevede — záznam vynechávám (soubor nemažu).`
      )
    }
  }
  if (orphanIssued.length) {
    fail(
      `Vydané znění chybí v registru: ${orphanIssued.join(", ")}.\n` +
        "  Jeho PDF je zveřejněné, váže se k objednávkám a manifest ho musí dál vést.\n" +
        "  Nejspíš se při tomto běhu nenačetlo Studio (CMS), nebo má verze vypnuté „PDF ke stažení“.\n" +
        "  Nic jsem nezapsal. Zkontrolujte CMS / dokument a spusťte znovu."
    )
  }

  // Výchozí stav = dosavadní záznamy těch verzí, které registr pořád vede.
  const entries = new Map()
  for (const version of pdfVersions) {
    const key = `${version.slug}@${version.version}`
    if (previous.has(key)) entries.set(key, previous.get(key))
  }

  const targets = pdfVersions.filter((version) => matchesOnly(options.only, version))
  if (!pdfVersions.length) {
    console.log("Registr zatím nemá žádnou verzi s `pdf: true` — není co tisknout.")
  } else if (!targets.length) {
    console.log(`Výběru --only=${options.only.join(",")} neodpovídá žádná verze s PDF.`)
  }

  let browser = null
  const rows = []
  let failed = false

  const issuedChanged = []

  try {
    for (const version of targets) {
      const key = `${version.slug}@${version.version}`
      const filePath = path.join(PUBLIC_DIR, version.file)
      const sourceHash = sha256(`${version.sourceHash}:pdf-options-${PDF_OPTIONS_REVISION}`)
      const old = previous.get(key)
      // Vydané = PDF už zveřejněné (https v manifestu, jako `isPublishedPdfUrl`).
      const issued = Boolean(old?.url && /^https:\/\//.test(old.url))
      let buf = existsSync(filePath) ? await readFile(filePath) : null
      const sameSource = Boolean(old && old.file === version.file && old.sourceHash === sourceHash)
      const upToDate = Boolean(sameSource && buf && sha256(buf) === old.sha256)

      // Vydané znění, jehož otisk nesedí: změnil se text v repu nebo fakty
      // v otisku manifestu. Nepřegenerovat — vydané PDF se váže k uzavřeným
      // smlouvám a v R2 je neměnné. Změna = nová verze s pozdějším datem.
      if (issued && !sameSource) {
        failed = true
        issuedChanged.push(key)
        rows.push({ key, status: "VYDANÉ ZNĚNÍ SE ZMĚNILO — nepřegeneruji" })
        continue
      }

      let status
      if (options.check) {
        status = !buf ? "CHYBÍ" : upToDate ? "aktuální" : "ZASTARALÉ"
        if (!upToDate) failed = true
      } else if (upToDate && (!options.force || issued)) {
        status = upToDate && issued && options.force ? "vydané · nepřegeneruji" : "beze změny"
      } else {
        try {
          browser ??= await launchBrowser()
          const rendered = await renderPdf(browser, baseUrl, version, sellerName, sourceHash)
          // Vydané PDF chybí jen v `public/legal` (otisk sedí): smí se znovu
          // vytisknout, jen když vyjdou tytéž bajty jako v R2.
          if (issued && sha256(rendered) !== old.sha256) {
            throw new Error(
              `vydané PDF chybí v public/legal a nový tisk dal jiné bajty — stáhněte ho z ${old.url}, nepřegenerovávejte`
            )
          }
          buf = rendered
          await mkdir(PUBLIC_DIR, { recursive: true })
          await writeFile(filePath, buf)
          status = old && old.sha256 === sha256(buf) ? "beze změny (znovu)" : "vygenerováno"
        } catch (error) {
          failed = true
          rows.push({ key, status: "CHYBA", error: error?.message ?? String(error) })
          continue
        }
      }

      if (!buf) {
        rows.push({ key, status })
        continue
      }

      const digest = sha256(buf)
      // V --check jen u aktuálních záznamů: porovnání manifestu pak ukáže, že
      // jim chybí `facts` (doplní je obyčejný běh).
      if (!options.check || upToDate) {
        entries.set(key, {
          slug: version.slug,
          version: version.version,
          file: version.file,
          // Stejný obsah → zůstává dosavadní URL (i z R2). Nový obsah → cesta
          // na storefrontu, dokud ho `legal:upload` nenahraje.
          url: old && old.sha256 === digest && old.url ? old.url : `/legal/${version.file}`,
          sha256: digest,
          bytes: buf.length,
          sourceHash,
          // Fakty, se kterými PDF vzniklo (`/api/legal/versions` → `facts`).
          // Záznamu bez nich se doplní: shoda otisku zdroje (`sameSource`)
          // dokazuje, že jsou tytéž jako při tisku.
          facts: sortedFacts(version.facts) ?? old?.facts,
        })
      }

      const probes = [...version.probes, `Platné od ${formatVersionDate(version.version)}`]
      let check
      try {
        check = verifyPdfText(buf, probes)
      } catch (error) {
        check = { ok: false, error: error?.message ?? String(error), fonts: [], pages: 0 }
      }
      if (!check.ok) failed = true
      rows.push({ key, status, buf, check, placeholders: version.placeholders })
    }
  } finally {
    if (browser) await browser.close()
  }

  // Pevné pořadí klíčů (stabilní diff) + příznak archivní verze z registru —
  // ten se může změnit, aniž by se měnilo PDF (patička webu ho čte).
  const archivedByKey = new Map(
    pdfVersions.map((version) => [`${version.slug}@${version.version}`, Boolean(version.archived)])
  )
  const sortedEntries = Array.from(entries.entries())
    .map(([key, entry]) => ({
      slug: entry.slug,
      version: entry.version,
      file: entry.file,
      url: entry.url,
      sha256: entry.sha256,
      bytes: entry.bytes,
      sourceHash: entry.sourceHash,
      archived: archivedByKey.get(key) ?? Boolean(entry.archived),
      ...(entry.facts ? { facts: entry.facts } : {}),
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug) || a.version.localeCompare(b.version))
  const manifestChanged = await writeJsonIfChanged(
    MANIFEST_PATH,
    { entries: sortedEntries },
    options.check
  )
  const backendChanged = await writeJsonIfChanged(
    BACKEND_MANIFEST_PATH,
    backendManifest(api, new Map(sortedEntries.map((entry) => [`${entry.slug}@${entry.version}`, entry]))),
    options.check
  )

  // Otisky znění ze Studia: `document` posílá API jen u verze, jejíž text
  // přišel z CMS a v repu ho ještě nikdo nemá (nebo má jiný).
  const snapshotVersions = api.versions.filter(
    (version) => version.document && matchesOnly(options.only, version)
  )
  const snapshotRows = []
  for (const version of snapshotVersions) {
    const file = snapshotFile(version)
    const changed = await writeJsonIfChanged(path.join(SNAPSHOT_DIR, file), version.document, options.check)
    snapshotRows.push({
      file,
      changed,
      key: `${version.slug}@${version.version}`,
      hasRepoCopy: Boolean(version.hasRepoCopy),
    })
  }
  const snapshotFiles = new Set(await listSnapshotFiles())
  for (const { file } of snapshotRows) snapshotFiles.add(file)
  const indexChanged = await writeTextIfChanged(
    SNAPSHOT_INDEX,
    snapshotIndex(Array.from(snapshotFiles).sort()),
    options.check
  )
  const snapshotsChanged = indexChanged || snapshotRows.some((row) => row.changed)

  // Souhrn.
  if (rows.length) {
    const header = ["dokument", "stav", "stran", "velikost", "písma (vložená)", "text", "DOPLNIT"]
    const table = rows.map((row) => {
      const fonts = row.check?.fonts?.length
        ? Array.from(new Set(row.check.fonts.map((font) => `${font.name}${font.embedded ? "" : " (NEVLOŽENO)"}`))).join(", ")
        : "—"
      let text = "—"
      if (row.check?.error) text = `✗ ${row.check.error}`
      else if (row.check) {
        text = row.check.ok
          ? `✓ (${row.check.czech} čes. znaků)`
          : `✗ ${[
              row.check.missingProbes?.length ? `chybí úryvky: ${row.check.missingProbes.join(" | ")}` : "",
              row.check.notEmbedded?.length ? `nevložená písma: ${row.check.notEmbedded.join(", ")}` : "",
              row.check.noUnicode?.length ? `bez ToUnicode: ${row.check.noUnicode.join(", ")}` : "",
              row.check.unmapped ? `${row.check.unmapped} nečitelných glyfů` : "",
            ]
              .filter(Boolean)
              .join("; ")}`
      }
      return [
        row.key,
        row.error ? `CHYBA: ${row.error}` : row.status,
        row.check?.pages ? String(row.check.pages) : "—",
        row.buf ? formatSize(row.buf.length) : "—",
        fonts,
        text,
        row.placeholders ? String(row.placeholders) : "0",
      ]
    })
    const widths = header.map((cell, index) =>
      Math.min(60, Math.max(cell.length, ...table.map((cells) => cells[index].length)))
    )
    const line = (cells) => cells.map((cell, index) => cell.padEnd(widths[index])).join("  ")
    console.log("")
    console.log(line(header))
    console.log(widths.map((width) => "─".repeat(width)).join("  "))
    for (const cells of table) console.log(line(cells))
    if (rows.some((row) => row.check?.fonts?.some((font) => font.name === "false"))) {
      console.log(
        "\n  „false“ = Sentient (nadpisy): soubory písma mají v tabulce názvů místo jména text „false“. Písmo je vložené a text čitelný."
      )
    }
  }

  console.log("")
  console.log(
    `Manifest storefrontu: ${manifestChanged ? (options.check ? "ZASTARALÝ" : "zapsán") : "beze změny"} (${path.relative(REPO, MANIFEST_PATH)})`
  )
  console.log(
    `Manifest backendu:    ${backendChanged ? (options.check ? "ZASTARALÝ" : "zapsán") : "beze změny"} (${path.relative(REPO, BACKEND_MANIFEST_PATH)})`
  )
  for (const row of snapshotRows) {
    console.log(
      `Otisk znění ze Studia: ${row.changed ? (options.check ? "ZASTARALÝ" : "zapsán") : "beze změny"} (${path.relative(REPO, path.join(SNAPSHOT_DIR, row.file))})`
    )
    if (options.check && row.changed) {
      console.error(
        row.hasRepoCopy
          ? `✗ ${row.key}: ZNĚNÍ VE STUDIU SE LIŠÍ OD KOPIE V REPU — spusťte legal:build (zapíše otisk)`
          : `✗ ${row.key}: ZNĚNÍ JEN VE STUDIU — spusťte legal:build (bez otisku by při výpadku CMS ze stránky zmizelo)`
      )
    }
  }
  if (indexChanged) {
    console.log(
      `Seznam otisků:        ${options.check ? "ZASTARALÝ" : "zapsán"} (${path.relative(REPO, SNAPSHOT_INDEX)})`
    )
  }
  if (options.check && (manifestChanged || backendChanged || snapshotsChanged)) failed = true

  if (issuedChanged.length) {
    console.error(
      `\n✗ Vydané znění se změnilo: ${issuedChanged.join(", ")}.\n` +
        "  Jeho PDF je zveřejněné a váže se k uzavřeným smlouvám — text v repu (TS modul / otisk)\n" +
        "  ani fakty v otisku manifestu (`facts`) se nesmí měnit. Vraťte změnu; nové znění\n" +
        "  patří do nové verze s pozdějším datem platnosti (ve Studiu nový záznam)."
    )
  }
  // Studio drží pod klíčem vydané verze jiný text (např. úprava mezi
  // `legal:build` a `legal:upload`). Web ho nepoužije, ale ať o tom někdo ví.
  for (const version of api.versions.filter((item) => item.locked && item.cmsDiffers)) {
    console.warn(
      `! ${version.slug}@${version.version}: ve Studiu je jiné znění než vydané — web ukazuje vydané (z repa); ` +
        "změny patří do nové verze."
    )
  }

  // Znění, které už platí, a jeho PDF zveřejněné není (jen místní /legal/…, nebo
  // žádné). Před spuštěním obchodu musí být vydané všechno — dnes je to stav
  // před spuštěním (OP, odstoupení, zásady s [[DOPLNIT]]), proto jen
  // varování; chybou až s --strict (kontrola na ostro).
  const today = api.today ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague" }).format(new Date())
  const issuedKeys = new Set(
    sortedEntries.filter((entry) => /^https:\/\//.test(entry.url)).map((entry) => `${entry.slug}@${entry.version}`)
  )
  const unissued = pdfVersions.filter(
    (version) => version.version <= today && !issuedKeys.has(`${version.slug}@${version.version}`)
  )
  if (unissued.length) {
    const say = options.strict ? console.error : console.warn
    say(
      `\n${options.strict ? "✗" : "!"} PLATNÉ, ALE NEVYDANÉ (${unissued.length}) — znění už platí, ale jeho PDF není zveřejněné v R2:`
    )
    for (const version of unissued) {
      say(
        `  - ${version.slug}@${version.version}${Number(version.placeholders) > 0 ? ` (${version.placeholders}× [[DOPLNIT]])` : ""}`
      )
    }
    say(
      options.strict
        ? "  Před spuštěním doplňte údaje, spusťte legal:build a legal:upload."
        : "  (Jen upozornění; před spuštěním obchodu spusťte kontrolu s --strict.)"
    )
    if (options.strict) failed = true
  }

  const withPlaceholders = rows.filter((row) => row.placeholders > 0)
  if (withPlaceholders.length) {
    console.log(
      `\n! ${withPlaceholders.length} PDF obsahuje nedoplněné údaje [[DOPLNIT]] (žlutě) — zákazníkům je neposílat, dokud nejsou doplněné v „Právních údajích" (administrace) / ve znění dokumentu.`
    )
  }
  const local = sortedEntries.filter((entry) => !/^https?:\/\//.test(entry.url))
  if (local.length && !options.check) {
    console.log(
      `\nDalší krok: nahrát ${local.length} PDF do R2 — v backendu \`pnpm legal:upload --dry-run\`, pak \`pnpm legal:upload\`.`
    )
  }
  if (snapshotsChanged && !options.check) {
    console.log(
      "\nOtisky znění ze Studia jsou nové / změněné — commitněte je spolu s manifestem: po zveřejnění PDF se web vykresluje jen z nich."
    )
  }

  if (failed) {
    console.error("\n✗ Kontrola neprošla — viz tabulka a hlášení výš (PDF, manifesty, otisky znění).")
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(`\n✗ legal:build selhal: ${error?.stack ?? error}`)
  process.exit(1)
})
