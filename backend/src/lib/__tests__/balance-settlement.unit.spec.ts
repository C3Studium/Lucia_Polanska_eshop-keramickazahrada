import {
  captureCoveredByBalanceMail,
  nativeShortfall,
  pickOpenBalanceCollection,
  resolveSettlementAmount,
  settleBalanceOffline,
} from "../balance-settlement"
import { MADE_TO_ORDER_MODULE } from "../../modules/made-to-order"

/**
 * „Zaplaceno na místě" — tvar objednávky #31 (9. 10. 2026): záloha 1 075 Kč
 * zachycená přes ComGate, doplatek 3 225 Kč = druhá kolekce `not_paid` bez
 * platby, otevřená žádost o doplatek `sent`.
 */

const depositCollection = {
  id: "paycol_deposit",
  status: "completed",
  amount: 1075,
  captured_amount: 1075,
  refunded_amount: 0,
  metadata: { made_to_order: true },
  payments: [{ id: "pay_deposit", captured_at: "2026-10-01T10:00:00Z", canceled_at: null }],
}

const balanceCollection = {
  id: "paycol_balance",
  status: "not_paid",
  amount: { value: "3225" },
  captured_amount: { value: "0" },
  refunded_amount: 0,
  metadata: null,
  payments: [],
}

const order31 = (overrides: Record<string, unknown> = {}) => ({
  id: "order_31",
  display_id: 31,
  status: "pending",
  currency_code: "czk",
  total: 4300,
  payment_collections: [depositCollection, balanceCollection],
  ...overrides,
})

const productionOrder = {
  id: "po_31",
  order_id: "order_31",
  stage: "awaiting_balance",
  original_total: 4300,
  agreed_total: 4300,
  surcharge: null,
  currency_code: "czk",
  ready_to_ship_at: null,
}

const depositRequest = {
  id: "ppr_deposit",
  type: "deposit",
  status: "paid",
  amount: 1075,
  currency_code: "czk",
  payment_collection_id: "paycol_deposit",
  paid_at: "2026-10-01T10:00:00Z",
}

const openBalanceRequest = {
  id: "ppr_balance",
  type: "balance",
  status: "sent",
  amount: 3225,
  currency_code: "czk",
  payment_collection_id: "paycol_balance",
  payment_session_id: "payses_comgate",
  paid_at: null,
}

describe("resolveSettlementAmount — jen celý doplatek", () => {
  it("bez zadání = celý dluh", () => {
    expect(resolveSettlementAmount(3225)).toBe(3225)
    expect(resolveSettlementAmount(3225.004)).toBe(3225)
  })

  it("zadaná částka musí sedět na dluh do haléře", () => {
    expect(resolveSettlementAmount(3225, 3225)).toBe(3225)
    expect(resolveSettlementAmount(3225, 3225.01)).toBe(3225)
    expect(resolveSettlementAmount(3225, 3224.99)).toBe(3225)
    expect(() => resolveSettlementAmount(3225, 3225.02)).toThrow(/celý doplatek/)
    expect(() => resolveSettlementAmount(3225, 3000)).toThrow(/celý doplatek/)
    expect(() => resolveSettlementAmount(3225, 3500)).toThrow(/celý doplatek/)
  })

  it("odmítne nulu, zápornou a nečíselnou částku", () => {
    expect(() => resolveSettlementAmount(3225, 0)).toThrow(/kladné/)
    expect(() => resolveSettlementAmount(3225, -5)).toThrow(/kladné/)
    expect(() => resolveSettlementAmount(3225, Number.NaN)).toThrow(/kladné/)
  })
})

describe("pickOpenBalanceCollection — která kolekce dostane platbu", () => {
  it("vezme prázdnou not_paid kolekci na stejnou částku (ta z výzvy k doplacení)", () => {
    expect(
      pickOpenBalanceCollection([depositCollection, balanceCollection], 3225)?.id
    ).toBe("paycol_balance")
  })

  it("dá přednost shodné částce před jinou otevřenou", () => {
    const stale = { ...balanceCollection, id: "paycol_stale", amount: 3000 }
    expect(
      pickOpenBalanceCollection([stale, balanceCollection], 3225)?.id
    ).toBe("paycol_balance")
    // Bez shody se vezme kterákoli prázdná not_paid — částka se pak srovná.
    expect(pickOpenBalanceCollection([stale], 3225)?.id).toBe("paycol_stale")
  })

  it("nikdy nesáhne na zaplacenou, čekající ani zachycenou kolekci", () => {
    expect(pickOpenBalanceCollection([depositCollection], 1075)).toBeNull()
    expect(
      pickOpenBalanceCollection([{ ...balanceCollection, status: "awaiting" }], 3225)
    ).toBeNull()
    expect(
      pickOpenBalanceCollection(
        [
          {
            ...balanceCollection,
            payments: [{ captured_at: "2026-10-09T10:00:00Z", canceled_at: null }],
          },
        ],
        3225
      )
    ).toBeNull()
    expect(pickOpenBalanceCollection([], 3225)).toBeNull()
    expect(pickOpenBalanceCollection(null, 3225)).toBeNull()
  })
})

