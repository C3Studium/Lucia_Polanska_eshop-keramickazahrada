/**
 * Restores categories + collections from the pre-wipe backup DB into the
 * current shop — the taxonomy Lucia curated (sub-categories, hidden flags,
 * category↔collection links) that the wipe took with it.
 *
 * Reads the BACKUP database directly (read-only), writes into the CURRENT
 * shop through the admin API, so every row goes through Medusa's own
 * validation. Old ids are remapped; `metadata.collection_id` links (the
 * Rozdělení wiring) are rewritten to the new collection ids.
 *
 * Where a category with the same handle already exists in the current shop
 * (the 16 flat ones created from the Woo CSV), the backup version WINS: the
 * flat one is deleted first — safe while no product has categories assigned —
 * and the curated one (with hierarchy and metadata) is created in its place.
 *
 *   BACKUP_DATABASE_URL=postgresql://… node scripts/restore-taxonomy.mjs           # dry run
 *   BACKUP_DATABASE_URL=postgresql://… node scripts/restore-taxonomy.mjs --yes     # execute
 *
 * Admin auth: IMPORT_ADMIN_EMAIL / IMPORT_ADMIN_PASSWORD (backend/.env works).
 */

import { readFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const HERE = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pgPath = ["pg", ...["8.20.0", "8.16.3"].map(
  (version) => new URL(`../node_modules/.pnpm/pg@${version}/node_modules/pg`, import.meta.url).pathname
)].find((candidate) => {
  try { require.resolve(candidate); return true } catch { return false }
})
const { Client } = require(pgPath ?? "pg")

for (const envPath of [join(HERE, "../.env")]) {
  if (!existsSync(envPath)) continue
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2]
  }
}

const YES = process.argv.includes("--yes")
const BASE = (process.env.IMPORT_BACKEND_URL ?? "https://dev.matejforejt.com").replace(/\/+$/, "")
const backupUrl = process.env.BACKUP_DATABASE_URL
if (!backupUrl) {
  console.error("BACKUP_DATABASE_URL není nastavené — connection string záložní DB.")
  process.exit(1)
}

// ------------------------------------------------------------------- admin API
let token = null
async function login() {
  const response = await fetch(`${BASE}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.IMPORT_ADMIN_EMAIL,
      password: process.env.IMPORT_ADMIN_PASSWORD,
    }),
  })
  if (!response.ok) throw new Error(`Login failed: ${response.status}`)
  token = (await response.json()).token
}
async function api(path, init = {}, retried = false) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
    },
  })
  if (response.status === 401 && !retried) {
    await login()
    return api(path, init, true)
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`${init.method ?? "GET"} ${path} → ${response.status}: ${body.slice(0, 300)}`)
  }
  return response.json()
}

// -------------------------------------------------------------- read the backup
const backup = new Client({ connectionString: backupUrl })
await backup.connect()

const { rows: collections } = await backup.query(
  `SELECT id, title, handle, metadata FROM product_collection
   WHERE deleted_at IS NULL ORDER BY title`
)
const { rows: categories } = await backup.query(
  `SELECT id, name, description, handle, is_active, is_internal, rank,
          parent_category_id, metadata
   FROM product_category WHERE deleted_at IS NULL ORDER BY rank, name`
)
await backup.end()

console.log(`Záloha: ${collections.length} kolekcí, ${categories.length} kategorií`)
console.log("\nKOLEKCE:")
for (const collection of collections) {
  console.log(`  ${collection.title}${collection.metadata?.hidden ? "  (skrytá)" : ""}`)
}
console.log("\nKATEGORIE (strom):")
const byParent = new Map()
for (const category of categories) {
  const key = category.parent_category_id ?? ""
  if (!byParent.has(key)) byParent.set(key, [])
  byParent.get(key).push(category)
}
const printTree = (parentId, indent) => {
  for (const category of byParent.get(parentId ?? "") ?? []) {
    const flags = [
      category.metadata?.hidden ? "skrytá" : null,
      category.is_internal ? "interní" : null,
      !category.is_active ? "neaktivní" : null,
    ].filter(Boolean).join(", ")
    console.log(`  ${"  ".repeat(indent)}${category.name}${flags ? `  (${flags})` : ""}`)
    printTree(category.id, indent + 1)
  }
}
printTree(null, 0)

if (!YES) {
  console.log("\nDry run — nic se nezapsalo. Spusťte s --yes.")
  process.exit(0)
}

// --------------------------------------------------------------------- restore
await login()

// Current state, for dedupe by handle.
const { collections: currentCollections } = await api(`/admin/collections?limit=100&fields=id,title,handle`)
const { product_categories: currentCategories } = await api(
  `/admin/product-categories?limit=100&fields=id,name,handle`
)

const collectionIdMap = new Map()
for (const collection of collections) {
  const existing = currentCollections.find((entry) => entry.handle === collection.handle)
  if (existing) {
    collectionIdMap.set(collection.id, existing.id)
    console.log(`kolekce existuje: ${collection.title}`)
    continue
  }
  const created = await api(`/admin/collections`, {
    method: "POST",
    body: JSON.stringify({
      title: collection.title,
      handle: collection.handle,
      ...(collection.metadata ? { metadata: collection.metadata } : {}),
    }),
  })
  collectionIdMap.set(collection.id, created.collection.id)
  console.log(`kolekce založena: ${collection.title}`)
}

/* Categories parents-first; a same-handle flat one from the CSV round is
   replaced (delete + recreate), so hierarchy and metadata come from the backup. */
const categoryIdMap = new Map()
const createCategory = async (category) => {
  const clash = currentCategories.find((entry) => entry.handle === category.handle)
  if (clash) {
    await api(`/admin/product-categories/${clash.id}`, { method: "DELETE" })
    console.log(`  nahrazuji plochou verzi: ${category.name}`)
  }
  const metadata = { ...(category.metadata ?? {}) }
  if (typeof metadata.collection_id === "string" && collectionIdMap.has(metadata.collection_id)) {
    metadata.collection_id = collectionIdMap.get(metadata.collection_id)
  }
  const created = await api(`/admin/product-categories`, {
    method: "POST",
    body: JSON.stringify({
      name: category.name,
      handle: category.handle,
      description: category.description ?? undefined,
      is_active: category.is_active,
      is_internal: category.is_internal,
      rank: category.rank ?? undefined,
      parent_category_id: category.parent_category_id
        ? categoryIdMap.get(category.parent_category_id) ?? undefined
        : undefined,
      ...(Object.keys(metadata).length ? { metadata } : {}),
    }),
  })
  categoryIdMap.set(category.id, created.product_category.id)
  console.log(`kategorie založena: ${category.name}`)
}
const walk = async (parentId) => {
  for (const category of byParent.get(parentId ?? "") ?? []) {
    await createCategory(category)
    await walk(category.id)
  }
}
await walk(null)

console.log(
  `\nHotovo: ${collectionIdMap.size} kolekcí, ${categoryIdMap.size} kategorií obnoveno z den zálohy.`
)
