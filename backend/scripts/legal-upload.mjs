#!/usr/bin/env node
/**
 * pnpm legal:upload — PDF právních dokumentů do Cloudflare R2 s PEVNÝM klíčem.
 *
 * Čte PDF z `storefront/public/legal/` podle `storefront/src/lib/legal/pdf-manifest.json`
 * (vytváří je `pnpm legal:build` ve storefrontu) a nahraje každé na klíč
 * `legal/<soubor>` s `Content-Type: application/pdf`,
 * `Cache-Control: public, max-age=31536000, immutable` a metadatem
 * `x-amz-meta-sha256`. Pak zapíše trvalou URL `${R2_PUBLIC_URL}/legal/<soubor>`
 * do manifestu storefrontu i backendu (`src/lib/legal/legal-manifest.json`),
 * odkud ji bere potvrzení objednávky jako přílohu.
 *
 * Proč ne přes modul souborů Medusy: provider `minio-file` ke klíči vždy
 * přidává náhodnou příponu — URL PDF verze OP ale musí být trvalá, odkazuje
 * se na ni z e-mailů zákazníkům.
 *
 * Bezpečné opakování: před nahráním HEAD; stejné sha256 = přeskočit.
 * Jiné sha256 u existujícího klíče = CHYBA. Vydané PDF je neměnné (immutable
 * cache na rok) a váže se k uzavřeným smlouvám — přepsat ho jde jen
 * vědomě přes `--overwrite` (a pak vyčistit cache v Cloudflaru).
 *
 * Použití (z `backend/`):
 *   pnpm legal:upload --dry-run      # nic nezapisuje: jen čte stav v R2 a vypíše plán
 *   pnpm legal:upload                # nahraje chybějící, doplní URL do manifestů
 *   pnpm legal:upload --only=obchodni-podminky@2026-10-15
 *   pnpm legal:upload --overwrite    # přepíše PDF s jiným obsahem (jen vědomě!)
 *
 * Prostředí: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET,
 * R2_PUBLIC_URL — z proměnných, nebo z `backend/.env`. Hodnoty se nevypisují.
 */
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { readFile, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const REPO = path.resolve(BACKEND, "..")
const STOREFRONT_MANIFEST = path.join(REPO, "storefront", "src", "lib", "legal", "pdf-manifest.json")
const BACKEND_MANIFEST = path.join(BACKEND, "src", "lib", "legal", "legal-manifest.json")
const PDF_DIR = path.join(REPO, "storefront", "public", "legal")
const KEY_PREFIX = "legal/"
const CACHE_CONTROL = "public, max-age=31536000, immutable"
const REQUIRED_ENV = ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_URL"]

const HELP = `pnpm legal:upload [--dry-run] [--overwrite] [--only=<slug>[@<verze>],…]

  --dry-run    nic nezapisovat (do R2 ani do manifestů) — jen přečíst stav a vypsat plán
  --overwrite  přepsat v R2 i PDF, které tam už je s JINÝM obsahem (vydané PDF je
               neměnné — jen vědomě, a pak vyčistit cache v Cloudflaru)
  --only=…     jen vybrané dokumenty / verze`

const parseArgs = (argv) => {
  const options = { dryRun: false, overwrite: false, only: [], help: false }
  for (const arg of argv) {
    if (arg === "--dry-run") options.dryRun = true
    else if (arg === "--overwrite") options.overwrite = true
    else if (arg === "--help" || arg === "-h") options.help = true
    else if (arg.startsWith("--only=")) {
      options.only.push(...arg.slice(7).split(",").map((item) => item.trim()).filter(Boolean))
    } else {
      console.error(`Neznámý přepínač ${arg}\n\n${HELP}`)
      process.exit(2)
    }
  }
  return options
}

/**
 * Minimální čtení `.env` (KLÍČ=hodnota, komentáře, uvozovky). Proměnné, které
 * už v prostředí jsou, mají přednost. Nic se nevypisuje.
 */
const loadDotEnv = (file) => {
  if (!existsSync(file)) return false
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!match || match[1] in process.env) continue
    let value = match[2]
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1)
    else value = value.replace(/\s+#.*$/, "")
    process.env[match[1]] = value
  }
  return true
}

const sha256 = (data) => createHash("sha256").update(data).digest("hex")

