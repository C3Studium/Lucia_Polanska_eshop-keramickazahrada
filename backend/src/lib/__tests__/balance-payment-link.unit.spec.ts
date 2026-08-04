import {
  signBalanceToken,
  verifyBalanceToken,
} from "../balance-payment-link"

describe("balance payment link tokens", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret-for-signing"
  })

  it("accepts the token it produced", () => {
    const token = signBalanceToken("order_1")
    expect(verifyBalanceToken("order_1", token)).toBe(true)
  })

  it("is stable, so a link mailed weeks ago still works", () => {
    expect(signBalanceToken("order_1")).toBe(signBalanceToken("order_1"))
  })

  it("cannot be moved to another order", () => {
    // The whole point: holding one customer's link must not let you open
    // somebody else's payment.
    const token = signBalanceToken("order_1")
    expect(verifyBalanceToken("order_2", token)).toBe(false)
  })

  it("rejects a missing, empty or wrong token", () => {
    expect(verifyBalanceToken("order_1", undefined)).toBe(false)
    expect(verifyBalanceToken("order_1", "")).toBe(false)
    expect(verifyBalanceToken("order_1", "nope")).toBe(false)
    expect(verifyBalanceToken("order_1", 12345)).toBe(false)
  })

  it("rejects a token of the right length but wrong content", () => {
    // Guards the constant-time compare: equal lengths must still not pass.
    const token = signBalanceToken("order_1")
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`

    expect(tampered).toHaveLength(token.length)
    expect(verifyBalanceToken("order_1", tampered)).toBe(false)
  })
})
