import {
  canRefund,
  capturedTotal,
  clampRefundAmount,
  moneyState,
  refundedTotal,
  toNumber,
} from "../claims/refund-rules"
import {
  checkClaimRules,
  type ClaimIntakeInput,
} from "../claims/intake"
import { withdrawalGate } from "../claims/context"

/**
 * Pravidla refundace a intake modulu „Reklamace a zrušení"
 * (docs/reklamace-a-zruseni.md §3–4) — matice, kterou by nikdo neuhlídal v
 * hlavě: kdy se smí vracet, kolik, a kdy zákazník vůbec smí žádat.
 */

describe("toNumber — BigNumber tvary z query.graph", () => {
  it("čte číslo, řetězec i {value} / {numeric_}", () => {
    expect(toNumber(12.5)).toBe(12.5)
    expect(toNumber("300")).toBe(300)
    expect(toNumber({ value: "1250", precision: 20 })).toBe(1250)
    expect(toNumber({ numeric_: 99 })).toBe(99)
  })

  it("nikdy nevrátí NaN — to je tichá přeskočená refundace", () => {
    expect(toNumber(undefined)).toBe(0)
    expect(toNumber(null)).toBe(0)
    expect(toNumber({ nonsense: true })).toBe(0)
    expect(toNumber("abc")).toBe(0)
  })
})

describe("canRefund — stavový gating (§3)", () => {
  const body = {}

  it("odmítá pending a finální stavy", () => {
    expect(canRefund({ kind: "reklamace", status: "pending" }, body).allowed).toBe(false)
    expect(canRefund({ kind: "vraceni", status: "resolved" }, body).allowed).toBe(false)
    expect(canRefund({ kind: "vraceni", status: "rejected" }, body).allowed).toBe(false)
    expect(canRefund({ kind: "vraceni", status: "cancelled" }, body).allowed).toBe(false)
  })

  it("odstoupení / vrácení: v approved jen se skip_goods_check, v received vždy", () => {
    expect(canRefund({ kind: "odstoupeni", status: "approved" }, body).allowed).toBe(false)
    expect(
      canRefund({ kind: "odstoupeni", status: "approved" }, { skip_goods_check: true })
        .allowed
    ).toBe(true)
    expect(canRefund({ kind: "vraceni", status: "received" }, body).allowed).toBe(true)
    // „true" musí být opravdu boolean true, ne řetězec z formuláře.
    expect(
      canRefund({ kind: "vraceni", status: "approved" }, { skip_goods_check: "true" })
        .allowed
    ).toBe(false)
  })

  it("reklamace: v approved jen refund/discount, v received cokoli", () => {
    expect(
      canRefund({ kind: "reklamace", status: "approved", resolution: "repair" }, body)
        .allowed
    ).toBe(false)
    expect(
      canRefund({ kind: "reklamace", status: "approved", resolution: "replace" }, body)
        .allowed
    ).toBe(false)
    expect(
      canRefund({ kind: "reklamace", status: "approved", resolution: "refund" }, body)
        .allowed
    ).toBe(true)
    expect(
      canRefund({ kind: "reklamace", status: "approved", resolution: "discount" }, body)
        .allowed
    ).toBe(true)
    expect(
      canRefund({ kind: "reklamace", status: "received", resolution: "repair" }, body)
        .allowed
    ).toBe(true)
  })

  it("vždy řekne proč, česky", () => {
    const verdict = canRefund({ kind: "odstoupeni", status: "approved" }, body)
    expect(verdict.reason).toMatch(/zboží/i)
  })
})

describe("clampRefundAmount — výchozí = zbývá, nikdy přes zbývá", () => {
  it("bez částky vrací celé zbývá", () => {
    expect(clampRefundAmount(undefined, 1250)).toEqual({ amount: 1250, clamped: false })
    expect(clampRefundAmount(0, 1250)).toEqual({ amount: 1250, clamped: false })
  })

  it("nižší částku pustí, vyšší seřízne", () => {
    expect(clampRefundAmount(300, 1250)).toEqual({ amount: 300, clamped: false })
    expect(clampRefundAmount(2000, 1250)).toEqual({ amount: 1250, clamped: true })
  })

  it("když nezbývá nic, vrací nulu (volající odmítne)", () => {
    expect(clampRefundAmount(100, 0).amount).toBe(0)
    expect(clampRefundAmount(undefined, 0.001).amount).toBe(0)
  })
})

