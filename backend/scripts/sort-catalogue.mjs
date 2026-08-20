/**
 * Dotřídění produktů, které po importu z WooCommerce zůstaly bez zařazení.
 *
 * Import z `import-woo.mjs` záměrně nepřiřazoval staré Woo kategorie („Lucia
 * sorts the catalogue herself") — jen si původní název schoval do
 * `metadata.import_categories`. 72 z 263 produktů tak nemá ani kolekci, ani
 * kategorii a v adminu i v obchodě se při procházení podle kategorií neukážou:
 * odtud stížnost, že „chybí fotky" u Ještěrek na fasádu nebo modelovaných
 * zvonkových tlačítek. Fotky nechyběly, chybělo zařazení.
 *
 * Pravidla níž nejsou vymyšlená — jsou odečtená z toho, jak Lucie zatřídila
 * prvních 187 kusů (viz komentáře u jednotlivých pravidel). Tři místa, kde se
 * jedna stará kategorie štěpí a data odpověď nedala, rozhodl Matěj 2026-08-20:
 * figurální zvonková tlačítka jdou do Original i Zdobená, slunečnice do Velké
 * květy do zahrady, dýně-lucerna do Sošky.
 *
 * Běží proti nasazenému backendu přes admin API, takže nepotřebuje přístup k DB
 * a všechny zápisy jdou standardní cestou (workflow, události, revalidace):
 *
 *   node scripts/sort-catalogue.mjs             # rozbor + tabulka, nic nezapíše
 *   node scripts/sort-catalogue.mjs --apply     # zapíše zařazení
 *   node scripts/sort-catalogue.mjs --apply --limit 5
 *
 * Auth: IMPORT_ADMIN_EMAIL + IMPORT_ADMIN_PASSWORD (backend/.env stačí).
 * Backend přes IMPORT_BACKEND_URL.
 */

import { readFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))

for (const envPath of [join(HERE, "../.env")]) {
  if (!existsSync(envPath)) continue
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2]
  }
}

const BASE = (
  process.env.IMPORT_BACKEND_URL ??
  "https://backend-production-81e2.up.railway.app"
).replace(/\/+$/, "")

const args = new Set(process.argv.slice(2))
const APPLY = args.has("--apply")
const limitArg = process.argv.indexOf("--limit")
const LIMIT =
  limitArg !== -1 ? Number(process.argv[limitArg + 1]) : Number.POSITIVE_INFINITY

// ----------------------------------------------------------------- API client
let token = null

