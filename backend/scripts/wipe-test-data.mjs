/**
 * Full test-data wipe for the dev shop — everything a customer or a test run
 * created goes; everything that is CONFIGURATION stays.
 *
 * Goes:  products (variants, images, tags, prices), categories, collections,
 *        bundles, reviews, wishlists, restock + price-watch subscriptions,
 *        orders (incl. merchant-order state, production orders, return
 *        requests, fulfillments, payments), carts, customers, newsletter
 *        signups, sent-notification log.
 * Stays: regions, shipping options/profiles/zones, stock locations, sales
 *        channels, API keys, admin users, merchant settings, promotions,
 *        providers, store, currencies, migrations.
 *
 * The tricky part is prices: shipping-option prices live in the same price
 * module as product prices, so `price_set` must NOT be truncated — only the
 * sets linked to product variants are deleted, via the link table.
 *
 *   node scripts/wipe-test-data.mjs           # dry run — prints the plan + row counts
 *   node scripts/wipe-test-data.mjs --yes     # executes, one transaction
 *
 * Connection: DATABASE_URL env (in the Railway container it is the private
 * URL; locally use the public one). Uses the `pg` package from node_modules.
 */

import { createRequire } from "node:module"
import { existsSync } from "node:fs"
const require = createRequire(import.meta.url)
// pnpm keeps pg nested; in the Railway container it resolves normally.
const pgPath = ["pg", ...[
  "8.20.0", "8.16.3",
].map((v) => new URL(`../node_modules/.pnpm/pg@${v}/node_modules/pg`, import.meta.url).pathname)]
  .find((candidate) => {
    try { require.resolve(candidate); return true } catch { return false }
  })
const { Client } = require(pgPath ?? "pg")

const YES = process.argv.includes("--yes")
const url = process.env.DATABASE_URL
if (!url) {
  console.error("DATABASE_URL is not set.")
  process.exit(1)
}

/* Tables that hold test data — matched as exact names against the live schema,
   so a table that does not exist in this deploy is simply reported and skipped. */
const WIPE_EXACT = [
  // orders + everything hanging off them
  "order", "order_address", "order_change", "order_change_action", "order_item",
  "order_line_item", "order_line_item_adjustment", "order_line_item_tax_line",
  "order_shipping", "order_shipping_method", "order_shipping_method_adjustment",
  "order_shipping_method_tax_line", "order_summary", "order_transaction",
  "order_credit_line",
  // returns / claims / exchanges (native)
  "return", "return_item", "return_reason", "order_claim", "order_claim_item",
  "order_claim_item_image", "order_exchange", "order_exchange_item",
  // carts
  "cart", "cart_address", "cart_line_item", "cart_line_item_adjustment",
  "cart_line_item_tax_line", "cart_shipping_method",
  "cart_shipping_method_adjustment", "cart_shipping_method_tax_line",
  // customers (groups stay; membership rows go)
  "customer", "customer_address", "customer_group_customer",
  // payments (providers stay)
  "payment", "payment_collection", "payment_session", "refund", "capture",
  "refund_reason",
  // fulfillments (shipping options/sets/zones/profiles stay)
  "fulfillment", "fulfillment_item", "fulfillment_label", "fulfillment_address",
  // catalogue
  "product", "product_variant", "product_option", "product_option_value",
  "product_tag", "product_tags", "product_type", "product_category",
  "product_category_product", "product_collection", "image", "product_images",
  "product_variant_option",
  // inventory contents (locations stay)
  "inventory_item", "inventory_level", "reservation_item",
  // sent e-mails / bell log
  "notification",
]

/* Custom-module and link tables are matched by pattern — their exact names came
   from migrations we cannot read from here. Anything matching is test data. */
const WIPE_PATTERNS = [
  /review/i, /wishlist/i, /restock/i, /price_watch/i, /return_request/i,
  /bundle/i, /merchant_order/i, /production/i, /made_to_order/i,
  /newsletter/i,
  // module link tables (name style: cart_payment_collection, order_cart, ...)
  /^order_/i, /^cart_/i, /^product_(sales_channel|shipping_profile|variant_inventory)/i,
]

