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
import { shippingClassOf } from "../../../../../../../lib/shipping-rates"

/**
 * Velikost zásilky (16. 11. 2026) — zápis přes příznaky v Produkty+.
 * Pokladna čte `metadata.shipping_class`; neznámá hodnota by se tam
 * potichu brala jako malé, proto ji route odmítne.
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

describe("POST /admin/workbench/products/:id/flags — shipping_class", () => {
  it("uloží velikost zásilky a nechá ostatní metadata", async () => {
    const { req, res, updateProducts } = setup({ fragile: true, packaging_price: 30 })
    req.body = { shipping_class: "velke" }
    await POST(req, res)
    expect(updateProducts).toHaveBeenCalledWith("prod_1", {
      metadata: { fragile: true, packaging_price: 30, shipping_class: "velke" },
    })
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it("odmítne neznámou hodnotu a nic nezapíše", async () => {
    const { req, res, updateProducts } = setup({})
    req.body = { shipping_class: "obri" }
    await expect(POST(req, res)).rejects.toThrow(/Velikost zásilky/)
    expect(updateProducts).not.toHaveBeenCalled()
  })
})

describe("shippingClassOf — co ukáže řádek v Produkty+", () => {
  it("uložená hodnota má přednost", () => {
    expect(shippingClassOf({ shipping_class: "velke" })).toBe("velke")
    expect(shippingClassOf({ shipping_class: "male", gift_voucher: true })).toBe("male")
  })
  it("bez hodnoty: poukaz u dárkového poukazu, jinak malé", () => {
    expect(shippingClassOf({ gift_voucher: true })).toBe("poukaz")
    expect(shippingClassOf({})).toBe("male")
    expect(shippingClassOf(null)).toBe("male")
    expect(shippingClassOf({ shipping_class: "nesmysl" })).toBe("male")
  })
})
