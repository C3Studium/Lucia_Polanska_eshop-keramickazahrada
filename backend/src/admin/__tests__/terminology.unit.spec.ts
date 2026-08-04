import fs from "fs"
import path from "path"

/**
 * §17's banlist, enforced rather than reviewed (P11-1, AC-8).
 *
 * The plan lists terms the client must never see: „fulfillment", „metadata",
 * „workflow", „reservation", raw ids like `order_01H…`. A one-off grep proves
 * nothing a week later, because the next Czech string somebody adds is the one
 * that slips. This runs with every test.
 *
 * It reads only *rendered* text — JSX text nodes, copy props, toast messages —
 * because the ban is on what she reads, not on what the code is called.
 * `variant_id` as a field name is correct; „variant_id" in a sentence is not.
 */

const BANNED = [
  "fulfillment",
  "fulfilment",
  "metadata",
  "workflow",
  "reservation",
  "payment collection",
  "price list",
  "variant_id",
  "product_id",
  "order_id",
  "undefined",
  "[object",
]

const ADMIN_DIR = path.join(__dirname, "..")

const collect = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : collect(full)
    }
    return entry.isFile() && entry.name.endsWith(".tsx") ? [full] : []
  })

/** Rendered copy only — comments and identifiers are not what she reads. */
const visibleStrings = (source: string): string[] => {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")

  return [
    ...(withoutComments.match(/>\s*[^<>{}\n]{4,160}?\s*</g) ?? []).map((match) =>
      match.slice(1, -1).trim()
    ),
    ...Array.from(
      withoutComments.matchAll(
        /(?:label|title|description|placeholder|successMessage|confirmLabel|emptyTitle|emptyDescription)\s*[:=]\s*"([^"]{4,200})"/g
      )
    ).map((match) => match[1]),
    ...Array.from(
      withoutComments.matchAll(/toast\.\w+\(\s*"([^"]{4,200})"/g)
    ).map((match) => match[1]),
  ]
}

const files = collect(ADMIN_DIR)

describe("§17 terminology banlist", () => {
  it("finds admin files to check", () => {
    expect(files.length).toBeGreaterThan(10)
  })

  it.each(files.map((file) => [path.relative(ADMIN_DIR, file), file]))(
    "%s shows no technical terms to the client",
    (_name, file) => {
      const offences = visibleStrings(fs.readFileSync(file, "utf8")).flatMap(
        (text) =>
          BANNED.filter((term) => text.toLowerCase().includes(term)).map(
            (term) => `"${term}" in: ${text.slice(0, 80)}`
          )
      )

      expect(offences).toEqual([])
    }
  )

  it("shows no raw Medusa ids", () => {
    // §17: only #display_id, names and Czech badges reach a custom page.
    const idPattern = /\b(order|ful|payses|prod|variant|cus|pay)_[0-9A-Z]{10,}/i

    const offences = files.flatMap((file) =>
      visibleStrings(fs.readFileSync(file, "utf8"))
        .filter((text) => idPattern.test(text))
        .map((text) => `${path.relative(ADMIN_DIR, file)}: ${text.slice(0, 60)}`)
    )

    expect(offences).toEqual([])
  })
})
