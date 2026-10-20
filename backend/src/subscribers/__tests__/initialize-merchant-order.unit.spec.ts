// Subscriber sahá přes lib/balance-payment a lib/idoklad-invoice na moduly,
// které při importu chtějí env (`lib/constants`). Hodnoty nic nespojují.
process.env.DATABASE_URL ||= "postgres://test:test@localhost:5432/test"
process.env.JWT_SECRET ||= "test"
process.env.COOKIE_SECRET ||= "test"

jest.mock("../../modules/made-to-order", () => ({ MADE_TO_ORDER_MODULE: "madeToOrder" }))
jest.mock("../../modules/merchant-order", () => ({ MERCHANT_ORDER_MODULE: "merchantOrder" }))
jest.mock("../../lib/idoklad-invoice", () => ({
  ensureMadeToOrderInvoices: jest.fn(async () => undefined),
}))
jest.mock("../../lib/balance-payment", () => ({
  ensureBalanceCollection: jest.fn(async () => ({ id: "paycol_balance" })),
}))

import { ensureBalanceCollection } from "../../lib/balance-payment"
import initializeMerchantOrder, {
  planCommissions,
  PRODUCTION_ORDERS_CREATED_EVENT,
} from "../initialize-merchant-order"

/**
 * LEGAL_AUDIT.md § 0, Z2/Z5: `initialize-merchant-order` ukládá SMLUVNÍ zálohu
 * (ze snímku pokladny), ne „zaplaceno / celkem" — a po založení zakázek
 * emituje `made-to-order.production-orders-created` (Z11, PDF Potvrzení zakázky).
 * § 0c (Z-A): JEDNA zakázka NA KAŽDÝ zakázkový řádek objednávky; součet záloh
 * = pokladní platba, součet cen = celá objednávka.
 */

const makeContainer = (order: Record<string, unknown>) => {
  const created: Record<string, unknown>[] = []
  const notes: Record<string, unknown>[] = []
  const paymentRequests: Record<string, unknown>[] = []
  const emitted: Array<{ name: string; data: Record<string, unknown> }> = []
  const madeToOrder = {
    listProductionOrders: jest.fn(async () => []),
    createProductionOrders: jest.fn(async (input: Record<string, unknown>) => {
      created.push(input)
      return { id: `po_${created.length}`, ...input }
    }),
    createProductionNotes: jest.fn(async (input: unknown) => {
      notes.push(...(Array.isArray(input) ? input : [input]))
      return []
    }),
    createProductionPaymentRequests: jest.fn(async (input: Record<string, unknown>) => {
      paymentRequests.push(input)
      return { id: `ppr_${paymentRequests.length}`, ...input }
    }),
    listProductProductionProfiles: jest.fn(async () => [{ default_deposit_percentage: 30 }]),
  }
  const merchantOrder = {
    listMerchantOrderStates: jest.fn(async () => [{ id: "mos_1" }]),
  }
  const eventBus = {
    emit: jest.fn(async (event: { name: string; data: Record<string, unknown> }) => {
      emitted.push(event)
    }),
  }
  const container = {
    resolve: (key: string) => {
      switch (key) {
        case "query":
          return { graph: async () => ({ data: [order] }) }
        case "madeToOrder":
          return madeToOrder
        case "merchantOrder":
          return merchantOrder
        case "event_bus":
          return eventBus
        case "logger":
          return { warn: jest.fn(), info: jest.fn(), error: jest.fn() }
        default:
          throw new Error(`Neznámá registrace: ${key}`)
      }
    },
  }
  return { container, created, notes, paymentRequests, emitted, madeToOrder }
}

const line = (overrides: Record<string, unknown>) => ({
  line_item_id: "cali_1",
  product_id: "prod_1",
  variant_id: "var_1",
  line_total: 5000,
  // Posuvník: zaplaceno vše (100 %) — smluvní snímek 25 %.
  deposit_percentage: 100,
  deposit_amount: 5000,
  contract_deposit_percentage: 25,
  contract_deposit_amount: 1250,
  contract_line_base: 5000,
  production_time_min_days: 14,
  production_time_max_days: 42,
  specification: "číslo 12, levandule",
  ...overrides,
})

const baseOrder = (collectionOverrides: Record<string, unknown>) => ({
  id: "order_1",
  total: 5000,
  currency_code: "czk",
  items: [
    {
      id: "ordli_1",
      title: "Domovní číslo",
      product_title: "Domovní číslo z kameniny",
      product_id: "prod_1",
      variant_id: "var_1",
      total: 5000,
      metadata: { made_to_order: { specification: "číslo 12, levandule", photos: [] } },
    },
  ],
  payment_collections: [
    {
      id: "paycol_1",
      status: "authorized",
      amount: 5000,
      payments: [{ id: "pay_1", data: { transId: "ABC" } }],
      payment_sessions: [{ id: "ps_1", data: {} }],
      metadata: {
        made_to_order: true,
        original_cart_total: 5000,
        checkout_payment_amount: 5000,
        production_lines: [line({})],
      },
      ...collectionOverrides,
    },
  ],
})