/* Never touch these, whatever the patterns say. */
const KEEP_ALWAYS = [
  /^mikro_orm/i, /migration/i, /^workflow/i, /^link_module/i, /^script/i,
  /^region/i, /^country/i, /^currency/i, /^store/i, /^sales_channel$/i,
  /^api_key/i, /^user$/i, /^auth_identity/i, /^provider_identity/i,
  /^shipping_option/i, /^shipping_profile/i, /^service_zone/i,
  /^fulfillment_set/i, /^fulfillment_provider/i, /^geo_zone/i,
  /^stock_location/i, /^payment_provider/i, /^notification_provider/i,
  /^promotion/i, /^campaign/i, /^customer_group$/i, /^price_preference/i,
  /^price_list/i, /^price_set$/i, /^price$/i, /^price_rule/i,
  /^tax_/i, /merchant_setting/i, /^invite/i, /^publishable/i,
]

const client = new Client({ connectionString: url })
await client.connect()

const { rows: tableRows } = await client.query(
  `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
)
const allTables = tableRows.map((row) => row.tablename)

const keep = (name) => KEEP_ALWAYS.some((pattern) => pattern.test(name))
const wipeSet = new Set()
for (const name of allTables) {
  if (keep(name)) continue
  if (WIPE_EXACT.includes(name)) wipeSet.add(name)
  else if (WIPE_PATTERNS.some((pattern) => pattern.test(name))) wipeSet.add(name)
}

const counts = {}
for (const name of wipeSet) {
  const { rows } = await client.query(`SELECT count(*)::int AS n FROM "${name}"`)
  counts[name] = rows[0].n
}

// Product-variant price sets — targeted, so shipping-option prices survive.
const hasVariantPriceLink = allTables.includes("product_variant_price_set")
let variantPriceSets = 0
if (hasVariantPriceLink) {
  const { rows } = await client.query(
    `SELECT count(*)::int AS n FROM product_variant_price_set`
  )
  variantPriceSets = rows[0].n
}

console.log("=== WIPE PLAN ===")
const withRows = [...wipeSet].filter((name) => counts[name] > 0).sort()
const empty = [...wipeSet].filter((name) => counts[name] === 0)
for (const name of withRows) console.log(`  ${String(counts[name]).padStart(6)}  ${name}`)
console.log(`  (+ ${empty.length} already-empty tables)`)
if (hasVariantPriceLink) {
  console.log(`  ${String(variantPriceSets).padStart(6)}  price_set rows linked to product variants (targeted DELETE)`)
}
console.log("\n=== KEPT (everything else), e.g. ===")
for (const name of allTables.filter((table) => !wipeSet.has(table)).slice(0, 200)) {
  if (/region|shipping|stock_location|sales_channel|api_key|^user$|merchant|promotion/.test(name)) {
    console.log(`  ${name}`)
  }
}

if (!YES) {
  console.log("\nDry run. Nothing deleted — run again with --yes to execute.")
  await client.end()
  process.exit(0)
}

console.log("\nExecuting…")
await client.query("BEGIN")
try {
  if (hasVariantPriceLink) {
    await client.query(
      `DELETE FROM price_set WHERE id IN (SELECT price_set_id FROM product_variant_price_set)`
    )
    await client.query(`TRUNCATE TABLE product_variant_price_set`)
  }
  const list = [...wipeSet].map((name) => `"${name}"`).join(", ")
  if (list) await client.query(`TRUNCATE TABLE ${list} CASCADE`)
  await client.query("COMMIT")
  console.log("Done. Test data wiped; configuration untouched.")
} catch (error) {
  await client.query("ROLLBACK")
  console.error("FAILED — rolled back, nothing was deleted:", error.message)
  process.exitCode = 1
}
await client.end()
