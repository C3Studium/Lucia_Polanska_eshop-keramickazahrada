/**
 * Rewrites the file host inside every URL the database stores.
 *
 * Medusa keeps ABSOLUTE urls — `image.url`, `product.thumbnail`, and a long
 * tail of metadata columns (vouchers, commissions, legal manifests, order
 * documents). Pointing `R2_PUBLIC_URL` at a new host therefore only affects
 * files uploaded from that moment on; everything already in the catalogue
 * keeps the old address until it is rewritten here.
 *
 *   node scripts/prepis-url-souboru.mjs --from img.matejforejt.com --to img.keramickazahrada.cz
 *   node scripts/prepis-url-souboru.mjs --from … --to … --yes
 *
 * Without `--yes` it only reports: every table.column in the public schema
 * whose text, varchar, json or jsonb value contains the old host, with a row
 * count. With `--yes` it rewrites them inside one transaction.
 *
 * Both hosts must already serve the same bucket before this runs — R2 allows
 * up to 100 custom domains per bucket, so the old and the new address can
 * answer side by side and nothing goes dark while this is applied.
 *
 * Connection: DATABASE_URL env (in the Railway container it is the private
 * URL; locally use the public one). Uses the `pg` package from node_modules.
 */

import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
// pnpm keeps pg nested; in the Railway container it resolves normally.
const pgPath = ["pg", ...[
  "8.20.0", "8.16.3",
].map((v) => new URL(`../node_modules/.pnpm/pg@${v}/node_modules/pg`, import.meta.url).pathname)]
  .find((candidate) => {
    try { require.resolve(candidate); return true } catch { return false }
  })
const { Client } = require(pgPath ?? "pg")

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? undefined : process.argv[i + 1]
}

const FROM = arg("from")
const TO = arg("to")
const YES = process.argv.includes("--yes")
const url = process.env.DATABASE_URL

if (!FROM || !TO) {
  console.error("Usage: --from img.old.cz --to img.new.cz [--yes]")
  process.exit(1)
}
if (!url) {
  console.error("DATABASE_URL is not set.")
  process.exit(1)
}
/* A bare hostname only. A full url with a scheme would also match inside
   longer strings and leave half-rewritten addresses behind. */
if (/[\/:]/.test(FROM) || /[\/:]/.test(TO)) {
  console.error("Pass hostnames without scheme or path, e.g. img.matejforejt.com")
  process.exit(1)
}

/* Which columns can hold a url at all. Generated columns are skipped — they
   are derived and would be rejected by UPDATE. */
const SCAN = `
  SELECT c.table_name, c.column_name, c.data_type,
         (xpath('/row/c/text()', query_to_xml(
            format('select count(*) as c from %I.%I where %I::text like %L',
                   c.table_schema, c.table_name, c.column_name, '%' || $1 || '%'),
            false, true, '')))[1]::text::bigint AS hits
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
   WHERE c.table_schema = 'public'
     AND t.table_type = 'BASE TABLE'
     AND c.is_generated = 'NEVER'
     AND c.data_type IN ('text', 'character varying', 'json', 'jsonb')
   ORDER BY c.table_name, c.column_name
`

const client = new Client({ connectionString: url })
await client.connect()

const host = (() => {
  try { return new URL(url).host } catch { return "?" }
})()
console.log(`Database: ${host}`)
console.log(`Rewrite:  ${FROM}  ->  ${TO}`)
console.log(YES ? "Mode:     APPLY\n" : "Mode:     dry run (add --yes to apply)\n")

const { rows } = await client.query(SCAN, [FROM])
const hits = rows.filter((r) => Number(r.hits) > 0)

if (!hits.length) {
  console.log(`Nothing stores ${FROM}. Nothing to do.`)
  await client.end()
  process.exit(0)
}

const width = Math.max(...hits.map((r) => `${r.table_name}.${r.column_name}`.length))
let total = 0
for (const r of hits) {
  console.log(`  ${`${r.table_name}.${r.column_name}`.padEnd(width)}  ${String(r.hits).padStart(6)} rows  (${r.data_type})`)
  total += Number(r.hits)
}
console.log(`\n  ${hits.length} columns, ${total} rows in total.`)

if (!YES) {
  console.log("\nDry run — nothing was changed.")
  await client.end()
  process.exit(0)
}

/* json/jsonb go through text and back; the value is re-serialised, so key
   order may change, but nothing else does. */
const updateFor = (r) => {
  const col = `"${r.column_name}"`
  const table = `public."${r.table_name}"`
  const body = r.data_type === "json" || r.data_type === "jsonb"
    ? `${col} = replace(${col}::text, $1, $2)::${r.data_type}`
    : `${col} = replace(${col}, $1, $2)`
  return `UPDATE ${table} SET ${body} WHERE ${col}::text LIKE '%' || $1 || '%'`
}

console.log("")
await client.query("BEGIN")
try {
  let changed = 0
  for (const r of hits) {
    const res = await client.query(updateFor(r), [FROM, TO])
    changed += res.rowCount
    console.log(`  ${`${r.table_name}.${r.column_name}`.padEnd(width)}  ${String(res.rowCount).padStart(6)} rows rewritten`)
  }
  await client.query("COMMIT")
  console.log(`\nDone — ${changed} rows committed.`)
} catch (err) {
  await client.query("ROLLBACK")
  console.error("\nRolled back, nothing changed:", err.message)
  process.exitCode = 1
}

await client.end()