const run = async (order: Record<string, unknown>) => {
  const ctx = makeContainer(order)
  await initializeMerchantOrder({
    event: { name: "order.placed", data: { id: "order_1" } },
    container: ctx.container,
  } as never)
  return ctx
}

describe("initialize-merchant-order — smluvní záloha a event (Z2/Z5/Z11)", () => {
  beforeEach(() => {
    ;(ensureBalanceCollection as jest.Mock).mockClear()
  })

  it("zaplaceno 100 % → deposit_percentage 25 a deposit_amount 1 250 (ne 100 / 5 000)", async () => {
    const ctx = await run(baseOrder({}))

    expect(ctx.created).toHaveLength(1)
    expect(ctx.created[0]).toMatchObject({
      order_id: "order_1",
      // Řádek OBJEDNÁVKY (ne košíku), název a cena položky ze snímku.
      line_item_id: "ordli_1",
      line_title: "Domovní číslo z kameniny",
      line_total: 5000,
      deposit_percentage: 25,
      deposit_amount: 1250,
      original_total: 5000,
      agreed_total: 5000,
      stage: "specification_pending",
      customer_note: "číslo 12, levandule",
    })
    // Zaplacená částka zůstává v žádosti o platbu typu deposit.
    expect(ctx.paymentRequests[0]).toMatchObject({
      type: "deposit",
      status: "paid",
      amount: 5000,
      production_order_id: "po_1",
    })
    // Diář per zakázka.
    expect(ctx.notes[0]).toMatchObject({ production_order_id: "po_1", created_by: "customer" })
    // Fallback z profilu se nepoužil — snímek byl kompletní.
    expect(ctx.madeToOrder.listProductProductionProfiles).not.toHaveBeenCalled()
  })

  it("emituje made-to-order.production-orders-created s order_id + production_order_ids (jednou)", async () => {
    const ctx = await run(baseOrder({}))
    const events = ctx.emitted.filter((e) => e.name === PRODUCTION_ORDERS_CREATED_EVENT)
    expect(events).toHaveLength(1)
    expect(events[0].data).toEqual({ order_id: "order_1", production_order_ids: ["po_1"] })
    expect(ctx.emitted.some((e) => e.name === "made-to-order.production-order-created")).toBe(false)
  })

  it("stará kolekce bez contract_* → procento z profilu (30), nikdy 100", async () => {
    const order = baseOrder({
      metadata: {
        made_to_order: true,
        original_cart_total: 5000,
        checkout_payment_amount: 5000,
        production_lines: [
          {
            line_item_id: "cali_1",
            product_id: "prod_1",
            variant_id: "var_1",
            line_total: 5000,
            deposit_percentage: 100,
            deposit_amount: 5000,
            specification: null,
          },
        ],
      },
    })
    const ctx = await run(order)
    expect(ctx.madeToOrder.listProductProductionProfiles).toHaveBeenCalledWith({ product_id: "prod_1" })
    expect(ctx.created[0]).toMatchObject({ deposit_percentage: 30, deposit_amount: 1500 })
  })

  it("běžná objednávka (bez zakázkové kolekce) nic nezakládá ani neemituje", async () => {
    const ctx = await run({
      id: "order_1",
      total: 1128,
      currency_code: "czk",
      items: [],
      payment_collections: [{ id: "paycol_x", status: "authorized", amount: 1128, metadata: {} }],
    })
    expect(ctx.created).toHaveLength(0)
    expect(ctx.emitted).toHaveLength(0)
  })
})

