import {
  defaultValidUntil,
  formatVoucherCode,
  generateVoucherCode,
  looksLikeVoucherCode,
  monthsFromValidityText,
  normalizeVoucherCode,
  pragueDateOf,
  pragueEndOfDay,
  voucherState,
} from "../code"

describe("kód poukazu", () => {
  it("má 8 znaků bez zaměnitelných (0/O, 1/I/L, 5/S)", () => {
    const seen = new Set<string>()
    for (let i = 0; i < 2000; i++) {
      const code = generateVoucherCode()
      expect(code).toMatch(/^[A-Z0-9]{8}$/)
      expect(code).not.toMatch(/[01OILS5]/)
      seen.add(code)
    }
    expect(seen.size).toBe(2000)
  })

  it("normalizace sjednotí, jak ho kdo napíše", () => {
    expect(normalizeVoucherCode(" 7hq4 m2xp ")).toBe("7HQ4M2XP")
    expect(normalizeVoucherCode("7HQ4-M2XP")).toBe("7HQ4M2XP")
    expect(looksLikeVoucherCode("7hq4-m2xp")).toBe(true)
    expect(looksLikeVoucherCode("LETO20")).toBe(false)
    expect(looksLikeVoucherCode("ABCDEFG0")).toBe(false)
    expect(formatVoucherCode("7HQ4M2XP")).toBe("7HQ4 M2XP")
  })
})

describe("platnost", () => {
  it("výchozí platnost z textu Právních údajů", () => {
    expect(monthsFromValidityText("1 rok")).toBe(12)
    expect(monthsFromValidityText("12 měsíců")).toBe(12)
    expect(monthsFromValidityText("2 roky")).toBe(24)
    expect(monthsFromValidityText(null)).toBe(12)
  })

  it("konec platnosti je o rok později, na konci dne v Praze (léto i zima)", () => {
    // 24. 10. 2027 je ještě letní čas (UTC+2), 24. 1. zimní (UTC+1).
    expect(defaultValidUntil(new Date("2026-10-24T10:00:00Z"), 12).toISOString()).toBe("2027-10-24T21:59:59.000Z")
    expect(pragueEndOfDay("2027-01-24").toISOString()).toBe("2027-01-24T22:59:59.000Z")
    expect(pragueDateOf(pragueEndOfDay("2027-07-15"))).toBe("2027-07-15")
  })
})

describe("stav poukazu", () => {
  const base = { status: "active", payment_status: "paid", balance: 500, valid_until: "2027-10-24T22:59:59Z" }
  const now = new Date("2026-11-01T12:00:00Z")
  it("platný, nezaplacený, vyčerpaný, propadlý, zrušený", () => {
    expect(voucherState(base, now)).toBe("active")
    expect(voucherState({ ...base, payment_status: "pending" }, now)).toBe("pending_payment")
    expect(voucherState({ ...base, balance: 0 }, now)).toBe("used")
    expect(voucherState(base, new Date("2027-10-25T00:00:00Z"))).toBe("expired")
    expect(voucherState({ ...base, status: "cancelled" }, now)).toBe("cancelled")
    // Vrácené peníze přebijí všechno — i plný zůstatek a platnost.
    expect(voucherState({ ...base, status: "cancelled", refunded_at: "2026-11-01T10:00:00Z" }, now)).toBe("refunded")
  })
})
