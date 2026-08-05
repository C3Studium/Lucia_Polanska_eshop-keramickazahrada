import { orderLink, productLink, storefrontBase } from "../customer-email"

/**
 * Every customer e-mail carries at least one link, and a wrong one is invisible
 * from this side: the build passes, the send succeeds, the address is
 * well-formed — and the customer lands on a 404.
 *
 * That is exactly what happened. These links pointed at `/objednavka/{id}` and
 * `/produkt/{product_id}`; the storefront routes are
 * `/[countryCode]/order/[id]/confirmed` and `/[countryCode]/products/[handle]`.
 * Three separate mistakes — invented path, missing country segment, id where a
 * handle belongs — and nothing in the repo disagreed with any of them.
 *
 * So these tests assert the *shape the storefront actually serves*. If someone
 * changes a route over there, this fails here, which is the only place the
 * mismatch can be noticed before a customer finds it.
 */
describe("customer e-mail links", () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    process.env.STOREFRONT_PUBLIC_URL = "https://keramickazahrada.cz"
    delete process.env.MEDUSA_STOREFRONT_URL
    delete process.env.STOREFRONT_COUNTRY
  })

  afterAll(() => {
    process.env = env
  })

  it("puts the country segment in, because every storefront route is under one", () => {
    expect(storefrontBase()).toBe("https://keramickazahrada.cz/cz")
  })

  it("honours an override, in case a second region is ever added", () => {
    process.env.STOREFRONT_COUNTRY = "SK"
    expect(storefrontBase()).toBe("https://keramickazahrada.cz/sk")
  })

  it("trims a trailing slash rather than emitting a double one", () => {
    process.env.STOREFRONT_PUBLIC_URL = "https://keramickazahrada.cz/"
    expect(storefrontBase()).toBe("https://keramickazahrada.cz/cz")
  })

  it("links an order to the page the storefront actually serves", () => {
    expect(orderLink({ id: "order_01" })).toBe(
      "https://keramickazahrada.cz/cz/order/order_01/confirmed"
    )
  })

  it("links a product by handle — the storefront does not route products by id", () => {
    expect(productLink("miska-modra")).toBe(
      "https://keramickazahrada.cz/cz/products/miska-modra"
    )
  })

  it("returns nothing rather than a broken link when the id or handle is missing", () => {
    // A half-built URL in an e-mail is worse than no button: the customer
    // clicks it. Callers render the button only when this is non-empty.
    expect(orderLink({})).toBe("")
    expect(orderLink(null)).toBe("")
    expect(productLink(null)).toBe("")
    expect(productLink(undefined)).toBe("")
  })

  it("returns nothing when no storefront is configured", () => {
    delete process.env.STOREFRONT_PUBLIC_URL
    expect(storefrontBase()).toBe("")
    expect(orderLink({ id: "order_01" })).toBe("")
    expect(productLink("miska-modra")).toBe("")
  })

  it("falls back to MEDUSA_STOREFRONT_URL", () => {
    delete process.env.STOREFRONT_PUBLIC_URL
    process.env.MEDUSA_STOREFRONT_URL = "https://keramickazahrada.cz"
    expect(orderLink({ id: "order_01" })).toBe(
      "https://keramickazahrada.cz/cz/order/order_01/confirmed"
    )
  })
})