describe("initialize-merchant-order — zakázka = položka (§ 0c, Z-A)", () => {
  it("dvě zakázky + doprava, jen zálohy: 2 zakázky, součet záloh = platba, první nese dopravu", async () => {
    const order = {
      id: "order_1",
      total: 7099, // 5000 + 2000 + 99 doprava
      currency_code: "czk",
      items: [
        {
          id: "ordli_a",
          product_title: "Domovní číslo",
          product_id: "prod_1",
          variant_id: "var_1",
          total: 5000,
          metadata: { made_to_order: { specification: "číslo 12", photos: ["https://img/1.jpg"] } },
        },
        {
          id: "ordli_b",
          product_title: "Pítko",
          product_id: "prod_2",
          variant_id: "var_2",
          total: 2000,
          metadata: { made_to_order: { specification: "modré", photos: [] } },
        },
      ],
      payment_collections: [
        {
          id: "paycol_1",
          status: "authorized",
          amount: 1750, // 1250 + 500, doprava mimo zálohu
          payments: [{ id: "pay_1", data: { transId: "ABC" } }],
          payment_sessions: [{ id: "ps_1", data: {} }],
          metadata: {
            made_to_order: true,
            original_cart_total: 7099,
            checkout_payment_amount: 1750,
            production_lines: [
              line({ line_item_id: "cali_a", deposit_percentage: 25, deposit_amount: 1250 }),
              line({
                line_item_id: "cali_b",
                product_id: "prod_2",
                variant_id: "var_2",
                line_total: 2000,
                deposit_percentage: 25,
                deposit_amount: 500,
                contract_deposit_amount: 500,
                contract_line_base: 2000,
                specification: "modré",
              }),
            ],
          },
        },
      ],
    }
    const ctx = await run(order)

    expect(ctx.created).toHaveLength(2)
    // První nese dopravu: cena položky 5 000, original_total 5 099.
    expect(ctx.created[0]).toMatchObject({
      line_item_id: "ordli_a",
      line_title: "Domovní číslo",
      line_total: 5000,
      original_total: 5099,
      deposit_amount: 1250,
      deposit_percentage: 25,
      order_extras_paid: 0,
      customer_note: "číslo 12",
    })
    expect(ctx.created[1]).toMatchObject({
      line_item_id: "ordli_b",
      line_title: "Pítko",
      line_total: 2000,
      original_total: 2000,
      deposit_amount: 500,
      order_extras_paid: null,
      customer_note: "modré",
    })
    // Součet záloh = pokladní platba, každá na své zakázce.
    expect(ctx.paymentRequests.map((r) => [r.production_order_id, r.amount])).toEqual([
      ["po_1", 1250],
      ["po_2", 500],
    ])
    expect(ctx.paymentRequests.map((r) => r.idempotency_key)).toEqual([
      "deposit:order_1:ordli_a",
      "deposit:order_1:ordli_b",
    ])
    // Diář: fotka k první, text k druhé — každá na své zakázce.
    expect(ctx.notes.map((n) => n.production_order_id)).toEqual(["po_1", "po_2"])
    // Jeden event se všemi zakázkami.
    const events = ctx.emitted.filter((e) => e.name === PRODUCTION_ORDERS_CREATED_EVENT)
    expect(events).toHaveLength(1)
    expect(events[0].data).toEqual({ order_id: "order_1", production_order_ids: ["po_1", "po_2"] })
    // Kolekce doplatku per zakázka: 5099 − 1250 a 2000 − 500.
    expect((ensureBalanceCollection as jest.Mock).mock.calls.map((call) => [call[2], call[3]])).toEqual([
      [3849, "po_1"],
      [1500, "po_2"],
    ])
  })

  it("smíšený košík (zakázka + běžné zboží zaplacené hned): běžné zboží nese první zakázka jako zaplacené navíc", () => {
    const planned = planCommissions({
      productionLines: [line({ deposit_percentage: 25, deposit_amount: 1250 })],
      orderItems: [
        { id: "ordli_a", product_title: "Domovní číslo", product_id: "prod_1", variant_id: "var_1", total: 5000, metadata: {} },
        { id: "ordli_r", product_title: "Hrnek", product_id: "prod_9", variant_id: "var_9", total: 400, metadata: {} },
      ],
      originalTotal: 5499, // 5000 + 400 + 99
      paidNow: 1650, // 1250 záloha + 400 hrnek, doprava mimo zálohu
    })
    expect(planned).toHaveLength(1)
    expect(planned[0]).toMatchObject({
      line_item_id: "ordli_a",
      line_total: 5000,
      original_total: 5499,
      deposit_paid: 1650,
      order_extras_paid: 400,
      carries_order_extras: true,
    })
  })

  it("plná platba včetně dopravy: součet záloh = platba, nic nezbývá", () => {
    const planned = planCommissions({
      productionLines: [
        line({ deposit_percentage: 100, deposit_amount: 5000 }),
        line({ line_item_id: "cali_b", variant_id: "var_2", product_id: "prod_2", line_total: 2000, deposit_amount: 2000, contract_deposit_amount: 500, contract_line_base: 2000 }),
      ],
      orderItems: [
        { id: "ordli_a", product_id: "prod_1", variant_id: "var_1", total: 5000, metadata: {} },
        { id: "ordli_b", product_id: "prod_2", variant_id: "var_2", total: 2000, metadata: {} },
      ],
      originalTotal: 7099,
      paidNow: 7099,
    })
    expect(planned.map((plan) => plan.deposit_paid)).toEqual([5099, 2000])
    expect(planned.map((plan) => plan.original_total)).toEqual([5099, 2000])
    expect(planned[0].order_extras_paid).toBe(99)
  })
})
