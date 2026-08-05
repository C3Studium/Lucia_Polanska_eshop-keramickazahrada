import {
  accountOrdersLink,
  cartRecoverLink,
  orderLink,
  productLink,
  storefrontBase,
  storeLink,
} from "../storefront-url"

/**
 * Every customer e-mail carries at least one link, and a wrong one is invisible
 * from this side: the build passes, the send succeeds, the address is
 * well-formed — and the customer lands on a 404.
 *
 * That is exactly what happened. These links pointed at `/objednavka/{id}` and
 * `/produkt/{product_id}`; the storefront routes are
 * `/[countryCode]/order/[id]/confirmed` and `/[countryCode]/products/[handle]`.
 * Two real mistakes — an invented path, and an id where a handle belongs — and
 * nothing in the repo disagreed with either.
 *
 * A third was suspected and was not real: a missing country segment. The
 * storefront's middleware 307-redirects any path without one, so that alone
 * never broke a link. We still emit the segment (see `storefront-url.ts`), and
 * these tests assert it — but as the canonical form, not as a fix for a bug.
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

  it("emits the country segment, so the address in the e-mail is where they land", () => {
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

  it("links an abandoned cart to the recovery page", () => {
    // Was built inline inside abandoned-cart.tsx off a different env chain.
    expect(cartRecoverLink("cart_01")).toBe(
      "https://keramickazahrada.cz/cz/cart/recover/cart_01"
    )
  })

  it("links to the shop listing and to account orders", () => {
    expect(storeLink()).toBe("https://keramickazahrada.cz/cz/store")
    expect(accountOrdersLink()).toBe(
      "https://keramickazahrada.cz/cz/account/orders"
    )
  })

  it("returns nothing rather than a broken link when the id or handle is missing", () => {
    // A half-built URL in an e-mail is worse than no button: the customer
    // clicks it. Callers render the button only when this is non-empty.
    expect(orderLink({})).toBe("")
    expect(orderLink(null)).toBe("")
    expect(productLink(null)).toBe("")
    expect(productLink(undefined)).toBe("")
    expect(cartRecoverLink(null)).toBe("")
  })

  it("returns nothing when no storefront is configured", () => {
    delete process.env.STOREFRONT_PUBLIC_URL
    expect(storefrontBase()).toBe("")
    expect(orderLink({ id: "order_01" })).toBe("")
    expect(productLink("miska-modra")).toBe("")
    expect(cartRecoverLink("cart_01")).toBe("")
    expect(storeLink()).toBe("")
  })

  it("falls back to MEDUSA_STOREFRONT_URL", () => {
    delete process.env.STOREFRONT_PUBLIC_URL
    process.env.MEDUSA_STOREFRONT_URL = "https://keramickazahrada.cz"
    expect(orderLink({ id: "order_01" })).toBe(
      "https://keramickazahrada.cz/cz/order/order_01/confirmed"
    )
  })
})