async function login() {
  const email = process.env.IMPORT_ADMIN_EMAIL
  const password = process.env.IMPORT_ADMIN_PASSWORD
  if (!email || !password) {
    throw new Error(
      "Nastavte IMPORT_ADMIN_EMAIL a IMPORT_ADMIN_PASSWORD (env nebo backend/.env)."
    )
  }
  const response = await fetch(`${BASE}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) throw new Error(`Přihlášení selhalo: ${response.status}`)
  token = (await response.json()).token
}

async function api(path, init = {}, retried = false) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  })
  if (response.status === 401 && !retried) {
    await login()
    return api(path, init, true)
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(
      `${init.method ?? "GET"} ${path} → ${response.status}: ${body.slice(0, 300)}`
    )
  }
  return response.json()
}

async function pageThrough(path, key) {
  const all = []
  for (let offset = 0; ; offset += 100) {
    const separator = path.includes("?") ? "&" : "?"
    const page = await api(`${path}${separator}limit=100&offset=${offset}`)
    all.push(...page[key])
    if (page[key].length < 100) break
  }
  return all
}

// -------------------------------------------------------------------- pravidla
/**
 * Zvonková tlačítka s figurálním motivem — zvíře nebo postava modelovaná
 * v reliéfu, proti dekoru (hvězdy, květ, pruhy, mořské dno). Popisek je
 * rozlišit neumí: „ručně modelované" mají úplně všechna, i Fragment a Seabed.
 * Proto výčet podle názvu, ne heuristika.
 */
const FIGURALNI_ZVONKY =
  /(kočka|kočky|sova|spolu|ptačí zpěv|stromy)/i

/** Volně stojící plastiky proti těm na zeď — obojí měly ve Woo jednu kategorii. */
const SOSKY = /(kočičák viktor|kočka na parapet)/i

/**
 * Pravidla se zkouší shora dolů, první shoda vyhrává.
 *
 * `title` má přednost před `woo`, protože pár kusů má ve staré kategorii
 * vypsaný půlku e-shopu — dárkový poukaz za 500 Kč nese deset Woo kategorií
 * včetně Zvonkových tlačítek a bez přednosti názvu by skončil mezi nimi.
 */
const RULES = [
  // ── výjimky podle názvu ────────────────────────────────────────────────
  {
    why: "dárkový poukaz — vlastní kolekce, bez kategorie",
    title: /dárkový poukaz/i,
    collection: "Dárkové poukazy",
    categories: [],
  },
  {
    why: "mrazuvzdorný solitér, ne zápich a ne na zeď (rozhodnuto 2026-08-20)",
    title: /dýně na svíčku/i,
    collection: "Do zahrady a na fasádu",
    categories: ["Sošky"],
  },
  {
    why: "háček do koupelny/kuchyně — podle popisku interiér",
    title: /keramický háček/i,
    collection: "Do bytu",
    categories: ["Drobnosti pro radost"],
  },
  {
    why: "schránka, i když v exportu kategorii nemá",
    title: /poštovní schránka/i,
    collection: "Do zahrady a na fasádu",
    categories: ["Poštovní schránky"],
  },
  {
    why: "ptáček jako dekorace, ne pítko — Woo ho mělo v obou",
    title: /ptáček na noze/i,
    collection: "Do zahrady a na fasádu",
    categories: ["Zápichy a drobnosti pro radost"],
  },

  // ── zvonková tlačítka ──────────────────────────────────────────────────
  // Klasik/Retro/Zdobená čte přesně její vlastní vzor: 15× Klasik a 4× Retro
  // mají ten název v titulku, zbylých 33 skončilo ve Zdobená.
  {
    why: "Klasik podle názvu — stejně jako 15 už zatříděných",
    woo: /Zvonková tlačítka/i,
    title: /klasik/i,
    collection: "Zvonková tlačítka",
    categories: ["Klasik"],
  },
  {
    why: "Retro podle názvu — stejně jako 4 už zatříděná",
    woo: /Zvonková tlačítka/i,
    title: /retro/i,
    collection: "Zvonková tlačítka",
    categories: ["Retro"],
  },
  {
    why: "figurální motiv → Original i Zdobená (rozhodnuto 2026-08-20)",
    woo: /Zvonková tlačítka/i,
    title: FIGURALNI_ZVONKY,
    collection: "Zvonková tlačítka",
    categories: ["Original", "Zdobená"],
  },
  {
    why: "dekor bez figury → Zdobená, kam patří zbytek",
    woo: /Zvonková tlačítka|Bezdrátové zvonky/i,
    collection: "Zvonková tlačítka",
    categories: ["Zdobená"],
  },

  // ── květiny ────────────────────────────────────────────────────────────
  {
    why: "růže má vlastní kategorii s 20 kusy",
    woo: /Keramické květiny/i,
    title: /růže/i,
    collection: "Květiny",
    categories: ["Růže"],
  },
  {
    why: "slunečnice na tyčku do zahrady (rozhodnuto 2026-08-20)",
    woo: /Keramické květiny/i,
    title: /slunečnice/i,
    collection: "Květiny",
    categories: ["Velké květy do zahrady"],
  },
  {
    why: "ostatní druhy — Vlčí mák červený tam už je",
    woo: /Keramické květiny/i,
    collection: "Květiny",
    categories: ["Různé druhy"],
  },

  // ── zahrada a fasáda ───────────────────────────────────────────────────
  {
    why: "volně stojící soška, ne plastika na zeď",
    woo: /Domovní znamení a plastiky/i,
    title: SOSKY,
    collection: "Do zahrady a na fasádu",
    categories: ["Sošky"],
  },
  {
    why: "domovní znamení a plastiky na zeď — 10 z 11 už tam je",
    woo: /Domovní znamení a plastiky/i,
    collection: "Do zahrady a na fasádu",
    categories: ["Plastiky na zeď"],
  },
  {
    why: "domovní čísla mají v novém katalogu stejný název",
    woo: /Domovní čísla/i,
    collection: "Do zahrady a na fasádu",
    categories: ["Domovní čísla"],
  },
  {
    why: "poštovní schránky mají stejný název",
    woo: /Poštovní schránky/i,
    collection: "Do zahrady a na fasádu",
    categories: ["Poštovní schránky"],
  },
  {
    why: "Pítka a fontány + Krmítka se slily do Pítka a krmítka",
    woo: /Pítka a fontány|Krmítka/i,
    collection: "Do zahrady a na fasádu",
    categories: ["Pítka a krmítka"],
  },
  {
    why: "zahradní zápichy a drobnosti — 28 kusů už tam je",
    woo: /Zápichy a drobnosti pro radost/i,
    collection: "Do zahrady a na fasádu",
    categories: ["Zápichy a drobnosti pro radost"],
  },

  // ── byt ────────────────────────────────────────────────────────────────
  {
    why: "mýdlenky mají v novém katalogu stejný název",
    woo: /Mýdlenky na tuhá mýdla/i,
    collection: "Do bytu",
    categories: ["Mýdlenky na tuhá mýdla"],
  },
  {
    why: "mísy, talíře a podnosy → Štrůdláky a talíře",
    woo: /Mísy, talíře a podnosy/i,
    collection: "Do bytu",
    categories: ["Štrůdláky a talíře"],
  },
  {
    why: "květináče a žardiny → Květináče",
    woo: /Květináče a žardiny/i,
    collection: "Do zahrady a na fasádu",
    categories: ["Květináče"],
  },
]

const matchRule = (product) => {
  const woo = product.metadata?.import_categories ?? ""
  for (const rule of RULES) {
    if (rule.title && !rule.title.test(product.title)) continue
    if (rule.woo && !rule.woo.test(woo)) continue
    if (!rule.title && !rule.woo) continue
    return rule
  }
  return null
}

// ----------------------------------------------------------------------- běh
await login()

const [products, collections, categories] = await Promise.all([
  pageThrough(
    "/admin/products?fields=id,title,collection_id,metadata,categories.id",
    "products"
  ),
  pageThrough("/admin/collections?fields=id,title", "collections"),
  pageThrough("/admin/product-categories?fields=id,name", "product_categories"),
])

const collectionId = new Map(collections.map((c) => [c.title, c.id]))
const categoryId = new Map(categories.map((c) => [c.name, c.id]))

/* Jen produkty, které nemají ani kolekci, ani kategorii — cokoliv, čeho se už
   Lucie dotkla, zůstává na pokoji. Skript je tak bezpečné pustit i podruhé. */
const unsorted = products.filter(
  (product) => !product.collection_id && !(product.categories ?? []).length
)

console.log(`backend: ${BASE}`)
console.log(
  `produktů celkem: ${products.length} | bez zařazení: ${unsorted.length}\n`
)

const plan = []
const unmatched = []
for (const product of unsorted) {
  const rule = matchRule(product)
  if (!rule) {
    unmatched.push(product)
    continue
  }
  const missing = [
    ...(collectionId.has(rule.collection) ? [] : [`kolekce „${rule.collection}"`]),
    ...rule.categories.filter((name) => !categoryId.has(name)).map((n) => `kategorie „${n}"`),
  ]
  if (missing.length) {
    unmatched.push({ ...product, problem: `chybí ${missing.join(", ")}` })
    continue
  }
  plan.push({ product, rule })
}

