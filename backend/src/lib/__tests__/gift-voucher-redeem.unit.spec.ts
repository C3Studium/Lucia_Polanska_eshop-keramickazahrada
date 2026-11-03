/**
 * Uplatnění dárkového poukazu objednávkou — kolik se komu strhne.
 *
 * Živě ověřeno 2. 11. 2026 na třech objednávkách (#64 celá cena, #65 část,
 * #67 zakázka se zálohou a doplatkem). Živý test ale poukaz spotřebuje, takže
 * se neopakuje; tyhle případy proto drží test. Hlídá se hlavně to, co se při
 * běžném klikání nestane: přečerpání, dvojí událost `order.placed` a to, že
 * sleva rozpuštěná do víc řádků se sečte do JEDNOHO odpisu.
 */

jest.mock("../gift-voucher-promotion", () => ({
  syncVoucherPromotionSafe: jest.fn(async () => undefined),
}))
jest.mock("../notify", () => ({
  notifyMerchant: jest.fn(async () => undefined),
}))
jest.mock("../../modules/gift-voucher", () => ({
  GIFT_VOUCHER_MODULE: "giftVoucher",
}))

import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { redeemVouchersFromOrder } from "../gift-voucher-orders"
import { notifyMerchant } from "../notify"
import { syncVoucherPromotionSafe } from "../gift-voucher-promotion"

const KOD = "UP39GY8C"

type Uprava = { code?: string | null; amount: number | string }

/** Objednávka tak, jak ji vrací `query.graph` — úpravy cen visí na řádcích. */
const objednavka = ({
  polozky = [] as Uprava[][],
  doprava = [] as Uprava[][],
  display_id = 64,
} = {}) => ({
  id: "order_test",
  display_id,
  items: polozky.map((adjustments, i) => ({ id: `item_${i}`, adjustments })),
  shipping_methods: doprava.map((adjustments, i) => ({ id: `sm_${i}`, adjustments })),
})

const prostredi = ({
  order,
  balance = 3000,
  redemptions = [] as { order_id: string; reversed_at: string | null }[],
}: {
  order: ReturnType<typeof objednavka>
  balance?: number
  redemptions?: { order_id: string; reversed_at: string | null }[]
}) => {
  const redeem = jest.fn(async () => undefined)
  const service = {
    listGiftVouchers: jest.fn(async () => [
      { id: "gv_1", code: KOD, balance, redemptions },
    ]),
    redeem,
  }
  const container = {
    resolve: (key: string) => {
      if (key === ContainerRegistrationKeys.QUERY) {
        return { graph: async () => ({ data: [order] }) }
      }
      if (key === "giftVoucher") return service
      if (key === ContainerRegistrationKeys.LOGGER) {
        return { info: jest.fn(), error: jest.fn(), warn: jest.fn() }
      }
      throw new Error(`neznámý klíč kontejneru: ${key}`)
    },
  } as never

  return { container, service, redeem }
}

beforeEach(() => jest.clearAllMocks())

describe("uplatnění poukazu objednávkou", () => {
  it("celá cena: strhne přesně to, co sleva ubrala (#64 → 40 Kč)", async () => {
    const { container, redeem } = prostredi({
      order: objednavka({ polozky: [[{ code: KOD, amount: 40 }]] }),
    })

    await redeemVouchersFromOrder(container, "order_test")

    expect(redeem).toHaveBeenCalledTimes(1)
    expect(redeem.mock.calls[0]).toEqual([
      "gv_1",
      expect.objectContaining({ amount: 40, order_id: "order_test" }),
    ])
    expect(notifyMerchant).not.toHaveBeenCalled()
    expect(syncVoucherPromotionSafe).toHaveBeenCalledWith(container, "gv_1")
  })

  it("část ceny: poštovné zůstává mimo (#65 → 1 000 Kč ze zboží)", async () => {
    const { container, redeem } = prostredi({
      balance: 1000,
      order: objednavka({
        display_id: 65,
        polozky: [[{ code: KOD, amount: 1000 }]],
        doprava: [[]],
      }),
    })

    await redeemVouchersFromOrder(container, "order_test")

    expect(redeem).toHaveBeenCalledWith("gv_1", expect.objectContaining({ amount: 1000 }))
  })

  it("zakázka s doplatkem: sleva rozpuštěná do zboží i balného je JEDEN odpis (#67 → 2 960 Kč)", async () => {
    // 4 300 Kč zakázka + 50 Kč balné, poukaz 2 960 rozdělený poměrně.
    const { container, redeem } = prostredi({
      balance: 2960,
      order: objednavka({
        display_id: 67,
        polozky: [
          [{ code: KOD, amount: 2925.98 }],
          [{ code: KOD, amount: 34.02 }],
        ],
      }),
    })

    await redeemVouchersFromOrder(container, "order_test")

    expect(redeem).toHaveBeenCalledTimes(1)
    expect(redeem).toHaveBeenCalledWith("gv_1", expect.objectContaining({ amount: 2960 }))
  })

  it("úprava ceny bez kódu (běžná sleva) se poukazu netýká", async () => {
    const { container, service, redeem } = prostredi({
      order: objednavka({ polozky: [[{ code: null, amount: 500 }]] }),
    })

    await redeemVouchersFromOrder(container, "order_test")

    expect(service.listGiftVouchers).not.toHaveBeenCalled()
    expect(redeem).not.toHaveBeenCalled()
  })

  it("přečerpaný poukaz: strhne jen zůstatek a majitelka se to dozví", async () => {
    const { container, redeem } = prostredi({
      balance: 600,
      order: objednavka({ polozky: [[{ code: KOD, amount: 1000 }]] }),
    })

    await redeemVouchersFromOrder(container, "order_test")

    expect(redeem).toHaveBeenCalledWith("gv_1", expect.objectContaining({ amount: 600 }))
    expect(notifyMerchant).toHaveBeenCalledWith(
      container,
      expect.objectContaining({ urgent: true, audience: "owner" })
    )
  })

  it("druhé doručení `order.placed` už nestrhne nic", async () => {
    const { container, redeem } = prostredi({
      order: objednavka({ polozky: [[{ code: KOD, amount: 40 }]] }),
      redemptions: [{ order_id: "order_test", reversed_at: null }],
    })

    await redeemVouchersFromOrder(container, "order_test")

    expect(redeem).not.toHaveBeenCalled()
  })

  it("vrácené uplatnění nebrání tomu, aby se poukaz uplatnil znovu", async () => {
    const { container, redeem } = prostredi({
      order: objednavka({ polozky: [[{ code: KOD, amount: 40 }]] }),
      redemptions: [{ order_id: "order_test", reversed_at: "2026-11-01T10:00:00Z" }],
    })

    await redeemVouchersFromOrder(container, "order_test")

    expect(redeem).toHaveBeenCalledWith("gv_1", expect.objectContaining({ amount: 40 }))
  })
})
