import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { GET } from "../../api/store/carts/[id]/production-payment-mode/route"
import { MADE_TO_ORDER_MODULE } from "../../modules/made-to-order"

/**
 * Co pokladna slíbí, musí sedět s tím, co brána strhne (13. 11. 2026).
 *
 * Živý test, objednávka 0074: zakázka 4 300, balné 50, Česká pošta - Křehké
 * 150. Pokladna ukázala „Zaplatíte teď 1 275 / po dokončení 3 225", brána
 * strhla 1 125 a doplatek byl 3 375. Routa si nenačítala `items.metadata`,
 * takže řádek balného (značka je v metadatech) vzala jako běžné zboží
 * a poštovné poslala do platby hned. Workflow platby metadata čte.
 *
 * Mock `query.graph` vrací metadata JEN když si je routa vyžádá — přesně
 * jako skutečný query, takže test spadne, kdyby pole zase vypadlo.
 */
const cart = {
  id: "cart_1",
  total: 4500,
  shipping_total: 150,
  currency_code: "czk",
  metadata: null,
  items: [
    { id: "i1", product_id: "prod_z", variant_id: "var_z", quantity: 1, unit_price: 4300, total: 4300, subtotal: 4300, metadata: {} },
    { id: "i2", product_id: null, variant_id: null, quantity: 1, unit_price: 50, total: 50, subtotal: 50, metadata: { packaging_fee: true } },
  ],
}

const run = async () => {
  const query = {
    graph: async ({ fields }: { fields: string[] }) => ({
      data: [
        {
          ...cart,
          items: cart.items.map(({ metadata, ...item }) =>
            fields.includes("items.metadata") ? { ...item, metadata } : item
          ),
        },
      ],
    }),
  }
  const service = {
    listProductProductionProfiles: async () => [
      { product_id: "prod_z", enabled: true, default_deposit_percentage: 25, allow_full_prepayment: true },
    ],
    listVariantProductionProfiles: async () => [],
  }
  const req = {
    params: { id: "cart_1" },
    scope: {
      resolve: (key: string) =>
        key === ContainerRegistrationKeys.QUERY ? query : key === MADE_TO_ORDER_MODULE ? service : null,
    },
  }
  let body: any
  const res = { status: () => res, json: (value: unknown) => ((body = value), res) }
  await GET(req as any, res as any)
  return body
}

describe("GET /store/carts/:id/production-payment-mode", () => {
  it("nechá poštovné čisté zakázky do doplatku, i když je v košíku balné", async () => {
    const body = await run()
    // záloha 25 % z 4 300 = 1 075 + balné 50; doprava 150 až v doplatku
    expect(body.deposit_amount).toBe(1125)
    expect(body.balance_later).toBe(3375)
    expect(body.production_only.always_now).toBe(50)
    expect(body.production_only.postage_now).toBe(0)
    expect(body.production_only.has_plain_goods).toBe(false)
  })
})
