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

import initializeMerchantOrder from "../initialize-merchant-order"

/**
 * LEGAL_AUDIT.md § 0, Z2/Z5: `initialize-merchant-order` ukládá SMLUVNÍ zálohu
 * (ze snímku pokladny), ne „zaplaceno / celkem" — a po založení zakázky
 * emituje `made-to-order.production-order-created` (Z11, PDF Potvrzení zakázky).
 */

const makeContainer = (order: Record<string, unknown>) => {
  const created: Record<string, unknown>[] = []
  const paymentRequests: Record<string, unknown>[] = []
  const emitted: Array<{ name: string; data: Record<string, unknown> }> = []
  const madeToOrder = {
    listProductionOrders: jest.fn(async () => []),
    createProductionOrders: jest.fn(async (input: Record<string, unknown>) => {
      created.push(input)
      return { id: "po_1", ...input }
    }),
    createProductionNotes: jest.fn(async () => []),
    createProductionPaymentRequests: jest.fn(async (input: Record<string, unknown>) => {
      paymentRequests.push(input)
      return { id: "ppr_1", ...input }
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
  return { container, created, paymentRequests, emitted, madeToOrder }
}

const baseOrder = (collectionOverrides: Record<string, unknown>) => ({
  id: "order_1",
  total: 5000,
  currency_code: "czk",
  items: [
    {
      id: "li_1",
      product_id: "prod_1",
      variant_id: "var_1",
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
        production_lines: [
          {
            line_item_id: "li_1",
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
          },
        ],
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
  it("zaplaceno 100 % → deposit_percentage 25 a deposit_amount 1 250 (ne 100 / 5 000)", async () => {
    const ctx = await run(baseOrder({}))

    expect(ctx.created).toHaveLength(1)
    expect(ctx.created[0]).toMatchObject({
      order_id: "order_1",
      deposit_percentage: 25,
      deposit_amount: 1250,
      original_total: 5000,
      agreed_total: 5000,
      stage: "specification_pending",
    })
    // Zaplacená částka zůstává v žádosti o platbu typu deposit.
    expect(ctx.paymentRequests[0]).toMatchObject({
      type: "deposit",
      status: "paid",
      amount: 5000,
      production_order_id: "po_1",
    })
    // Fallback z profilu se nepoužil — snímek byl kompletní.
    expect(ctx.madeToOrder.listProductProductionProfiles).not.toHaveBeenCalled()
  })

  it("emituje made-to-order.production-order-created s order_id + production_order_id", async () => {
    const ctx = await run(baseOrder({}))
    const event = ctx.emitted.find((e) => e.name === "made-to-order.production-order-created")
    expect(event).toBeDefined()
    expect(event?.data).toEqual({ order_id: "order_1", production_order_id: "po_1" })
    expect(ctx.emitted.filter((e) => e.name === "made-to-order.production-order-created")).toHaveLength(1)
  })

  it("stará kolekce bez contract_* → procento z profilu (30), nikdy 100", async () => {
    const order = baseOrder({
      metadata: {
        made_to_order: true,
        original_cart_total: 5000,
        checkout_payment_amount: 5000,
        production_lines: [
          {
            line_item_id: "li_1",
            product_id: "prod_1",
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
