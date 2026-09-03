import {
  ADMIN_BRIDGE_TTL_SECONDS,
  signAdminBridgeToken,
  verifyAdminBridgeToken,
} from "../admin-bridge-token"

const SECRET = "a-secret-that-is-long-enough-to-be-real"
const NOW = new Date("2026-08-31T10:00:00.000Z")
const future = Math.floor(NOW.getTime() / 1000) + ADMIN_BRIDGE_TTL_SECONDS

describe("admin bridge token", () => {
  it("round-trips the claims it was given", () => {
    const token = signAdminBridgeToken(
      { email: "lucia@keramickazahrada.cz", exp: future },
      SECRET
    )

    expect(verifyAdminBridgeToken(token, SECRET, NOW)).toEqual({
      email: "lucia@keramickazahrada.cz",
      exp: future,
    })
  })

  it("produces a URL-safe token — it travels in a query string", () => {
    const token = signAdminBridgeToken({ email: "a@b.cz", exp: future }, SECRET)

    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    expect(encodeURIComponent(token)).toBe(token)
  })

  it("refuses a token signed with a different secret", () => {
    const token = signAdminBridgeToken({ email: "a@b.cz", exp: future }, SECRET)

    expect(verifyAdminBridgeToken(token, "some-other-secret", NOW)).toBeNull()
  })

  it("refuses a tampered payload — the point of signing it", () => {
    const token = signAdminBridgeToken({ email: "a@b.cz", exp: future }, SECRET)
    const [, sig] = token.split(".")
    const forged =
      Buffer.from(JSON.stringify({ email: "attacker@evil.cz", exp: future }))
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "") + `.${sig}`

    expect(verifyAdminBridgeToken(forged, SECRET, NOW)).toBeNull()
  })

  it("refuses an expired token", () => {
    const token = signAdminBridgeToken(
      { email: "a@b.cz", exp: Math.floor(NOW.getTime() / 1000) - 1 },
      SECRET
    )

    expect(verifyAdminBridgeToken(token, SECRET, NOW)).toBeNull()
  })

  it("treats the expiry second itself as already over", () => {
    const exp = Math.floor(NOW.getTime() / 1000)
    const token = signAdminBridgeToken({ email: "a@b.cz", exp }, SECRET)

    expect(verifyAdminBridgeToken(token, SECRET, NOW)).toBeNull()
    expect(
      verifyAdminBridgeToken(token, SECRET, new Date(NOW.getTime() - 1000))
    ).not.toBeNull()
  })

  it("still holds a week out, and not a second past it", () => {
    const token = signAdminBridgeToken({ email: "a@b.cz", exp: future }, SECRET)
    const justBefore = new Date(future * 1000 - 1000)
    const justAfter = new Date(future * 1000 + 1000)

    expect(verifyAdminBridgeToken(token, SECRET, justBefore)).not.toBeNull()
    expect(verifyAdminBridgeToken(token, SECRET, justAfter)).toBeNull()
  })

  it("refuses junk instead of throwing", () => {
    for (const junk of [
      undefined,
      null,
      "",
      "not-a-token",
      "a.b.c",
      ".",
      "..",
      "eyJhIjoxfQ",
      "eyJhIjoxfQ.",
    ]) {
      expect(verifyAdminBridgeToken(junk as never, SECRET, NOW)).toBeNull()
    }
  })

  it("refuses everything when no secret is configured", () => {
    // A missing env var must not turn into „everyone is an admin".
    const token = signAdminBridgeToken({ email: "a@b.cz", exp: future }, SECRET)

    expect(verifyAdminBridgeToken(token, "", NOW)).toBeNull()
  })

  it("refuses a payload missing the fields the bar relies on", () => {
    const encode = (value: unknown) =>
      Buffer.from(JSON.stringify(value))
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")
    // Signed correctly, but the claims are wrong shape — still refused.
    const { createHmac } = require("node:crypto")
    const sign = (payload: string) =>
      createHmac("sha256", SECRET)
        .update(payload)
        .digest("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")

    for (const claims of [{}, { email: "a@b.cz" }, { exp: future }, { email: 1, exp: future }]) {
      const payload = encode(claims)
      expect(
        verifyAdminBridgeToken(`${payload}.${sign(payload)}`, SECRET, NOW)
      ).toBeNull()
    }
  })
})
