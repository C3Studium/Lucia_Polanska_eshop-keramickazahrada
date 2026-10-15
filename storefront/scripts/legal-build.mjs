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
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { verifyPdfText } from "./legal-pdf-text.mjs"

const STOREFRONT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const REPO = path.resolve(STOREFRONT, "..")
const PUBLIC_DIR = path.join(STOREFRONT, "public", "legal")
const MANIFEST_PATH = path.join(STOREFRONT, "src", "lib", "legal", "pdf-manifest.json")
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

const HELP = `pnpm legal:build [--force] [--check] [--only=<slug>[@<verze>],…] [--base-url=<url>]

  --force      vygenerovat znovu i PDF, jejichž zdroj se nezměnil
  --check      nic negenerovat ani nezapisovat — jen ověřit PDF a manifesty
  --only=…     jen vybrané dokumenty / verze (čárkou, lze opakovat)
  --base-url=… adresa běžícího storefrontu (nebo proměnná BASE_URL),
               výchozí http://localhost:8000`

const parseArgs = (argv) => {
  const options = { force: false, check: false, only: [], baseUrl: null, help: false }
  for (const arg of argv) {
    if (arg === "--force") options.force = true
    else if (arg === "--check") options.check = true
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
const writeJsonIfChanged = async (file, value, dryRun) => {
  const next = `${JSON.stringify(value, null, 2)}\n`
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

  const pdfVersions = api.versions.filter((version) => version.pdf)
  const known = new Set(pdfVersions.map((version) => `${version.slug}@${version.version}`))
  for (const key of previous.keys()) {
    if (!known.has(key)) {
      console.warn(
        `! ${key} je v manifestu, ale registr ho jako PDF nevede — záznam vynechávám (soubor nemažu).`
      )
    }
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

  try {
    for (const version of targets) {
      const key = `${version.slug}@${version.version}`
      const filePath = path.join(PUBLIC_DIR, version.file)
      const sourceHash = sha256(`${version.sourceHash}:pdf-options-${PDF_OPTIONS_REVISION}`)
      const old = previous.get(key)
      let buf = existsSync(filePath) ? await readFile(filePath) : null
      const upToDate = Boolean(
        old &&
          old.file === version.file &&
          old.sourceHash === sourceHash &&
          buf &&
          sha256(buf) === old.sha256
      )

      let status
      if (options.check) {
        status = !buf ? "CHYBÍ" : upToDate ? "aktuální" : "ZASTARALÉ"
        if (!upToDate) failed = true
      } else if (upToDate && !options.force) {
        status = "beze změny"
      } else {
        try {
          browser ??= await launchBrowser()
          buf = await renderPdf(browser, baseUrl, version, sellerName, sourceHash)
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
      if (!options.check) {
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
  if (options.check && (manifestChanged || backendChanged)) failed = true

  const withPlaceholders = rows.filter((row) => row.placeholders > 0)
  if (withPlaceholders.length) {
    console.log(
      `\n! ${withPlaceholders.length} PDF obsahuje nedoplněné údaje [[DOPLNIT]] (žlutě) — zákazníkům je neposílat, dokud nejsou doplněné ve facts.ts / dokumentech.`
    )
  }
  const local = sortedEntries.filter((entry) => !/^https?:\/\//.test(entry.url))
  if (local.length && !options.check) {
    console.log(
      `\nDalší krok: nahrát ${local.length} PDF do R2 — v backendu \`pnpm legal:upload --dry-run\`, pak \`pnpm legal:upload\`.`
    )
  }

  if (failed) {
    console.error("\n✗ Některá PDF neprošla kontrolou (viz tabulka).")
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(`\n✗ legal:build selhal: ${error?.stack ?? error}`)
  process.exit(1)
})