describe("moneyState — zachyceno / vráceno / zbývá", () => {
  const order = {
    currency_code: "czk",
    payment_collections: [
      {
        payments: [
          {
            id: "pay_1",
            provider_id: "pp_comgate_comgate",
            amount: { value: "1000" },
            captured_at: "2026-10-01T10:00:00Z",
            canceled_at: null,
            refunds: [],
          },
          {
            id: "pay_cancelled",
            amount: 500,
            captured_at: "2026-10-01T10:00:00Z",
            canceled_at: "2026-10-01T11:00:00Z",
          },
          { id: "pay_uncaptured", amount: 700, captured_at: null },
        ],
      },
    ],
    metadata: {},
  }

  it("počítá jen zachycené, nezrušené platby — i v BigNumber tvaru", () => {
    expect(capturedTotal(order)).toBe(1000)
    expect(moneyState(order, [])).toEqual({ captured: 1000, refunded: 0, remaining: 1000 })
  })

  it("nepočítá refundaci z modulu dvakrát (žádost i refund_history)", () => {
    const withHistory = {
      ...order,
      metadata: {
        refund_history: [
          { amount: 300, return_request_id: "rr_1", refunded_at: "2026-10-02T10:00:00Z" },
        ],
      },
    }
    const request = { id: "rr_1", refunds: [{ amount: 300, method: "comgate", at: "" }] }
    expect(refundedTotal(withHistory, [request])).toBe(300)
    expect(moneyState(withHistory, [request]).remaining).toBe(700)
  })

  it("přičítá cizí refundace (Vrátit rozdíl) i ztracenou historii z žádosti", () => {
    const withHistory = {
      ...order,
      metadata: {
        refund_history: [{ amount: 100, reason: "customer_edit", method: "comgate" }],
      },
    }
    // Historie o téhle žádosti nic neví — řádek žádosti je pravda.
    const request = { id: "rr_2", refunds: [{ amount: 200, method: "manual", at: "" }] }
    expect(refundedTotal(withHistory, [request])).toBe(300)
    expect(moneyState(withHistory, [request]).remaining).toBe(700)
  })

  it("nativní refundace Medusy jsou spodní hranice", () => {
    const nativelyRefunded = {
      ...order,
      payment_collections: [
        {
          payments: [
            {
              id: "pay_1",
              amount: 1000,
              captured_at: "2026-10-01T10:00:00Z",
              refunds: [{ amount: { value: "1000" } }],
            },
          ],
        },
      ],
    }
    expect(moneyState(nativelyRefunded, []).remaining).toBe(0)
  })
})

describe("checkClaimRules / withdrawalGate — pravidla intake (§4)", () => {
  const plainOrder = {
    id: "order_1",
    display_id: 42,
    email: "a@b.cz",
    items: [{ id: "li_1", metadata: {} }],
    fulfillments: [],
  }
  const madeToOrderOrder = {
    ...plainOrder,
    items: [{ id: "li_1", metadata: { made_to_order: true } }],
  }
  const input = (kind: ClaimIntakeInput["kind"], extra: Partial<ClaimIntakeInput> = {}) =>
    ({ kind, reason: "důvod", ...extra }) as ClaimIntakeInput

  it("čistá zakázka nesmí odstoupit ani vrátit (§1837), reklamovat smí", () => {
    expect(checkClaimRules(madeToOrderOrder, [], input("odstoupeni")).ok).toBe(false)
    expect(checkClaimRules(madeToOrderOrder, [], input("vraceni")).ok).toBe(false)
    expect(
      checkClaimRules(madeToOrderOrder, [], input("reklamace", { requested_resolution: "repair" })).ok
    ).toBe(true)
  })

  it("14 dnů od odeslání: po lhůtě ne, bez odeslání ano", () => {
    const shipped = {
      ...plainOrder,
      fulfillments: [{ shipped_at: "2026-09-01T10:00:00Z", canceled_at: null }],
    }
    const late = new Date("2026-09-20T10:00:00Z")
    const inTime = new Date("2026-09-10T10:00:00Z")
    expect(checkClaimRules(shipped, [], input("odstoupeni"), late).ok).toBe(false)
    expect(checkClaimRules(shipped, [], input("odstoupeni"), inTime).ok).toBe(true)
    expect(checkClaimRules(plainOrder, [], input("odstoupeni"), late).ok).toBe(true)
    // Zrušená zásilka lhůtu nespouští.
    const cancelledShipment = {
      ...plainOrder,
      fulfillments: [{ shipped_at: "2026-09-01T10:00:00Z", canceled_at: "2026-09-02T10:00:00Z" }],
    }
    expect(checkClaimRules(cancelledShipment, [], input("odstoupeni"), late).ok).toBe(true)
  })

  it("reklamace vyžaduje požadované vyřízení", () => {
    expect(checkClaimRules(plainOrder, [], input("reklamace")).ok).toBe(false)
    expect(
      checkClaimRules(plainOrder, [], input("reklamace", { requested_resolution: "refund" })).ok
    ).toBe(true)
  })

  it("jedna otevřená žádost na objednávku; uzavřené nevadí", () => {
    expect(
      checkClaimRules(plainOrder, [{ status: "approved" }], input("odstoupeni")).ok
    ).toBe(false)
    expect(
      checkClaimRules(plainOrder, [{ status: "rejected" }, { status: "resolved" }], input("odstoupeni")).ok
    ).toBe(true)
  })

  it("withdrawalGate vrací lhůtu a důvod blokace pro storefront", () => {
    const shipped = {
      ...plainOrder,
      fulfillments: [{ shipped_at: "2026-09-01T10:00:00Z", canceled_at: null }],
    }
    const gate = withdrawalGate(shipped, [], new Date("2026-09-20T10:00:00Z"))
    expect(gate.can_withdraw).toBe(false)
    expect(gate.withdrawal_deadline).toBe("2026-09-15T10:00:00.000Z")
    expect(gate.withdraw_block_reason).toMatch(/lhůta/i)

    const open = withdrawalGate(plainOrder, [{ status: "pending" }])
    expect(open.can_withdraw).toBe(false)
    expect(open.withdrawal_deadline).toBeNull()

    expect(withdrawalGate(plainOrder, [{ status: "resolved" }]).can_withdraw).toBe(true)
  })
})
