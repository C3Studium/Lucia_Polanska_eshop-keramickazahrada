/**
 * Z palety v SCSS udělá i TypeScript, aby měl JavaScript stejný zdroj jako CSS.
 *
 * Proč to vůbec existuje: barvy webu žijí v `src/styles/system/_colors.scss` jako CSS
 * custom properties a stylesheety je čtou přes `var(--token)`. Jenže část barev se
 * nekreslí ze stylů — framer-motion interpoluje mezi konkrétními hodnotami, WebGL shader
 * dostává pole barev, a `var()` ani jedno z toho nespolkne. Těch míst bylo 95 ve 24
 * souborech a všechna měla barvu napsanou natvrdo, takže „změň barvu na jednom místě"
 * platilo jen pro CSS a pro JS ne.
 *
 * Tenhle skript ten rozpor ruší: paleta zůstává jediným zdrojem a tady z ní vzniká
 * `src/styles/palette.generated.ts`. Když se v SCSS změní hodnota, změní se i v JS.
 *
 *   node scripts/gen-palette.mjs
 *
 * Spouští se ze `sync:styles`, takže se o to nikdo nemusí starat ručně.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, "..", "src")
const VSTUP = join(SRC, "styles", "system", "_colors.scss")
const VYSTUP = join(SRC, "styles", "palette.generated.ts")

const scss = readFileSync(VSTUP, "utf8")

/* Komentáře pryč, ať se z nich netahají hodnoty, které nikde neplatí. */
const cisty = scss
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1")

const tokeny = new Map()

/* `--token: #hex;` */
for (const m of cisty.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
  tokeny.set(m[1], m[2].toLowerCase())
}

/* `--token-rgb: r g b;` — z něj vzniká i `--token`, takže se doplní obojí. */
for (const m of cisty.matchAll(/--([\w-]+)-rgb\s*:\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g)) {
  const hex =
    "#" + [m[2], m[3], m[4]].map((v) => Number(v).toString(16).padStart(2, "0")).join("")
  if (!tokeny.has(m[1])) tokeny.set(m[1], hex)
}

if (tokeny.size === 0) {
  throw new Error("V paletě jsem nenašel ani jeden token — zkontroluj " + VSTUP)
}

/* Identifikátor pro TS: `--ink-05` → `ink05`, `--bgWhite` → `bgWhite`. */
const idFor = (name) =>
  name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase()).replace(/[^\w$]/g, "")

const radky = [...tokeny.entries()].sort((a, b) => a[0].localeCompare(b[0]))

const out = []
out.push("/*")
out.push(" * VYGENEROVÁNO — needituj.")
out.push(" *")
out.push(" * Zdroj: src/styles/system/_colors.scss · generátor: scripts/gen-palette.mjs")
out.push(" *")
out.push(" * Barvy se mění v tom SCSS. Tenhle soubor z něj vzniká, aby měl JavaScript stejné")
out.push(" * hodnoty jako CSS — pro framer-motion, které interpoluje mezi konkrétními barvami,")
out.push(" * a pro WebGL, které dostává pole hodnot. Obojí `var(--token)` nespolkne.")
out.push(" *")
out.push(" * V CSS sahej po `var(--token)`, ne po tomhle. Tohle je jen pro JavaScript.")
out.push(" */")
out.push("")
out.push("export const palette = {")
for (const [name, hex] of radky) {
  out.push(`  ${JSON.stringify(idFor(name))}: ${JSON.stringify(hex)},`)
}
out.push("} as const")
out.push("")
out.push("export type PaletteToken = keyof typeof palette")
out.push("")
out.push("/** Barva jako `rgb(r g b / alpha)` — pro místa, kde je potřeba průhlednost. */")
out.push("export function alpha(token: PaletteToken, a: number): string {")
out.push("  const hex = palette[token]")
out.push("  const n = parseInt(hex.slice(1), 16)")
out.push("  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${a})`")
out.push("}")
out.push("")

writeFileSync(VYSTUP, out.join("\n"))
console.log(`palette.generated.ts — ${tokeny.size} tokenů z _colors.scss`)
