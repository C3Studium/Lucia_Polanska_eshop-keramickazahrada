import {
  isVerifiedPurchase,
  orderContainsProduct,
  orderCountsAsPurchase,
} from "../verified-purchase"

const order = (
  overrides: Partial<{
    status: string
    is_draft_order: boolean
    email: string
    items: Array<{ product_id: string | null } | null>
  }> = {}
) => ({
  status: "completed",
  is_draft_order: false,
  email: "jana@example.cz",
  items: [{ product_id: "prod_vaza" }],
  ...overrides,
})

describe("orderCountsAsPurchase", () => {
  it("zrušená objednávka ani koncept nákup nejsou", () => {
    expect(orderCountsAsPurchase(order({ status: "canceled" }))).toBe(false)
    expect(orderCountsAsPurchase(order({ status: "draft" }))).toBe(false)
    expect(orderCountsAsPurchase(order({ is_draft_order: true, status: "pending" }))).toBe(false)
    expect(orderCountsAsPurchase(null)).toBe(false)
  })

  it("čekající, dokončená i archivovaná objednávka nákup je", () => {
    for (const status of ["pending", "completed", "archived", "requires_action"]) {
      expect(orderCountsAsPurchase(order({ status }))).toBe(true)
    }
  })
})

describe("orderContainsProduct", () => {
  it("hledá řádek s výrobkem, prázdné řádky přeskočí", () => {
    expect(
      orderContainsProduct(order({ items: [null, { product_id: "prod_vaza" }] }), "prod_vaza")
    ).toBe(true)
    expect(orderContainsProduct(order(), "prod_miska")).toBe(false)
    expect(orderContainsProduct(order({ items: [] }), "prod_vaza")).toBe(false)
  })
})

describe("isVerifiedPurchase", () => {
  it("objednávka vlastního účtu s výrobkem → ověřeno", () => {
    expect(
      isVerifiedPurchase({
        product_id: "prod_vaza",
        account_orders: [order({ items: [{ product_id: "prod_miska" }] }), order()],
      })
    ).toBe(true)
  })

  it("jen zrušená objednávka → neověřeno", () => {
    expect(
      isVerifiedPurchase({
        product_id: "prod_vaza",
        account_orders: [order({ status: "canceled" })],
      })
    ).toBe(false)
  })

  it("bez objednávek → neověřeno (přihlášení samo nestačí)", () => {
    expect(isVerifiedPurchase({ product_id: "prod_vaza", account_orders: [] })).toBe(false)
  })

  it("hostovská objednávka na ověřený e-mail účtu → ověřeno", () => {
    expect(
      isVerifiedPurchase({
        product_id: "prod_vaza",
        account_orders: [],
        customer_email: " Jana@Example.cz ",
        email_verified: true,
        email_orders: [order({ email: "jana@example.cz" })],
      })
    ).toBe(true)
  })

  it("hostovská objednávka na neověřený e-mail → neověřeno", () => {
    expect(
      isVerifiedPurchase({
        product_id: "prod_vaza",
        account_orders: [],
        customer_email: "jana@example.cz",
        email_verified: false,
        email_orders: [order()],
      })
    ).toBe(false)
  })

  it("ilike výběr s jinou adresou (podtržítko jako zástupný znak) se nepočítá", () => {
    expect(
      isVerifiedPurchase({
        product_id: "prod_vaza",
        account_orders: [],
        customer_email: "jana_k@example.cz",
        email_verified: true,
        email_orders: [order({ email: "janaXk@example.cz" })],
      })
    ).toBe(false)
  })

  it("bez výrobku nic", () => {
    expect(isVerifiedPurchase({ product_id: "", account_orders: [order()] })).toBe(false)
  })
})
