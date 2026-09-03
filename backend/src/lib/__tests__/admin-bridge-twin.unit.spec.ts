import { readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * The two copies of the bridge token must not drift.
 *
 * `backend/src/lib/admin-bridge-token.ts` signs and the storefront's mirror
 * verifies — of the same bytes, with the same HMAC, over the same payload
 * shape. A well-meaning edit to one side (a field renamed, base64url tweaked,
 * the TTL changed) would not fail any build: it would simply stop admins from
 * ever seeing the bar, with no error anywhere to say why.
 *
 * So the code below the doc comment is compared literally. If this fails, the
 * fix is to copy the backend file over the storefront one — the backend is the
 * source of truth — not to loosen the test.
 */

const CODE_START = /\*\/\s*\n/

const codeOf = (path: string): string => {
  const text = readFileSync(path, "utf8")
  // Everything after the module's leading doc comment; the headers differ on
  // purpose (each points at the other) and are not part of the wire format.
  const parts = text.split(CODE_START)
  return parts.slice(2).join("*/\n").replace(/\r\n/g, "\n").trim()
}

describe("admin bridge token twin", () => {
  it("storefront mirror is identical to the backend source below the header", () => {
    const root = join(__dirname, "..", "..", "..", "..")
    const backend = codeOf(
      join(root, "backend", "src", "lib", "admin-bridge-token.ts")
    )
    const storefront = codeOf(
      join(root, "storefront", "src", "lib", "util", "admin-bridge-token.ts")
    )

    expect(storefront.length).toBeGreaterThan(200)
    expect(storefront).toBe(backend)
  })
})