const formatSize = (bytes) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} kB`
    : `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`

const fail = (message) => {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}

const readJson = async (file) => {
  try {
    return JSON.parse(await readFile(file, "utf8"))
  } catch (error) {
    fail(
      error?.code === "ENOENT"
        ? `${path.relative(REPO, file)} neexistuje — nejdřív spusťte \`pnpm legal:build\` ve storefrontu.`
        : `${path.relative(REPO, file)} není platný JSON: ${error.message}`
    )
  }
}

const writeJsonIfChanged = async (file, value) => {
  const next = `${JSON.stringify(value, null, 2)}\n`
  const current = existsSync(file) ? await readFile(file, "utf8") : null
  if (current === next) return false
  await writeFile(file, next, "utf8")
  return true
}

/** Stav objektu v R2: `null` = neexistuje. */
const statObject = async (client, bucket, key) => {
  try {
    const stat = await client.statObject(bucket, key)
    return { size: stat.size, sha256: stat.metaData?.sha256 ?? null }
  } catch (error) {
    if (["NotFound", "NoSuchKey"].includes(error?.code)) return null
    throw error
  }
}

/** Ověření, že soubor jde přes veřejnou doménu (jen čtení). */
const publicStatus = async (url) => {
  try {
    const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(10_000) })
    const type = response.headers.get("content-type") ?? "?"
    return response.ok ? `HTTP ${response.status} ${type}` : `HTTP ${response.status}`
  } catch (error) {
    return error?.cause?.code ?? error?.name ?? "chyba"
  }
}

const matchesOnly = (only, entry) =>
  !only.length ||
  only.some((item) => {
    const [slug, version] = item.split("@")
    return slug === entry.slug && (!version || version === entry.version)
  })