describe("nativeShortfall — co objednávce chybí nativně", () => {
  it("#31: celkem 4 300 − zachyceno 1 075 = 3 225 (BigNumber tvary včetně)", () => {
    expect(nativeShortfall(order31())).toBe(3225)
  })

  it("po zápisu doplatku je nula, vratka dluh zvětšuje", () => {
    expect(
      nativeShortfall(
        order31({
          payment_collections: [
            depositCollection,
            { ...balanceCollection, status: "completed", captured_amount: 3225 },
          ],
        })
      )
    ).toBe(0)
    expect(
      nativeShortfall(
        order31({
          payment_collections: [
            { ...depositCollection, refunded_amount: 1075 },
            { ...balanceCollection, status: "completed", captured_amount: 3225 },
          ],
        })
      )
    ).toBe(1075)
  })
})

describe('captureCoveredByBalanceMail — kdy generické „Platba přijata" mlčí', () => {
  const now = Date.parse("2026-10-09T12:00:00Z")

  it("kolekce s offline_method = ruční záznam, mlčet", () => {
    expect(
      captureCoveredByBalanceMail(
        { payment_collection: { id: "paycol_x", metadata: { offline_method: "cash" } } },
        [],
        now
      )
    ).toBe(true)
  })

  it("zaplacená žádost o doplatek na tutéž kolekci = doplatek z brány, mlčet", () => {
    expect(
      captureCoveredByBalanceMail(
        { payment_collection: { id: "paycol_balance", metadata: null } },
        [depositRequest, { ...openBalanceRequest, status: "paid" }],
        now
      )
    ).toBe(true)
  })

  it("záchrana: doplatek označený zaplaceným před chvílí, i bez vazby na kolekci", () => {
    expect(
      captureCoveredByBalanceMail(
        { payment_collection: { id: "paycol_other", metadata: null } },
        [
          {
            ...openBalanceRequest,
            status: "paid",
            payment_collection_id: null,
            paid_at: "2026-10-09T11:58:00Z",
          },
        ],
        now
      )
    ).toBe(true)
  })

  it("starý doplatek, záloha nebo nic — e-mail jde", () => {
    expect(
      captureCoveredByBalanceMail(
        { payment_collection: { id: "paycol_other", metadata: null } },
        [
          {
            ...openBalanceRequest,
            status: "paid",
            payment_collection_id: null,
            paid_at: "2026-10-09T09:00:00Z",
          },
        ],
        now
      )
    ).toBe(false)
    expect(
      captureCoveredByBalanceMail(
        { payment_collection: { id: "paycol_deposit", metadata: null } },
        [depositRequest],
        now
      )
    ).toBe(false)
    expect(captureCoveredByBalanceMail(null, null, now)).toBe(false)
  })
})

