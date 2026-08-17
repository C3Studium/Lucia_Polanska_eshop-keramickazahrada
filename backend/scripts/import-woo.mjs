/**
 * WooCommerce → Medusa product import, over the admin REST API.
 *
 * Reads the Czech-localised Woo export (wc-product-export-*.csv), takes the
 * 263 `simple` rows (the 133 `variation` rows in that export are empty husks —
 * no name, no parent, no images — and are skipped with a report line), and for
 * each one: downloads its photos from the old site, uploads them to this
 * shop's storage, and creates a published product with price, stock, weight,
 * dimensions and tags. Old categories are NOT assigned — Lucia sorts the
 * catalogue herself — but the old category string, the old numeric id and the
 * pre-sale price are kept in `metadata.import_*` so nothing is lost.
 *
 * Runs against the deployed backend, so it needs no database access:
 *
 *   node scripts/import-woo.mjs --dry-run          # parse + report, write nothing
 *   node scripts/import-woo.mjs --wipe             # delete ALL current products
 *   node scripts/import-woo.mjs --import --limit 3 # trial batch
 *   node scripts/import-woo.mjs --import           # the real thing
 *
 * Auth: IMPORT_ADMIN_EMAIL + IMPORT_ADMIN_PASSWORD env vars (or in backend/.env,
 * which is gitignored). Backend URL via IMPORT_BACKEND_URL, default the dev deploy.
 */

import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const CSV_PATH =
  process.env.IMPORT_CSV ??
  resolve(HERE, "../../storefront/public/wc-product-export-2026-08-17.csv")
const BASE = (
  process.env.IMPORT_BACKEND_URL ?? "https://dev.matejforejt.com"
).replace(/\/+$/, "")

const args = new Set(process.argv.slice(2))
const limitArg = process.argv.indexOf("--limit")
const LIMIT =
  limitArg !== -1 ? Number(process.argv[limitArg + 1]) : Number.POSITIVE_INFINITY
const DRY = args.has("--dry-run")
const WIPE = args.has("--wipe")
const IMPORT = args.has("--import")

// ---------------------------------------------------------------- .env pickup
for (const envPath of [join(HERE, "../.env")]) {
  if (!existsSync(envPath)) continue
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2]
  }
}

// ---------------------------------------------------------------- CSV parsing
/** Minimal RFC-4180 parser — the export has quoted multi-line HTML descriptions. */
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ",") {
      row.push(field)
      field = ""
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1
      row.push(field)
      field = ""
      if (row.length > 1 || row[0] !== "") rows.push(row)
      row = []
    } else {
      field += ch
    }
  }
  if (field !== "" || row.length) {
    row.push(field)
    rows.push(row)
  }
  const header = rows.shift()
  return rows.map((cells) =>
    Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ""]))
  )
}

// ------------------------------------------------------------- text utilities
const decodeEntities = (value) =>
  value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#8211;/g, "–")
    .replace(/&#8222;/g, "„")
    .replace(/&#8220;/g, "“")
    .replace(/&#039;|&#8217;/g, "’")

/** HTML → readable plain text: block tags become line breaks, the rest is stripped. */
const htmlToText = (value) =>
  decodeEntities(
    (value ?? "")
      .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6])[^>]*>/gi, "\n")
      .replace(/<\s*li[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

const slugify = (value) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

const parseNumber = (value) => {
  const cleaned = String(value ?? "").replace(/\s+/g, "").replace(",", ".")
  const parsed = Number(cleaned)
  return cleaned && Number.isFinite(parsed) ? parsed : null
}

// ----------------------------------------------------------------- API client
let token = null

async function api(path, init = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  })
  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`${init.method ?? "GET"} ${path} → ${response.status}: ${body.slice(0, 400)}`)
  }
  return response.json()
}

