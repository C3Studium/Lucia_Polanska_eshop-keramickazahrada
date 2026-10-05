import {
  orderEditUrl,
  orderRefundUrl,
  signOrderAccessToken,
  verifyOrderAccessToken,
} from "../order-access-link"

/**
 * Token, který pouští hosta na self-service stránky objednávky (editace,
 * reklamace) bez přihlášení. Když se splete, pustí cizího člověka k cizí
 * objednávce — proto se tu hlídá to, na čem to stojí: podpis sedí jen své
 * objednávce, nejde přenést jinam a neplatný/zmršený token nepustí.
 */
describe("order access token", () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    process.env.JWT_SECRET = "test-secret-order-access"
    delete process.env.COOKIE_SECRET
    process.env.STOREFRONT_PUBLIC_URL = "https://keramickazahrada.cz"
    delete process.env.MEDUSA_STOREFRONT_URL
    delete process.env.STOREFRONT_COUNTRY
  })

  afterAll(() => {
    process.env = env
  })

  it("vlastní token objednávky projde", () => {
    const token = signOrderAccessToken("order_1")
    expect(verifyOrderAccessToken("order_1", token)).toBe(true)
  })

  it("token je nepřenosný — podpis objednávky A neplatí pro B", () => {
    const tokenA = signOrderAccessToken("order_A")
    expect(verifyOrderAccessToken("order_B", tokenA)).toBe(false)
  })

  it("zmršený / cizí / prázdný token nepustí", () => {
    expect(verifyOrderAccessToken("order_1", "deadbeef")).toBe(false)
    expect(verifyOrderAccessToken("order_1", "")).toBe(false)
    expect(verifyOrderAccessToken("order_1", undefined)).toBe(false)
    expect(verifyOrderAccessToken("order_1", null)).toBe(false)
    expect(verifyOrderAccessToken("order_1", 12345 as unknown)).toBe(false)
  })

  it("token je deterministický (stejná objednávka → stejný token)", () => {
    expect(signOrderAccessToken("order_1")).toBe(signOrderAccessToken("order_1"))
    expect(signOrderAccessToken("order_1")).not.toBe(
      signOrderAccessToken("order_2")
    )
  })

  it("token se mění se změnou tajemství (nejde ověřit pod jiným klíčem)", () => {
    const token = signOrderAccessToken("order_1")
    process.env.JWT_SECRET = "jiné-tajemství"
    expect(verifyOrderAccessToken("order_1", token)).toBe(false)
  })

  it("URL editace i reklamace míří na storefront stránku s tokenem", () => {
    const edit = orderEditUrl("order_1")
    const refund = orderRefundUrl("order_1")
    expect(edit).toBe(
      `https://keramickazahrada.cz/cz/order/order_1/edit?token=${signOrderAccessToken(
        "order_1"
      )}`
    )
    expect(refund).toBe(
      `https://keramickazahrada.cz/cz/order/order_1/refund?token=${signOrderAccessToken(
        "order_1"
      )}`
    )
  })

  it("bez nastaveného storefrontu vrátí prázdno (nerozesílá půlpečené odkazy)", () => {
    delete process.env.STOREFRONT_PUBLIC_URL
    expect(orderEditUrl("order_1")).toBe("")
    expect(orderRefundUrl("order_1")).toBe("")
  })
})