const groups = new Map()
for (const entry of plan) {
  const key = `${entry.rule.collection} › ${entry.rule.categories.join(" + ") || "(bez kategorie)"}`
  if (!groups.has(key)) groups.set(key, { why: entry.rule.why, items: [] })
  groups.get(key).items.push(entry.product.title)
}

for (const [key, group] of [...groups].sort()) {
  console.log(`── ${key}  (${group.items.length})`)
  console.log(`   ↳ ${group.why}`)
  for (const title of group.items) console.log(`      ${title}`)
  console.log()
}

if (unmatched.length) {
  console.log(`⚠ bez pravidla (${unmatched.length}) — zůstanou nezařazené:`)
  for (const product of unmatched) {
    console.log(
      `   ${product.title}  [${product.problem ?? product.metadata?.import_categories ?? "bez staré kategorie"}]`
    )
  }
  console.log()
}

console.log(`k zařazení: ${plan.length} | bez pravidla: ${unmatched.length}`)

if (!APPLY) {
  console.log("\n(zkušební běh — nic se nezapsalo; spusťte s --apply)")
  process.exit(0)
}

let done = 0
const failures = []
for (const { product, rule } of plan.slice(0, LIMIT)) {
  try {
    await api(`/admin/products/${product.id}`, {
      method: "POST",
      body: JSON.stringify({
        collection_id: collectionId.get(rule.collection),
        categories: rule.categories.map((name) => ({ id: categoryId.get(name) })),
      }),
    })
    done += 1
    process.stdout.write(`\r${done}/${plan.length}  ${product.title.slice(0, 56).padEnd(56)}`)
  } catch (error) {
    failures.push({ title: product.title, message: error.message })
  }
}

console.log(`\n\nHotovo: ${done} zařazeno, ${failures.length} selhalo.`)
for (const failure of failures) console.log(`  ✗ ${failure.title}: ${failure.message}`)