async function login() {
  const email = process.env.IMPORT_ADMIN_EMAIL
  const password = process.env.IMPORT_ADMIN_PASSWORD
  if (!email || !password) {
    throw new Error(
      "Set IMPORT_ADMIN_EMAIL and IMPORT_ADMIN_PASSWORD (env or backend/.env)."
    )
  }
  const response = await fetch(`${BASE}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) throw new Error(`Login failed: ${response.status}`)
  token = (await response.json()).token
}

// ------------------------------------------------------------------ the rows
const rawRows = parseCsv(readFileSync(CSV_PATH, "utf8"))
const simple = rawRows.filter((row) => row["Typ"] === "simple")
const skipped = rawRows.length - simple.length

const products = simple.slice(0, LIMIT).map((row) => {
  const regular = parseNumber(row["Běžná cena"])
  const sale = parseNumber(row["Cena po slevě"])
  const price = sale ?? regular
  const weightKg = parseNumber(row["Hmotnost (kg)"])
  const images = (row["Obrázky"] ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean)
    .filter((url, index, all) => all.indexOf(url) === index)
  const tags = (row["Štítky"] ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
  /* Woo's „krátký popis" is a full lede paragraph (often carrying the discount
     reason), far too long for a subtitle — it opens the description instead. */
  const shortText = htmlToText(row["Krátký popis"])
  const longText = htmlToText(row["Popis"])

  return {
    importId: row["ID"],
    title: row["Jméno"].trim(),
    handle: slugify(row["Jméno"]),
    description: [shortText, longText].filter(Boolean).join("\n\n"),
    sku: (row["Katalogové číslo"] ?? "").trim() || undefined,
    price,
    regularPrice: regular,
    stock: row["Skladem?"] === "0" ? 0 : parseNumber(row["Sklad"]) ?? 0,
    weightGrams: weightKg != null ? Math.round(weightKg * 1000) : undefined,
    lengthCm: parseNumber(row["Délka (cm)"]) ?? undefined,
    widthCm: parseNumber(row["Šířka (cm)"]) ?? undefined,
    heightCm: parseNumber(row["Výška (cm)"]) ?? undefined,
    images,
    tags,
    oldCategories: (row["Kategorie"] ?? "").trim(),
    published: row["Publikovaný"] === "1",
  }
})

// Handles must be unique; the export has near-duplicate names.
const seenHandles = new Map()
for (const product of products) {
  const count = seenHandles.get(product.handle) ?? 0
  seenHandles.set(product.handle, count + 1)
  if (count > 0) product.handle = `${product.handle}-${count + 1}`
}

if (DRY || (!WIPE && !IMPORT)) {
  console.log(`CSV: ${CSV_PATH}`)
  console.log(`rows: ${rawRows.length} | simple: ${simple.length} | skipped (empty variation rows): ${skipped}`)
  const noPrice = products.filter((product) => product.price == null)
  const noImage = products.filter((product) => !product.images.length)
  console.log(`to import: ${products.length} | without price: ${noPrice.length} | without image: ${noImage.length}`)
  for (const product of noPrice) console.log(`  ! bez ceny: ${product.title}`)
  for (const product of noImage) console.log(`  ! bez fotky: ${product.title}`)
  const sample = products[0]
  console.log("\nSAMPLE:", JSON.stringify({ ...sample, description: sample.description.slice(0, 160) + "…" }, null, 2))
  process.exit(0)
}

// --------------------------------------------------------------------- doing
await login()

if (WIPE) {
  let deleted = 0
  for (;;) {
    const { products: page } = await api(`/admin/products?limit=100&fields=id,title`)
    if (!page.length) break
    for (const product of page) {
      await api(`/admin/products/${product.id}`, { method: "DELETE" })
      deleted += 1
      process.stdout.write(`\rdeleted ${deleted}: ${product.title.slice(0, 50).padEnd(50)}`)
    }
  }
  console.log(`\nCatalogue wiped: ${deleted} products deleted.`)
}

if (IMPORT) {
  const { sales_channels } = await api(`/admin/sales-channels?limit=20`)
  const channel =
    sales_channels.find((entry) => /webshop/i.test(entry.name)) ?? sales_channels[0]
  const { stock_locations } = await api(`/admin/stock-locations?limit=20`)
  const location =
    stock_locations.find((entry) => !/european/i.test(entry.name)) ?? stock_locations[0]
  console.log(`sales channel: ${channel.name} | stock location: ${location.name}`)

  /* The create endpoint takes tags only as existing ids — upsert each value once. */
  const tagCache = new Map()
  const tagId = async (value) => {
    if (tagCache.has(value)) return tagCache.get(value)
    const { product_tags } = await api(
      `/admin/product-tags?value=${encodeURIComponent(value)}&limit=1`
    )
    let id = product_tags?.[0]?.id
    if (!id) {
      const created = await api(`/admin/product-tags`, {
        method: "POST",
        body: JSON.stringify({ value }),
      })
      id = created.product_tag.id
    }
    tagCache.set(value, id)
    return id
  }

  let created = 0
  const failures = []

  for (const product of products) {
    try {
      // Photos: old site → this shop's storage. A failed photo skips, not aborts.
      const uploadedUrls = []
      for (const url of product.images) {
        try {
          const download = await fetch(url)
          if (!download.ok) throw new Error(`HTTP ${download.status}`)
          const blob = await download.blob()
          const name = url.split("/").pop()?.split("?")[0] || "photo.jpg"
          const form = new FormData()
          form.append("files", blob, name)
          const { files } = await api(`/admin/uploads`, { method: "POST", body: form })
          for (const file of files) uploadedUrls.push(file.url)
        } catch (error) {
          console.warn(`\n  foto se nepovedlo (${product.title}): ${url} — ${error.message}`)
        }
      }

      const body = {
        title: product.title,
        handle: product.handle,

        description: product.description,
        status: product.published ? "published" : "draft",
        weight: product.weightGrams,
        length: product.lengthCm,
        width: product.widthCm,
        height: product.heightCm,
        ...(uploadedUrls.length
          ? {
              thumbnail: uploadedUrls[0],
              images: uploadedUrls.map((url) => ({ url })),
            }
          : {}),
        ...(product.tags.length
          ? {
              tags: (
                await Promise.all(product.tags.map((value) => tagId(value)))
              ).map((id) => ({ id })),
            }
          : {}),
        options: [{ title: "Provedení", values: ["Standardní"] }],
        variants: [
          {
            title: "Standardní",
            sku: product.sku,
            options: { Provedení: "Standardní" },
            manage_inventory: true,
            prices:
              product.price != null
                ? [{ amount: product.price, currency_code: "czk" }]
                : [],
          },
        ],
        sales_channels: [{ id: channel.id }],
        metadata: {
          import_id: product.importId,
          import_categories: product.oldCategories || undefined,
          ...(product.regularPrice != null &&
          product.price !== product.regularPrice
            ? { import_regular_price: product.regularPrice }
            : {}),
        },
      }

      const { product: createdProduct } = await api(`/admin/products`, {
        method: "POST",
        body: JSON.stringify(body),
      })

      // Stock: find the variant's inventory item and set the level at her location.
      if (product.stock > 0) {
        const variant = createdProduct.variants?.[0]
        const query = variant?.sku
          ? `sku=${encodeURIComponent(variant.sku)}`
          : null
        const inventoryItemId = query
          ? (await api(`/admin/inventory-items?${query}`)).inventory_items?.[0]?.id
          : (
              await api(
                `/admin/products/${createdProduct.id}?fields=variants.inventory_items.inventory_item_id`
              )
            ).product?.variants?.[0]?.inventory_items?.[0]?.inventory_item_id
        if (inventoryItemId) {
          await api(`/admin/inventory-items/${inventoryItemId}/location-levels`, {
            method: "POST",
            body: JSON.stringify({
              location_id: location.id,
              stocked_quantity: product.stock,
            }),
          })
        } else {
          console.warn(`\n  sklad se nepovedlo nastavit: ${product.title}`)
        }
      }

      created += 1
      process.stdout.write(
        `\r${created}/${products.length}  ${product.title.slice(0, 56).padEnd(56)}`
      )
    } catch (error) {
      failures.push({ title: product.title, message: error.message })
      console.error(`\n  CHYBA (${product.title}): ${error.message}`)
    }
  }

  console.log(`\n\nDone: ${created} created, ${failures.length} failed.`)
  for (const failure of failures) console.log(`  ✗ ${failure.title}: ${failure.message}`)
}
