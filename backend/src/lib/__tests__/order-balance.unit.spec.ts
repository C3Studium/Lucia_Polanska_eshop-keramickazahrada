import {
  checkoutBalanceFromCollections,
  resolveOrderOutstanding,
} from "../balance-payment"

/**
 * Potvrzení objednávky a `initialize-merchant-order` běží na `order.placed`
 * souběžně. Změřeno v sandboxu: zakázka 2 479 Kč, v pokladně zaplacená
 * záloha 679 Kč — e-mail ukázal „Celkem 2 479 Kč" bez „Zbývá doplatit"
 * a bez tlačítka Doplatit, protože produkční objednávka ještě neexistovala.
 */

const checkoutCollection = {
  id: "paycol_checkout",
  status: "authorized",
  amount: 679,
  metadata: {
    made_to_order: true,
    original_cart_total: 2479,
    checkout_payment_amount: 679,
    production_lines: [{ line_item_id: "cali_1", deposit_amount: 600 }],
  },
}

describe("doplatek v potvrzení objednávky", () => {
  it("reads the balance from the checkout collection before the production order exists", () => {
    expect(checkoutBalanceFromCollections([checkoutCollection])).toBe(1800)
    expect(
      resolveOrderOutstanding({
        productionOrder: null,
        requests: [],
        collections: [checkoutCollection],
      })
    ).toBe(1800)
  })

  it("an ordinary order owes nothing — no made-to-order collection, no button", () => {
    const ordinary = {
      id: "paycol_1",
      amount: 1128,
      metadata: { made_to_order: false, original_cart_total: 1128, production_lines: [] },
    }
    expect(checkoutBalanceFromCollections([ordinary])).toBeNull()
    expect(
      resolveOrderOutstanding({ productionOrder: null, requests: [], collections: [ordinary] })
    ).toBe(0)
    expect(
      resolveOrderOutstanding({ productionOrder: null, requests: [], collections: undefined })
    ).toBe(0)
  })

  it("paid in full at checkout → nothing owed", () => {
    const full = {
      ...checkoutCollection,
      amount: 2479,
      metadata: { ...checkoutCollection.metadata, checkout_payment_amount: 2479 },
    }
    expect(
      resolveOrderOutstanding({ productionOrder: null, requests: [], collections: [full] })
    ).toBe(0)
  })

  it("reads BigNumber-shaped amounts", () => {
    const big = { ...checkoutCollection, amount: { value: "679", numeric_: 679 } }
    expect(checkoutBalanceFromCollections([big])).toBe(1800)
  })

  it("production order without its deposit yet (subscriber mid-way) does not ask for the whole price", () => {
    const productionOrder = {
      id: "prod_1",
      stage: "confirmed",
      agreed_total: 2479,
      original_total: 2479,
      surcharge: 0,
    }
    expect(
      resolveOrderOutstanding({
        productionOrder,
        requests: [],
        collections: [checkoutCollection],
      })
    ).toBe(1800)
  })

  it("once the deposit request exists, the module's own numbers win (incl. surcharge)", () => {
    const productionOrder = {
      id: "prod_1",
      stage: "confirmed",
      agreed_total: 2479,
      original_total: 2479,
      surcharge: 200,
    }
    const requests = [{ type: "deposit", status: "paid", amount: 679 }]
    expect(
      resolveOrderOutstanding({
        productionOrder,
        requests,
        collections: [checkoutCollection],
      })
    ).toBe(2000)
  })
})
