import {
  cancelReasonFor,
  claimSummaryFor,
  latestRequestOf,
  toMerchantOrderRow,
} from "../projection"

/**
 * Projekce Objednávky+ pro záložky Zrušené · Vrácení peněz · Reklamace
 * (docs/reklamace-a-zruseni.md §11.4): poslední žádost k objednávce s penězi
 * přes celou objednávku a důvod zrušení.
 */

const order = {
  id: "order_1",
  display_id: 42,
  currency_code: "czk",
  total: 2000,
  items: [{ id: "li_1", quantity: 2 }],
  metadata: {},
  payment_collections: [
    {
      captured_amount: 2000,
      payments: [
        {
          id: "pay_1",
          provider_id: "pp_comgate_comgate",
          amount: { value: "2000" },
          captured_at: "2026-10-01T10:00:00Z",
          canceled_at: null,
          refunds: [],
        },
      ],
    },
  ],
  fulfillments: [],
  shipping_methods: [],
}

const older = {
  id: "rr_old",
  order_id: "order_1",
  kind: "vraceni",
  status: "rejected",
  reason: "nelíbí se",
  created_at: "2026-09-01T10:00:00Z",
  refunds: [],
}
const newer = {
  id: "rr_new",
  order_id: "order_1",
  kind: "reklamace",
  status: "approved",
  reason: "prasklá glazura",
  damage_cause: "carrier",
  created_at: "2026-10-05T10:00:00Z",
  refunds: [{ amount: 300, method: "comgate", at: "2026-10-06T10:00:00Z" }],
  line_items: [
    { line_item_id: "li_1", title: "Mísa", quantity: 1, unit_price: 1000, total: 1000, currency_code: "czk" },
  ],
}

describe("claimSummaryFor — poslední žádost + peníze", () => {
  it("bere nejnovější žádost a počítá zbývá přes všechny žádosti", () => {
    expect(latestRequestOf([older, newer])?.id).toBe("rr_new")
    const claim = claimSummaryFor(order, [older, newer])
    expect(claim).toEqual({
      id: "rr_new",
      kind: "reklamace",
      status: "approved",
      reason: "prasklá glazura",
      damage_cause: "carrier",
      refund_amount: 300,
      remaining: 1700,
      // min(zbývá 1 700, položky 1 000)
      suggested_amount: 1000,
      created_at: "2026-10-05T10:00:00Z",
    })
  })

  it("bez položek je výchozí částka celé zbývá; bez objednávky nula", () => {
    expect(claimSummaryFor(order, [older])?.suggested_amount).toBe(2000)
    expect(claimSummaryFor(null, [older])?.remaining).toBe(0)
    expect(claimSummaryFor(order, [])).toBeNull()
    expect(claimSummaryFor(order, undefined)).toBeNull()
  })

  it("neznámá příčina poškození se nevydává za badge", () => {
    expect(
      claimSummaryFor(order, [{ ...newer, damage_cause: "weird" }])?.damage_cause
    ).toBeNull()
  })
})

describe("cancelReasonFor — důvod zrušení", () => {
  const cancelledState = {
    stage: "cancelled",
    stage_history: [
      { from: "received", to: "working", at: "", note: null },
      { from: "working", to: "cancelled", at: "", note: "Zákazník si to rozmyslel po telefonu" },
    ],
  }

  it("mimo fázi cancelled je null", () => {
    expect(cancelReasonFor({ stage: "working", stage_history: [] }, [newer])).toBeNull()
  })

  it("žádost o odstoupení / vrácení má přednost před poznámkou z historie", () => {
    const withdrawal = { ...older, kind: "odstoupeni", reason: "Objednal jsem omylem dvakrát" }
    expect(cancelReasonFor(cancelledState, [withdrawal, newer])).toBe(
      "Objednal jsem omylem dvakrát"
    )
    // Reklamace není důvod zrušení.
    expect(cancelReasonFor(cancelledState, [newer])).toBe(
      "Zákazník si to rozmyslel po telefonu"
    )
  })

  it("bez žádosti i poznámky je null", () => {
    expect(cancelReasonFor({ stage: "cancelled", stage_history: [] }, [])).toBeNull()
    expect(cancelReasonFor({ stage: "cancelled" }, undefined)).toBeNull()
  })
})

describe("toMerchantOrderRow — claim a cancel_reason v řádku", () => {
  const state = {
    id: "mos_1",
    order_id: "order_1",
    stage: "cancelled",
    stage_history: [{ from: "received", to: "cancelled", at: "", note: "ručně" }],
  }

  it("s načtenými žádostmi nese claim; bez nich null, důvod jen z historie", () => {
    const withRequests = toMerchantOrderRow(state, order, null, [], [older, newer])
    expect(withRequests.claim?.id).toBe("rr_new")
    expect(withRequests.cancel_reason).toBe("nelíbí se")

    const legacyCaller = toMerchantOrderRow(state, order, null, [])
    expect(legacyCaller.claim).toBeNull()
    expect(legacyCaller.cancel_reason).toBe("ručně")
  })

  it("prázdný seznam žádostí = claim null (ne chyba)", () => {
    expect(toMerchantOrderRow(state, order, null, [], []).claim).toBeNull()
  })
})