const main = async () => {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(HELP)
    return
  }

  const envLoaded = loadDotEnv(path.join(BACKEND, ".env"))
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]?.trim())
  if (missing.length) {
    fail(
      `Chybí proměnné ${missing.join(", ")}${envLoaded ? " (ani v backend/.env)" : " (backend/.env nenalezen)"}.`
    )
  }
  const bucket = process.env.R2_BUCKET.trim()
  const publicBase = process.env.R2_PUBLIC_URL.trim().replace(/\/+$/, "")
  // minio klient chce jen hostitele — stejně jako `hostOf()` v modules/minio-file.
  const endPoint = process.env.R2_ENDPOINT.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "")

  let Client
  try {
    ;({ Client } = require("minio"))
  } catch {
    fail("Balíček `minio` není nainstalovaný — spusťte `pnpm install` v backendu.")
  }
  const client = new Client({
    endPoint,
    port: 443,
    useSSL: true,
    accessKey: process.env.R2_ACCESS_KEY_ID.trim(),
    secretKey: process.env.R2_SECRET_ACCESS_KEY.trim(),
    region: "auto",
  })

  const storefrontManifest = await readJson(STOREFRONT_MANIFEST)
  const backendManifest = await readJson(BACKEND_MANIFEST)
  const entries = Array.isArray(storefrontManifest.entries) ? storefrontManifest.entries : []
  const targets = entries.filter((entry) => matchesOnly(options.only, entry))

  console.log(
    `Právní PDF → R2  (bucket ${bucket}, veřejně ${publicBase})${options.dryRun ? "  — DRY RUN, nic se nezapisuje" : ""}`
  )
  if (!targets.length) {
    console.log("Manifest nemá žádné PDF k nahrání (spusťte `pnpm legal:build` ve storefrontu).")
    return
  }

  const rows = []
  const urls = new Map() // `${slug}@${version}` → { url, sha256 }
  let failed = false

  for (const entry of targets) {
    const key = `${KEY_PREFIX}${entry.file}`
    const url = `${publicBase}/${KEY_PREFIX}${encodeURIComponent(entry.file)}`
    const id = `${entry.slug}@${entry.version}`
    const file = path.join(PDF_DIR, entry.file)

    if (!existsSync(file)) {
      failed = true
      rows.push([id, "CHYBA: soubor chybí v storefront/public/legal — spusťte pnpm legal:build", "—", "—"])
      continue
    }
    const body = await readFile(file)
    const digest = sha256(body)
    if (digest !== entry.sha256 || body.length !== entry.bytes) {
      failed = true
      rows.push([id, "CHYBA: PDF neodpovídá manifestu — spusťte pnpm legal:build", formatSize(body.length), "—"])
      continue
    }

    let remote
    try {
      remote = await statObject(client, bucket, key)
    } catch (error) {
      failed = true
      rows.push([id, `CHYBA při čtení R2: ${error?.code ?? error?.message ?? error}`, formatSize(body.length), "—"])
      continue
    }

    let status
    if (remote && remote.sha256 === digest && remote.size === body.length) {
      status = "v R2 (stejné) — přeskočeno"
      urls.set(id, { url, sha256: digest })
    } else if (remote && !options.overwrite) {
      failed = true
      rows.push([
        id,
        `CHYBA: v R2 je jiný obsah (sha256 ${remote.sha256 ? remote.sha256.slice(0, 12) : "neznámé"}…) — vydané PDF se nepřepisuje; vědomě jen s --overwrite`,
        formatSize(body.length),
        "—",
      ])
      continue
    } else if (options.dryRun) {
      status = remote ? "PŘEPSAL BY (--overwrite)" : "nahrál by"
    } else {
      try {
        await client.putObject(bucket, key, body, body.length, {
          "Content-Type": "application/pdf",
          "Cache-Control": CACHE_CONTROL,
          "Content-Disposition": `inline; filename="${entry.file}"`,
          sha256: digest,
        })
        const check = await statObject(client, bucket, key)
        if (!check || check.sha256 !== digest || check.size !== body.length) {
          throw new Error("po nahrání nesedí velikost nebo sha256")
        }
        status = remote ? "PŘEPSÁNO (vyčistit cache v Cloudflaru!)" : "nahráno"
        urls.set(id, { url, sha256: digest })
      } catch (error) {
        failed = true
        rows.push([id, `CHYBA při nahrání: ${error?.code ?? error?.message ?? error}`, formatSize(body.length), "—"])
        continue
      }
    }

    rows.push([id, status, formatSize(body.length), urls.has(id) ? await publicStatus(url) : "—"])
  }

  const header = ["dokument", "stav", "velikost", "veřejná URL"]
  const widths = header.map((cell, index) =>
    Math.min(90, Math.max(cell.length, ...rows.map((row) => String(row[index]).length)))
  )
  const line = (cells) => cells.map((cell, index) => String(cell).padEnd(widths[index])).join("  ")
  console.log("")
  console.log(line(header))
  console.log(widths.map((width) => "─".repeat(width)).join("  "))
  for (const row of rows) console.log(line(row))

  if (!options.dryRun && urls.size) {
    // Manifest storefrontu: URL u záznamu s tímtéž obsahem.
    for (const entry of entries) {
      const hit = urls.get(`${entry.slug}@${entry.version}`)
      if (hit && hit.sha256 === entry.sha256) entry.url = hit.url
    }
    // Manifest backendu: URL u PDF verze se stejným sha256.
    for (const [slug, doc] of Object.entries(backendManifest.documents ?? {})) {
      for (const version of doc?.versions ?? []) {
        const hit = urls.get(`${slug}@${version.version}`)
        if (hit && version.pdf && version.pdf.sha256 === hit.sha256) version.pdf.url = hit.url
      }
    }
    const changedStorefront = await writeJsonIfChanged(STOREFRONT_MANIFEST, storefrontManifest)
    const changedBackend = await writeJsonIfChanged(BACKEND_MANIFEST, backendManifest)
    console.log("")
    console.log(`Manifest storefrontu: ${changedStorefront ? "URL doplněny" : "beze změny"} (${path.relative(REPO, STOREFRONT_MANIFEST)})`)
    console.log(`Manifest backendu:    ${changedBackend ? "URL doplněny" : "beze změny"} (${path.relative(REPO, BACKEND_MANIFEST)})`)
    if (changedStorefront || changedBackend) {
      console.log("Manifesty commitněte a nasaďte storefront i backend — teprve pak jdou PDF do e-mailů z R2.")
    }
  }

  if (failed) {
    console.error("\n✗ Některá PDF se nenahrála (viz tabulka).")
    process.exit(1)
  }
}

main().catch((error) => {
  // Bez stacku s konfigurací klienta — v chybě minio nejsou klíče, ale ať se nic neplete.
  console.error(`\n✗ legal:upload selhal: ${error?.code ?? ""} ${error?.message ?? error}`)
  process.exit(1)
})
