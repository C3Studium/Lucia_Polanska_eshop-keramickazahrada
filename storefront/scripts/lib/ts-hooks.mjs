/**
 * Hooky Node pro skripty, které potřebují TypeScript ze `src/` (registr
 * právních dokumentů, převod do CMS, zámek Studia) — bez tsx a bez buildu.
 *
 * Node 24 umí TypeScript sám jen napůl: typy smaže, ale nedohledá import bez
 * přípony (`../types`), nezná aliasy `@lib/*` a JSX v `inline.tsx` nepřeloží.
 * Tohle doplní právě ty tři věci a nic víc:
 *
 * - `resolve`: `@lib/…`, `@modules/…` a relativní importy bez přípony uvnitř
 *   `src/` → `.ts` / `.tsx` / `.js` / `.json` / `index.*`; `server-only` → prázdný
 *   modul (v Nextu hlídá klientský balík, v Node by jen spadl).
 * - `load`: `.ts` / `.tsx` ze `src/` přeloží TypeScriptem storefrontu
 *   (`typescript` je v devDependencies) na ESM s `react/jsx-runtime`; JSON bez
 *   atributu `with { type: "json" }` (registr ho tak importuje) vrátí jako
 *   modul s `export default`.
 *
 * Zapíná se přes `./ts-register.mjs`:
 *   node --import ./scripts/lib/ts-register.mjs scripts/legal-cms-roundtrip.test.mjs
 */
import { existsSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import ts from "typescript"

const STOREFRONT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const SRC = path.join(STOREFRONT, "src")
const ALIASES = [
  ["@lib/", path.join(SRC, "lib")],
  ["@modules/", path.join(SRC, "modules")],
]
const EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".json"]
const STUBS = new Set(["server-only"])

/** Windows: porovnávat cesty bez ohledu na velikost písmen (C:\ vs c:\). */
const inside = (file, dir) => file.toLowerCase().startsWith(dir.toLowerCase())

const isFile = (file) => {
  try {
    return statSync(file).isFile()
  } catch {
    return false
  }
}

const locate = (base) => {
  if (isFile(base)) return base
  for (const ext of EXTENSIONS) if (isFile(base + ext)) return base + ext
  for (const ext of EXTENSIONS) {
    const index = path.join(base, `index${ext}`)
    if (existsSync(index)) return index
  }
  return null
}

export async function resolve(specifier, context, next) {
  if (STUBS.has(specifier)) {
    return { url: "data:text/javascript,export {}", shortCircuit: true }
  }
  for (const [prefix, dir] of ALIASES) {
    if (!specifier.startsWith(prefix)) continue
    const found = locate(path.join(dir, specifier.slice(prefix.length)))
    if (found) return { url: pathToFileURL(found).href, shortCircuit: true }
  }
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL?.startsWith("file:")
  ) {
    const parent = fileURLToPath(context.parentURL)
    if (inside(parent, SRC)) {
      const found = locate(path.resolve(path.dirname(parent), specifier))
      if (found) return { url: pathToFileURL(found).href, shortCircuit: true }
    }
  }
  return next(specifier, context)
}

export async function load(url, context, next) {
  if (!url.startsWith("file:")) return next(url, context)
  const file = fileURLToPath(url)
  if (!inside(file, SRC)) return next(url, context)

  if (/\.tsx?$/.test(file)) {
    const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), {
      fileName: file,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
        isolatedModules: true,
        sourceMap: false,
      },
    })
    return { format: "module", source: outputText, shortCircuit: true }
  }

  // JSON s atributem nechat Nodu (jinak by nesouhlasil formát s atributem).
  if (file.endsWith(".json") && context.importAttributes?.type !== "json") {
    return {
      format: "module",
      source: `export default ${readFileSync(file, "utf8")}`,
      shortCircuit: true,
    }
  }

  return next(url, context)
}
