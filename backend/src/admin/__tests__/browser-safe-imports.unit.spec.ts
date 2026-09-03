import { readdirSync, readFileSync, statSync } from "fs"
import { join, resolve } from "path"

/**
 * The admin UI is a browser bundle. Importing server-side code into it
 * compiles fine and even builds fine — and then crashes the whole admin at
 * load in production with `inherits(..., undefined)`, because the server
 * dependency graph (pg, jsonwebtoken, Node streams) cannot run in a browser.
 * That is exactly what happened when `routes/obsah` imported
 * `src/lib/constants` (which imports `@medusajs/framework/utils`) for one
 * env value. The value now crosses the wire via
 * `GET /admin/workbench/cms-config` instead.
 *
 * This spec pins the boundary: nothing under `src/admin` may runtime-import
 * anything outside it, except the explicit allowlist of PURE, dependency-free
 * modules below. Type-only imports (`import type`) are erased at compile time
 * and are fine.
 */

const ADMIN_ROOT = resolve(__dirname, "..")

/** Pure, dependency-free backend modules the admin deliberately shares. */
const PURE_MODULE_ALLOWLIST = [
  "modules/course/recurrence",
  "modules/course/bulk-scope",
  "icons/segment-icon",
]

const collectSources = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry !== "__tests__") collectSources(full, out)
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".d.ts")) {
      out.push(full)
    }
  }
  return out
}

/** Every runtime import specifier in a file (type-only imports excluded). */
const runtimeImports = (source: string): string[] => {
  const specifiers: string[] = []
  const pattern =
    /import\s+(type\s+)?[^"']*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|require\(\s*["']([^"']+)["']\s*\)/g
  for (const match of source.matchAll(pattern)) {
    if (match[1]) continue // `import type …` — erased, harmless
    const spec = match[2] ?? match[3] ?? match[4]
    if (spec) specifiers.push(spec)
  }
  return specifiers
}

describe("admin bundle stays browser-safe", () => {
  it("no admin file runtime-imports server code outside src/admin", () => {
    const offences: string[] = []

    for (const file of collectSources(ADMIN_ROOT)) {
      const source = readFileSync(file, "utf8")
      for (const spec of runtimeImports(source)) {
        if (!spec.startsWith(".")) continue // packages are vite's problem
        const target = resolve(join(file, "..", spec))
        if (target.startsWith(ADMIN_ROOT)) continue // inside src/admin — fine
        const allowed = PURE_MODULE_ALLOWLIST.some((pure) =>
          target.endsWith(pure.replace(/\//g, require("path").sep))
        )
        if (!allowed) {
          offences.push(
            `${file.slice(ADMIN_ROOT.length + 1)} → ${spec} (mimo src/admin a mimo allowlist čistých modulů)`
          )
        }
      }
    }

    expect(offences).toEqual([])
  })

  it("the allowlisted pure modules really have no runtime imports", () => {
    for (const pure of PURE_MODULE_ALLOWLIST) {
      const base = resolve(ADMIN_ROOT, "..", pure)
      let source: string
      try {
        source = readFileSync(`${base}.ts`, "utf8")
      } catch {
        source = readFileSync(`${base}.tsx`, "utf8")
      }
      const runtime = runtimeImports(source).filter(
        (spec) =>
          // Relative imports must themselves point at allowlisted pure files.
          !spec.startsWith(".") ||
          !PURE_MODULE_ALLOWLIST.some((other) =>
            resolve(ADMIN_ROOT, "..", pure, "..", spec).endsWith(
              other.split("/").pop() as string
            )
          )
      )
      expect({ module: pure, runtime }).toEqual({ module: pure, runtime: [] })
    }
  })
})
