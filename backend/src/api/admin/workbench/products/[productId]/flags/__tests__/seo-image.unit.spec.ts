jest.mock("../../../../../../../subscribers/revalidate-storefront", () => ({
  __esModule: true,
  default: jest.fn(async () => undefined),
}))
jest.mock("../../../../../../../lib/discountable", () => ({
  applyDiscountableRule: jest.fn(async () => undefined),
}))
jest.mock("../../../../../../../modules/made-to-order", () => ({
  MADE_TO_ORDER_MODULE: "madeToOrder",
}))

import { POST } from "../route"

/**
 * Fotka pro vyhledávače (21. 11. 2026) — zápis přes příznaky v Produkty+.
 * Storefront čte `metadata.seo_image`; ostatní metadata musí zůstat.
 * `null` vrací na náhled kusu.
 */
const setup = (metadata: Record<string, unknown>) => {
  const updateProducts = jest.fn(async () => undefined)
  const productModule = {
    listProducts: jest.fn(async () => [{ id: "prod_1", metadata, discountable: true }]),
    updateProducts,
  }
  const req: any = {
    params: { productId: "prod_1" },
    body: undefined,
    scope: {
      resolve: (key: string) =>
        key === "logger" ? { warn: jest.fn() } : productModule,
    },
  }
  const res: any = { status: jest.fn(() => res), json: jest.fn() }
  return { req, res, updateProducts }
}

describe("POST /admin/workbench/products/:id/flags — seo_image", () => {
  it("uloží fotku a nechá ostatní metadata", async () => {
    const { req, res, updateProducts } = setup({ fragile: true, shipping_class: "velke" })
    req.body = { seo_image: "https://img.example/b.jpg" }
    await POST(req, res)
    expect(updateProducts).toHaveBeenCalledWith("prod_1", {
      metadata: { fragile: true, shipping_class: "velke", seo_image: "https://img.example/b.jpg" },
    })
  })

  it("null vrátí volbu na náhled", async () => {
    const { req, res, updateProducts } = setup({ seo_image: "https://img.example/b.jpg" })
    req.body = { seo_image: null }
    await POST(req, res)
    expect(updateProducts).toHaveBeenCalledWith("prod_1", { metadata: { seo_image: null } })
  })

  it("odmítne prázdnou adresu", async () => {
    const { req, res, updateProducts } = setup({})
    req.body = { seo_image: "   " }
    await expect(POST(req, res)).rejects.toThrow()
    expect(updateProducts).not.toHaveBeenCalled()
  })
})