describe("settleBalanceOffline — jedno kliknutí zapíše peníze i doplatek", () => {
  type Calls = {
    collectionsCreated: unknown[]
    collectionsUpdated: Array<{ id: string; data: any }>
    marked: unknown[]
    requestUpdates: any[]
    requestCreates: any[]
    productionUpdates: any[]
    events: any[]
  }

  const setup = (
    {
      order = order31(),
      production = productionOrder,
      requests = [depositRequest, openBalanceRequest],
    }: { order?: any; production?: any; requests?: any[] } = {},
    markPaidImpl?: (input: unknown) => Promise<unknown>
  ) => {
    const calls: Calls = {
      collectionsCreated: [],
      collectionsUpdated: [],
      marked: [],
      requestUpdates: [],
      requestCreates: [],
      productionUpdates: [],
      events: [],
    }
    const container = {
      resolve: (key: string) => {
        if (key === "query") {
          return { graph: async () => ({ data: order ? [order] : [] }) }
        }
        if (key === "logger") {
          return { info: () => undefined, warn: () => undefined, error: () => undefined }
        }
        if (key === MADE_TO_ORDER_MODULE) {
          return {
            listProductionOrders: async () => (production ? [production] : []),
            listProductionPaymentRequests: async () => requests,
            updateProductionPaymentRequests: async (data: any) => {
              calls.requestUpdates.push(data)
              return { ...requests.find((r) => r.id === data.id), ...data }
            },
            createProductionPaymentRequests: async (data: any) => {
              calls.requestCreates.push(data)
              return { id: "ppr_new", ...data }
            },
            updateProductionOrders: async (data: any) => {
              calls.productionUpdates.push(data)
              return { ...production, ...data }
            },
          }
        }
        if (key === "payment") {
          return {
            updatePaymentCollections: async (id: string, data: any) => {
              calls.collectionsUpdated.push({ id, data })
              return { id, ...data }
            },
          }
        }
        if (key === "event_bus") {
          return {
            emit: async (event: any) => {
              calls.events.push(event)
            },
          }
        }
        throw new Error(`Unexpected resolve("${key}")`)
      },
    }
    const runners = {
      createCollection: async (input: unknown) => {
        calls.collectionsCreated.push(input)
        return { id: "paycol_new" }
      },
      markPaid: async (input: unknown) => {
        calls.marked.push(input)
        if (markPaidImpl) return markPaidImpl(input)
        return undefined
      },
    }
    return { container, runners, calls }
  }

  it("#31: znovu použije otevřenou kolekci doplatku, zachytí ji a označí žádost zaplacenou", async () => {
    const { container, runners, calls } = setup()

    const result = await settleBalanceOffline(
      container as never,
      { order_id: "order_31", method: "cash", note: " u pultu ", actor: "user_lucia" },
      runners
    )

    expect(result).toEqual({
      settled: true,
      amount: 3225,
      currency_code: "czk",
      method: "cash",
      request_id: "ppr_balance",
      payment_collection_id: "paycol_balance",
      display_id: 31,
    })

    // Nativní strana: žádná nová kolekce, metadata PŘED zachycením, pak capture.
    expect(calls.collectionsCreated).toEqual([])
    expect(calls.collectionsUpdated).toHaveLength(1)
    expect(calls.collectionsUpdated[0].id).toBe("paycol_balance")
    expect(calls.collectionsUpdated[0].data.amount).toBeUndefined()
    expect(calls.collectionsUpdated[0].data.metadata).toMatchObject({
      offline_method: "cash",
      offline_note: "u pultu",
      recorded_by: "user_lucia",
    })
    expect(calls.marked).toEqual([
      { order_id: "order_31", payment_collection_id: "paycol_balance", captured_by: "user_lucia" },
    ])

    // Produkční strana: stejný ocas jako doplatek z brány.
    expect(calls.requestCreates).toEqual([])
    expect(calls.requestUpdates).toHaveLength(1)
    expect(calls.requestUpdates[0]).toMatchObject({
      id: "ppr_balance",
      status: "paid",
      provider_status: "PAID_OFFLINE",
      selected_method: "cash",
      amount: 3225,
    })
    expect(calls.requestUpdates[0].paid_at).toBeInstanceOf(Date)
    expect(calls.productionUpdates).toEqual([
      expect.objectContaining({ id: "po_31", stage: "ready_to_ship" }),
    ])
    expect(calls.events).toEqual([
      {
        name: "made-to-order.balance-paid",
        data: {
          order_id: "order_31",
          production_order_id: "po_31",
          payment_request_id: "ppr_balance",
          amount: 3225,
          currency_code: "czk",
        },
      },
    ])
  })

  it("bez otevřené kolekce ji založí; bez žádosti ji založí rovnou zaplacenou", async () => {
    const { container, runners, calls } = setup({
      order: order31({ payment_collections: [depositCollection] }),
      requests: [depositRequest],
    })

    const result = await settleBalanceOffline(
      container as never,
      { order_id: "order_31", method: "bank_transfer" },
      runners
    )

    expect(result.settled).toBe(true)
    expect(calls.collectionsCreated).toEqual([{ order_id: "order_31", amount: 3225 }])
    expect(calls.marked).toEqual([
      expect.objectContaining({ payment_collection_id: "paycol_new" }),
    ])
    expect(calls.requestCreates).toEqual([
      expect.objectContaining({
        type: "balance",
        status: "paid",
        amount: 3225,
        currency_code: "czk",
        payment_collection_id: "paycol_new",
        selected_method: "bank_transfer",
        production_order_id: "po_31",
      }),
    ])
    expect(calls.requestCreates[0].idempotency_key).toMatch(/^balance-offline:po_31:/)
    expect(calls.events[0].data.payment_request_id).toBe("ppr_new")
  })

  it("odkaz na starou částku: kolekci i žádost srovná na skutečný dluh (příplatek)", async () => {
    const { container, runners, calls } = setup({
      production: { ...productionOrder, surcharge: 500 },
    })

    const result = await settleBalanceOffline(
      container as never,
      { order_id: "order_31", method: "card_on_site" },
      runners
    )

    expect(result.settled && result.amount).toBe(3725)
    expect(calls.collectionsUpdated[0].data.amount).toBe(3725)
    expect(calls.requestUpdates[0].amount).toBe(3725)
    expect(calls.events[0].data.amount).toBe(3725)
  })

  it("nic nezbývá → nic nedělá", async () => {
    const { container, runners, calls } = setup({
      requests: [depositRequest, { ...openBalanceRequest, status: "paid" }],
    })

    const result = await settleBalanceOffline(
      container as never,
      { order_id: "order_31", method: "cash" },
      runners
    )

    expect(result).toEqual({ settled: false, reason: "nic nezbývá", outstanding: 0 })
    expect(calls.marked).toEqual([])
    expect(calls.requestUpdates).toEqual([])
    expect(calls.events).toEqual([])
  })

  it("částečná platba se odmítne dřív, než se čehokoli dotkne", async () => {
    const { container, runners, calls } = setup()

    await expect(
      settleBalanceOffline(
        container as never,
        { order_id: "order_31", method: "cash", amount: 3000 },
        runners
      )
    ).rejects.toThrow(/celý doplatek/)
    expect(calls.marked).toEqual([])
    expect(calls.collectionsUpdated).toEqual([])
    expect(calls.events).toEqual([])
  })

  it("opakování po pádu produkční strany: nativně už zapsáno → nezachytí podruhé, dotáhne žádost", async () => {
    const { container, runners, calls } = setup({
      order: order31({
        payment_collections: [
          depositCollection,
          { ...balanceCollection, status: "completed", captured_amount: 3225 },
        ],
      }),
    })

    const result = await settleBalanceOffline(
      container as never,
      { order_id: "order_31", method: "cash" },
      runners
    )

    expect(result.settled).toBe(true)
    expect(calls.collectionsCreated).toEqual([])
    expect(calls.marked).toEqual([])
    expect(calls.requestUpdates[0]).toMatchObject({ id: "ppr_balance", status: "paid" })
    expect(calls.events).toHaveLength(1)
  })

  it("zákazník mezitím zaplatil online (ComGate odmítne pustit relaci) → česká chyba, žádný e-mail", async () => {
    const { container, runners, calls } = setup({}, async () => {
      throw new Error(
        "Comgate payment 123 is PAID; refusing to drop the Medusa session it belongs to"
      )
    })

    await expect(
      settleBalanceOffline(
        container as never,
        { order_id: "order_31", method: "cash" },
        runners
      )
    ).rejects.toThrow(/zaplatil online/)
    expect(calls.requestUpdates).toEqual([])
    expect(calls.events).toEqual([])
  })

  it("odmítne neplatný způsob, cizí objednávku a zrušenou zakázku", async () => {
    await expect(
      settleBalanceOffline(
        setup().container as never,
        { order_id: "order_31", method: "paypal" as never },
        setup().runners
      )
    ).rejects.toThrow(/Způsob platby/)

    const plain = setup({ production: null })
    await expect(
      settleBalanceOffline(
        plain.container as never,
        { order_id: "order_31", method: "cash" },
        plain.runners
      )
    ).rejects.toThrow(/není zakázka/)

    const cancelled = setup({ production: { ...productionOrder, stage: "cancelled" } })
    await expect(
      settleBalanceOffline(
        cancelled.container as never,
        { order_id: "order_31", method: "cash" },
        cancelled.runners
      )
    ).rejects.toThrow(/Zrušená/)
  })
})
