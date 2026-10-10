import {
  classifyClaimCase,
  DEPOSIT_KEPT_NOTE_PREFIX,
  planClaimCase,
  type ClaimCaseInput,
  type ClaimFlags,
} from "../claims/case"
import {
  buildClaimOrderItems,
  refundedQuantitiesOf,
  validateRefundItems,
} from "../claims/order-items"
import {
  commissionPaidRemaining,
  depositRefundable,
  productionBlockOf,
} from "../claims/production"
import { requestRefunds, round2 } from "../claims/refund-rules"
import { productionOutstanding } from "../ship-gate"

/**
 * Stránka žádosti (docs/reklamace-a-zruseni.md §12): případ + průběh + akce
 * (`planClaimCase`), položky objednávky s tím, co se ještě dá vrátit, a
 * záloha zakázky. Všechno čisté — bez kontejneru.
 */

const T = {
  created: "2026-10-01T08:00:00.000Z",
  decided: "2026-10-02T09:00:00.000Z",
  received: "2026-10-05T10:00:00.000Z",
  refunded: "2026-10-06T11:00:00.000Z",
  resolved: "2026-10-06T11:00:01.000Z",
  cancelled: "2026-10-07T12:00:00.000Z",
}

const flags = (over: Partial<ClaimFlags> = {}): ClaimFlags => ({
  goods_shipped: false,
  is_commission: false,
  is_mixed: false,
  paid_online: true,
  pay_later: false,
  nothing_captured: false,
  ...over,
})

const money = (captured: number, refunded = 0) => ({
  captured,
  refunded,
  remaining: Math.max(0, round2(captured - refunded)),
})

const request = (over: Record<string, unknown> = {}) => ({
  id: "rr_1",
  kind: "odstoupeni",
  status: "pending",
  resolution: null,
  created_at: T.created,
  decided_at: null,
  goods_received_at: null,
  resolved_at: null,
  refunds: null,
  ...over,
})

const plan = (input: Partial<ClaimCaseInput> & { request: any }) =>
  planClaimCase({
    flags: flags(),
    money: money(0),
    production: null,
    ...input,
  })

const states = (result: ReturnType<typeof planClaimCase>) =>
  result.steps.map((step) => `${step.key}:${step.state}`)

const trueActions = (result: ReturnType<typeof planClaimCase>) =>
  Object.entries(result.actions)
    .filter(([, allowed]) => allowed)
    .map(([key]) => key)
    .sort()

describe("classifyClaimCase — který případ to je (§12.5)", () => {
  it("odstoupení / vrácení před odesláním: podle peněz", () => {
    expect(classifyClaimCase({ kind: "odstoupeni" }, flags({ nothing_captured: true }))).toBe("cancel_unpaid")
    expect(classifyClaimCase({ kind: "odstoupeni" }, flags())).toBe("cancel_paid_unshipped")
    expect(classifyClaimCase({ kind: "vraceni" }, flags({ nothing_captured: true }))).toBe("cancel_unpaid")
  })

  it("po odeslání: odstoupení vs. vrácení", () => {
    expect(classifyClaimCase({ kind: "odstoupeni" }, flags({ goods_shipped: true }))).toBe("withdrawal_shipped")
    expect(classifyClaimCase({ kind: "vraceni" }, flags({ goods_shipped: true }))).toBe("return_shipped")
  })

  it("zakázka: smíšená má přednost před čistou", () => {
    expect(classifyClaimCase({ kind: "odstoupeni" }, flags({ is_commission: true }))).toBe("commission_cancel")
    expect(classifyClaimCase({ kind: "vraceni" }, flags({ is_commission: true, is_mixed: true }))).toBe("mixed_cancel")
  })

  it("reklamace (i neznámý druh ze starých řádků) je vždy `claim`", () => {
    expect(classifyClaimCase({ kind: "reklamace" }, flags({ is_commission: true, goods_shipped: true }))).toBe("claim")
    expect(classifyClaimCase({ kind: null }, flags())).toBe("claim")
  })
})

describe("cancel_unpaid — Přijato → Schváleno → Objednávka zrušena", () => {
  const f = flags({ nothing_captured: true })

  it("čeká na rozhodnutí: jen schválit / zamítnout / stornovat", () => {
    const result = plan({ request: request(), flags: f })
    expect(result.case).toBe("cancel_unpaid")
    expect(states(result)).toEqual(["received:done", "approved:current", "order_cancelled:upcoming"])
    expect(result.steps[0].at).toBe(T.created)
    expect(trueActions(result)).toEqual(["approve", "cancel_request", "reject"])
  })

  it("po schválení (decide žádost rovnou vyřídí) zbývá zrušit objednávku", () => {
    const result = plan({
      request: request({ status: "resolved", decided_at: T.decided, resolved_at: T.decided }),
      flags: f,
    })
    // Krok zrušení je dostupný i po vyřízení → `upcoming`, ne `skipped`.
    expect(states(result)).toEqual(["received:done", "approved:done", "order_cancelled:upcoming"])
    expect(trueActions(result)).toEqual(["cancel_order"])
  })

  it("zrušená objednávka uzavírá průběh s datem", () => {
    const result = plan({
      request: request({ status: "resolved", decided_at: T.decided, resolved_at: T.decided }),
      flags: f,
      order: { status: "canceled", canceled_at: T.cancelled },
    })
    expect(states(result)).toEqual(["received:done", "approved:done", "order_cancelled:done"])
    expect(result.steps[2].at).toBe(T.cancelled)
    expect(result.actions.cancel_order).toBe(false)
  })
})

describe("cancel_paid_unshipped — … → Peníze vráceny → Objednávka zrušena", () => {
  it("schváleno, zaplaceno, neodesláno: peníze jdou rovnou, zrušit ještě nejde", () => {
    const result = plan({
      request: request({ status: "approved", decided_at: T.decided }),
      money: money(1200),
    })
    expect(result.case).toBe("cancel_paid_unshipped")
    expect(states(result)).toEqual([
      "received:done",
      "approved:done",
      "refunded:current",
      "order_cancelled:upcoming",
    ])
    // Zboží nikdy neodešlo → „Zboží přijato" nedává smysl; refund bez skip.
    expect(result.actions.received).toBe(false)
    expect(result.actions.refund_all).toBe(true)
    expect(result.actions.refund_items).toBe(true)
    expect(result.actions.cancel_order).toBe(false)
    expect(result.actions.resolve).toBe(true)
  })

  it("po vrácení všeho je žádost vyřízená a objednávku lze zrušit", () => {
    const result = plan({
      request: request({
        status: "resolved",
        decided_at: T.decided,
        resolved_at: T.resolved,
        refunds: [{ amount: 1200, method: "comgate", at: T.refunded, scope: "all" }],
      }),
      money: money(1200, 1200),
    })
    expect(states(result)).toEqual([
      "received:done",
      "approved:done",
      "refunded:done",
      "order_cancelled:upcoming",
    ])
    expect(result.steps[2].at).toBe(T.refunded)
    expect(trueActions(result)).toEqual(["cancel_order"])
  })

  it("částečná refundace u otevřené žádosti: krok peněz zůstává aktuální", () => {
    const result = plan({
      request: request({
        status: "approved",
        decided_at: T.decided,
        refunds: [{ amount: 500, method: "comgate", at: T.refunded }],
      }),
      money: money(1200, 500),
    })
    expect(states(result)[2]).toBe("refunded:current")
    expect(result.actions.refund_all).toBe(true)
  })
})

describe("withdrawal_shipped / return_shipped — zboží zpět, peníze, vyřízeno", () => {
  const f = flags({ goods_shipped: true })

  it("schváleno po odeslání: čeká se na zboží (§1832/4), peníze zatím ne", () => {
    const result = plan({ request: request({ status: "approved", decided_at: T.decided }), flags: f, money: money(900) })
    expect(result.case).toBe("withdrawal_shipped")
    expect(states(result)).toEqual([
      "received:done",
      "approved:done",
      "goods_received:current",
      "refunded:upcoming",
      "resolved:upcoming",
      "order_cancelled:upcoming",
    ])
    expect(result.actions.received).toBe(true)
    expect(result.actions.refund_all).toBe(false)
    expect(result.actions.refund_items).toBe(false)
    expect(result.actions.cancel_order).toBe(false)
  })

  it("zboží přijato: peníze jdou", () => {
    const result = plan({
      request: request({ kind: "vraceni", status: "received", decided_at: T.decided, goods_received_at: T.received }),
      flags: f,
      money: money(900),
    })
    expect(result.case).toBe("return_shipped")
    expect(states(result).slice(2, 4)).toEqual(["goods_received:done", "refunded:current"])
    expect(result.steps[2].at).toBe(T.received)
    expect(result.actions.refund_all).toBe(true)
    expect(result.actions.received).toBe(false)
  })

  it("vyřízeno s vrácením: zrušení objednávky zůstává volitelné", () => {
    const result = plan({
      request: request({
        status: "resolved",
        decided_at: T.decided,
        goods_received_at: T.received,
        resolved_at: T.resolved,
        refunds: [{ amount: 900, method: "comgate", at: T.refunded }],
      }),
      flags: f,
      money: money(900, 900),
    })
    expect(states(result)).toEqual([
      "received:done",
      "approved:done",
      "goods_received:done",
      "refunded:done",
      "resolved:done",
      "order_cancelled:upcoming",
    ])
    expect(trueActions(result)).toEqual(["cancel_order"])
  })

  it("vyřízeno bez peněz (dobírka, nic zachyceno): krok peněz i zboží přeskočeny", () => {
    const result = plan({
      request: request({ status: "resolved", decided_at: T.decided, resolved_at: T.resolved }),
      flags: flags({ goods_shipped: true, pay_later: true, paid_online: false, nothing_captured: true }),
      money: money(0),
    })
    expect(states(result)).toEqual([
      "received:done",
      "approved:done",
      "goods_received:skipped",
      "refunded:skipped",
      "resolved:done",
      "order_cancelled:upcoming",
    ])
  })
})

describe("commission_cancel — Přijato → Schváleno → Záloha → Zakázka zrušena", () => {
  const f = flags({ is_commission: true })
  const production = (over: Record<string, unknown> = {}) => ({
    stage: "confirmed",
    deposit_paid: 1500,
    deposit_refunded: 0,
    deposit_refunded_at: null,
    cancelled_at: null,
    ...over,
  })

  it("schváleno: rozhodnout o záloze; zrušit zakázku jde (s volbou), objednávku ne", () => {
    const result = plan({
      request: request({ status: "approved", decided_at: T.decided }),
      flags: f,
      money: money(1500),
      production: production(),
    })
    expect(result.case).toBe("commission_cancel")
    expect(states(result)).toEqual([
      "received:done",
      "approved:done",
      "deposit:current",
      "production_cancelled:upcoming",
    ])
    expect(result.steps[2].label).toBe("Záloha: vrácena / ponechána")
    expect(result.actions.refund_deposit).toBe(true)
    expect(result.actions.cancel_production).toBe(true)
    expect(result.actions.cancel_order).toBe(false)
  })

  it("záloha vrácená (žádost tím vyřízená): zakázku lze zrušit i po vyřízení", () => {
    const result = plan({
      request: request({
        status: "resolved",
        decided_at: T.decided,
        resolved_at: T.resolved,
        refunds: [{ amount: 1500, method: "comgate", at: T.refunded, scope: "deposit" }],
      }),
      flags: f,
      money: money(1500, 1500),
      production: production({ deposit_refunded: 1500, deposit_refunded_at: T.refunded }),
    })
    expect(states(result)).toEqual([
      "received:done",
      "approved:done",
      "deposit:done",
      "production_cancelled:upcoming",
    ])
    expect(result.steps[2].label).toBe("Záloha vrácena")
    expect(result.steps[2].at).toBe(T.refunded)
    expect(result.actions.refund_deposit).toBe(false)
    expect(result.actions.cancel_production).toBe(true)
  })

  it("záloha ponechána a zakázka zrušená: hotovo", () => {
    const result = plan({
      request: request({
        status: "resolved",
        decided_at: T.decided,
        resolved_at: T.resolved,
        resolution_note: `${DEPOSIT_KEPT_NOTE_PREFIX}: 1 500 Kč`,
      }),
      flags: f,
      money: money(1500),
      production: production({ stage: "cancelled", cancelled_at: T.cancelled }),
    })
    expect(states(result)).toEqual([
      "received:done",
      "approved:done",
      "deposit:done",
      "production_cancelled:done",
    ])
    expect(result.steps[2].label).toBe("Záloha ponechána")
    expect(result.steps[3].at).toBe(T.cancelled)
    expect(trueActions(result)).toEqual([])
  })

  it("bez zaplacené zálohy se krok zálohy přeskočí", () => {
    const result = plan({
      request: request({ status: "approved", decided_at: T.decided }),
      flags: flags({ is_commission: true, nothing_captured: true }),
      money: money(0),
      production: production({ deposit_paid: 0 }),
    })
    expect(states(result)).toEqual([
      "received:done",
      "approved:done",
      "deposit:skipped",
      "production_cancelled:current",
    ])
    expect(result.actions.refund_deposit).toBe(false)
  })
})

describe("claim — Rozhodnuto (způsob) → Zboží přijato → Vyřízeno / Peníze vráceny", () => {
  const f = flags({ goods_shipped: true })

  it("nová reklamace: rozhodnout", () => {
    const result = plan({ request: request({ kind: "reklamace" }), flags: f, money: money(1305) })
    expect(result.case).toBe("claim")
    expect(states(result)).toEqual([
      "received:done",
      "decided:current",
      "goods_received:upcoming",
      "resolved:upcoming",
    ])
    expect(result.steps[1].label).toBe("Rozhodnuto (způsob)")
  })

  it("oprava: bez kroku peněz, vyřízení nese způsob", () => {
    const result = plan({
      request: request({ kind: "reklamace", status: "approved", resolution: "repair", decided_at: T.decided }),
      flags: f,
      money: money(1305),
    })
    expect(states(result)).toEqual([
      "received:done",
      "decided:done",
      "goods_received:current",
      "resolved:upcoming",
    ])
    expect(result.steps[1].label).toBe("Rozhodnuto — oprava")
    expect(result.steps[3].label).toBe("Vyřízeno — oprava")
    expect(result.actions.refund_all).toBe(false)
    expect(result.actions.received).toBe(true)
    expect(result.actions.resolve).toBe(true)
  })

  it("vrácení peněz: krok peněz je, zboží se čeká", () => {
    const result = plan({
      request: request({ kind: "reklamace", status: "approved", resolution: "refund", decided_at: T.decided }),
      flags: f,
      money: money(1305),
    })
    expect(states(result)).toEqual([
      "received:done",
      "decided:done",
      "goods_received:current",
      "refunded:upcoming",
      "resolved:upcoming",
    ])
    expect(result.actions.refund_all).toBe(true)
  })

  it("sleva: zboží zůstává u zákazníka → krok zboží přeskočen, peníze aktuální", () => {
    const result = plan({
      request: request({ kind: "reklamace", status: "approved", resolution: "discount", decided_at: T.decided }),
      flags: f,
      money: money(1305),
    })
    expect(states(result)).toEqual([
      "received:done",
      "decided:done",
      "goods_received:skipped",
      "refunded:current",
      "resolved:upcoming",
    ])
  })

  it("vyřízená oprava: žádná akce, zrušení objednávky u reklamace nikdy", () => {
    const result = plan({
      request: request({
        kind: "reklamace",
        status: "resolved",
        resolution: "repair",
        decided_at: T.decided,
        goods_received_at: T.received,
        resolved_at: T.resolved,
      }),
      flags: f,
      money: money(1305),
    })
    expect(states(result)).toEqual([
      "received:done",
      "decided:done",
      "goods_received:done",
      "resolved:done",
    ])
    expect(trueActions(result)).toEqual([])
  })

  it("oprava, u které se nakonec vrátila část peněz: krok peněz se objeví a je hotový", () => {
    const result = plan({
      request: request({
        kind: "reklamace",
        status: "resolved",
        resolution: "repair",
        decided_at: T.decided,
        goods_received_at: T.received,
        resolved_at: T.resolved,
        refunds: [{ amount: 300, method: "manual", at: T.refunded }],
      }),
      flags: f,
      money: money(1305, 300),
    })
    expect(states(result)).toEqual([
      "received:done",
      "decided:done",
      "goods_received:done",
      "refunded:done",
      "resolved:done",
    ])
  })
})

describe("mixed_cancel — produktová + zakázková část", () => {
  const f = flags({ is_commission: true, is_mixed: true })
  const production = (over: Record<string, unknown> = {}) => ({
    stage: "in_production",
    deposit_paid: 1500,
    deposit_refunded: 0,
    deposit_refunded_at: null,
    cancelled_at: null,
    ...over,
  })

  it("schváleno, neodesláno: produkty i záloha čekají, zakázku lze zrušit", () => {
    const result = plan({
      request: request({ status: "approved", decided_at: T.decided }),
      flags: f,
      money: money(3000),
      production: production(),
    })
    expect(result.case).toBe("mixed_cancel")
    expect(states(result)).toEqual([
      "received:done",
      "approved:done",
      "refunded_items:current",
      "deposit:upcoming",
      "production_cancelled:upcoming",
      "resolved:upcoming",
    ])
    expect(result.actions.refund_items).toBe(true)
    expect(result.actions.refund_deposit).toBe(true)
    expect(result.actions.cancel_production).toBe(true)
    // Celou objednávku zrušit až po vrácení všeho.
    expect(result.actions.cancel_order).toBe(false)
  })

  it("za produkty nic nepřišlo (dobírka), jen záloha kartou: krok produktů se přeskočí", () => {
    const result = plan({
      request: request({ status: "approved", decided_at: T.decided }),
      flags: flags({ is_commission: true, is_mixed: true, pay_later: true }),
      money: money(1500),
      production: production(),
    })
    expect(states(result)).toEqual([
      "received:done",
      "approved:done",
      "refunded_items:skipped",
      "deposit:current",
      "production_cancelled:upcoming",
      "resolved:upcoming",
    ])
  })

  it("po odeslání má produktová část krok „Zboží přijato“", () => {
    const result = plan({
      request: request({ status: "approved", decided_at: T.decided }),
      flags: flags({ is_commission: true, is_mixed: true, goods_shipped: true }),
      money: money(3000),
      production: production(),
    })
    expect(states(result)[2]).toBe("goods_received:current")
  })

  it("záloha vrácená, produkty ne: krok zálohy hotový, produkty aktuální", () => {
    const result = plan({
      request: request({
        status: "approved",
        decided_at: T.decided,
        refunds: [{ amount: 1500, method: "comgate", at: T.refunded, scope: "deposit" }],
      }),
      flags: f,
      money: money(3000, 1500),
      production: production({ deposit_refunded: 1500, deposit_refunded_at: T.refunded }),
    })
    expect(states(result)).toEqual([
      "received:done",
      "approved:done",
      "refunded_items:current",
      "deposit:done",
      "production_cancelled:upcoming",
      "resolved:upcoming",
    ])
  })

  it("produkty vrácené, záloha ponechaná: zbývá zrušit zakázku i po vyřízení", () => {
    const result = plan({
      request: request({
        status: "resolved",
        decided_at: T.decided,
        resolved_at: T.resolved,
        resolution_note: `${DEPOSIT_KEPT_NOTE_PREFIX}: 1 500 Kč`,
        refunds: [
          {
            amount: 1500,
            method: "comgate",
            at: T.refunded,
            scope: "items",
            items: [{ line_item_id: "li_misa", quantity: 1 }],
          },
        ],
      }),
      flags: f,
      money: money(3000, 1500),
      production: production(),
    })
    expect(states(result)).toEqual([
      "received:done",
      "approved:done",
      "refunded_items:done",
      "deposit:done",
      "production_cancelled:upcoming",
      "resolved:done",
    ])
    expect(result.actions.cancel_production).toBe(true)
  })

  it("refund_items podle položek: když už není co vrátit, tlačítko zhasne", () => {
    const base = {
      request: request({ status: "approved", decided_at: T.decided }),
      flags: f,
      money: money(3000),
      production: production(),
    }
    expect(
      plan({
        ...base,
        items: [{ is_made_to_order: false, refundable_quantity: 0, refundable_amount: 0 }],
      }).actions.refund_items
    ).toBe(false)
    expect(
      plan({
        ...base,
        items: [{ is_made_to_order: false, refundable_quantity: 1, refundable_amount: 1305 }],
      }).actions.refund_items
    ).toBe(true)
  })
})

describe("zamítnuto / stornováno ukončují kteroukoli větev", () => {
  it("zamítnutí nahradí rozhodnutí a zbytek přeskočí", () => {
    const result = plan({
      request: request({ kind: "reklamace", status: "rejected", decided_at: T.decided }),
      flags: flags({ goods_shipped: true }),
      money: money(1305),
    })
    expect(states(result)).toEqual([
      "received:done",
      "rejected:done",
      "goods_received:skipped",
      "resolved:skipped",
    ])
    expect(result.steps[1].at).toBe(T.decided)
    expect(trueActions(result)).toEqual([])
  })

  it("storno se zařadí za poslední hotový krok", () => {
    const result = plan({
      request: request({ status: "cancelled", decided_at: T.decided, updated_at: T.cancelled }),
      flags: flags({ goods_shipped: true }),
      money: money(900),
    })
    expect(states(result)).toEqual([
      "received:done",
      "approved:done",
      "cancelled:done",
      "goods_received:skipped",
      "refunded:skipped",
      "resolved:skipped",
      "order_cancelled:skipped",
    ])
    expect(result.steps[2].at).toBe(T.cancelled)
    expect(trueActions(result)).toEqual([])
  })
})

// --- položky objednávky (§12.2–12.3) ---------------------------------------

const order = {
  id: "order_1",
  currency_code: "czk",
  items: [
    {
      id: "li_misa",
      title: "Mísa",
      product_title: "Zahradní mísa",
      variant_title: "Ø 32 cm",
      thumbnail: "https://cdn/misa.jpg",
      unit_price: 1450,
      total: { value: "2610" },
      detail: { quantity: 2 },
      metadata: {},
    },
    {
      id: "li_hrnek",
      title: "Hrnek",
      product_title: "Keramický hrnek",
      unit_price: 390,
      total: 390,
      detail: { quantity: 1 },
      metadata: {},
    },
    {
      id: "li_zakazka",
      title: "Zakázková fontána",
      unit_price: 5000,
      total: 5000,
      detail: { quantity: 1 },
      metadata: { made_to_order: { specification: "modrá glazura" } },
    },
  ],
}

describe("refundedQuantitiesOf — vrácené kusy přes všechny žádosti objednávky", () => {
  it("sčítá `refunds[].items` ze sourozenců; staré záznamy bez položek ignoruje", () => {
    const totals = refundedQuantitiesOf([
      {
        id: "rr_a",
        refunds: [
          { amount: 1305, method: "comgate", at: T.refunded, scope: "items", items: [{ line_item_id: "li_misa", quantity: 1 }] },
          { amount: 200, method: "manual", at: T.refunded },
        ],
      },
      {
        id: "rr_b",
        refunds: [
          { amount: 1695, method: "comgate", at: T.refunded, scope: "items", items: [
            { line_item_id: "li_misa", quantity: 1 },
            { line_item_id: "li_hrnek", quantity: 1 },
          ] },
        ],
      },
      { id: "rr_c", refund_amount: 500 },
    ])
    expect(totals.get("li_misa")).toBe(2)
    expect(totals.get("li_hrnek")).toBe(1)
    expect(totals.get("li_zakazka")).toBeUndefined()
  })
})

describe("buildClaimOrderItems — řádky objednávky pro stránku žádosti", () => {
  const requests = [
    {
      id: "rr_old",
      refunds: [
        { amount: 1305, method: "comgate", at: T.refunded, scope: "items", items: [{ line_item_id: "li_misa", quantity: 1 }] },
      ],
    },
    { id: "rr_1", refunds: null, line_items: [{ line_item_id: "li_misa", quantity: 2 }, { line_item_id: "li_hrnek", quantity: 1 }] },
  ]

  it("cena za kus po slevě, už vráceno, zbývá vrátit, výběr v žádosti", () => {
    const items = buildClaimOrderItems({
      order: order as any,
      requests,
      request: requests[1],
      commissionPaidRemaining: 1500,
    })
    expect(items[0]).toEqual({
      line_item_id: "li_misa",
      title: "Zahradní mísa",
      variant_title: "Ø 32 cm",
      thumbnail: "https://cdn/misa.jpg",
      quantity: 2,
      unit_total: 1305,
      line_total: 2610,
      is_made_to_order: false,
      refunded_quantity: 1,
      refundable_quantity: 1,
      refundable_amount: 1305,
      selected_in_claim: 2,
    })
    expect(items[1]).toMatchObject({
      line_item_id: "li_hrnek",
      unit_total: 390,
      refunded_quantity: 0,
      refundable_quantity: 1,
      refundable_amount: 390,
      selected_in_claim: 1,
    })
  })

  it("zakázková položka: strop = co je skutečně zaplaceno (záloha)", () => {
    const items = buildClaimOrderItems({
      order: order as any,
      requests,
      request: null,
      commissionPaidRemaining: 1500,
    })
    expect(items[2]).toMatchObject({
      line_item_id: "li_zakazka",
      is_made_to_order: true,
      unit_total: 5000,
      refundable_quantity: 1,
      refundable_amount: 1500,
      selected_in_claim: 0,
    })
    // Bez zakázky (null) strop není.
    expect(
      buildClaimOrderItems({ order: order as any, requests: [], request: null, commissionPaidRemaining: null })[2]
        .refundable_amount
    ).toBe(5000)
  })
})

describe("validateRefundItems — scope: items (§12.3)", () => {
  const items = buildClaimOrderItems({
    order: order as any,
    requests: [
      {
        id: "rr_old",
        refunds: [
          { amount: 1305, method: "comgate", at: T.refunded, scope: "items", items: [{ line_item_id: "li_misa", quantity: 1 }] },
        ],
      },
    ],
    request: null,
    commissionPaidRemaining: 1500,
  })

  it("prázdný výběr, cizí položka, nesmyslné množství → česká chyba", () => {
    expect(validateRefundItems(items, [])).toMatchObject({ ok: false, message: expect.stringMatching(/aspoň jednu/) })
    expect(validateRefundItems(items, undefined)).toMatchObject({ ok: false })
    expect(validateRefundItems(items, [{ line_item_id: "li_cizi", quantity: 1 }])).toMatchObject({
      ok: false,
      message: expect.stringMatching(/nepatří/),
    })
    expect(validateRefundItems(items, [{ line_item_id: "li_hrnek", quantity: 0 }])).toMatchObject({
      ok: false,
      message: expect.stringMatching(/celé číslo/),
    })
    expect(validateRefundItems(items, [{ line_item_id: "li_hrnek", quantity: 1.5 }]).ok).toBe(false)
  })

  it("tutéž položku nejde vrátit dvakrát: strop je refundable_quantity", () => {
    const verdict = validateRefundItems(items, [{ line_item_id: "li_misa", quantity: 2 }])
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) {
      expect(verdict.message).toMatch(/nejvýš 1 ks/)
      expect(verdict.message).toMatch(/1 ks už vráceno/)
    }
    // Duplicitní id se sčítá — 1 + 1 u mísy už je moc.
    expect(
      validateRefundItems(items, [
        { line_item_id: "li_misa", quantity: 1 },
        { line_item_id: "li_misa", quantity: 1 },
      ]).ok
    ).toBe(false)
  })

  it("částka = Σ cena za kus × ks; zakázka omezená zaplaceným", () => {
    const verdict = validateRefundItems(items, [
      { line_item_id: "li_misa", quantity: 1 },
      { line_item_id: "li_hrnek", quantity: 1 },
    ])
    expect(verdict).toEqual({
      ok: true,
      amount: 1695,
      items: [
        { line_item_id: "li_misa", quantity: 1, title: "Zahradní mísa", unit_total: 1305, amount: 1305 },
        { line_item_id: "li_hrnek", quantity: 1, title: "Keramický hrnek", unit_total: 390, amount: 390 },
      ],
    })
    const commission = validateRefundItems(items, [{ line_item_id: "li_zakazka", quantity: 1 }])
    expect(commission.ok).toBe(true)
    if (commission.ok) expect(commission.amount).toBe(1500)
  })
})

// --- záloha zakázky (§12.3 deposit) ----------------------------------------

describe("productionBlockOf / depositRefundable — záloha a doplatek zakázky", () => {
  const productionOrder = {
    id: "po_1",
    stage: "in_production",
    agreed_total: { value: "5000" },
    original_total: 5000,
    surcharge: null,
    deposit_refunded: null,
    deposit_refunded_at: null,
    cancelled_at: null,
  }
  const paymentRequests = [
    { type: "deposit", status: "paid", amount: { value: "1500" }, created_at: "2026-09-01T10:00:00Z" },
    { type: "balance", status: "pending", amount: 3500, created_at: "2026-09-20T10:00:00Z" },
  ]

  it("zaplacená záloha = zaplacené žádosti typu deposit; doplatek zvlášť; dluh přes outstandingFor", () => {
    const block = productionBlockOf(productionOrder, paymentRequests)
    expect(block).toMatchObject({
      id: "po_1",
      stage: "in_production",
      agreed_total: 5000,
      surcharge: 0,
      deposit_paid: 1500,
      balance_paid: 0,
      outstanding: 3500,
      deposit_refunded: 0,
      balance_request_status: "pending",
    })
    expect(depositRefundable(block)).toBe(1500)
    expect(commissionPaidRemaining(block)).toBe(1500)
  })

  it("částka pro scope deposit = záloha − už vrácená záloha; po vrácení nula", () => {
    const partly = productionBlockOf({ ...productionOrder, deposit_refunded: 500 }, paymentRequests)
    expect(depositRefundable(partly)).toBe(1000)
    expect(commissionPaidRemaining(partly)).toBe(1000)
    const fully = productionBlockOf(
      { ...productionOrder, deposit_refunded: { value: "1500" }, deposit_refunded_at: T.refunded },
      paymentRequests
    )
    expect(depositRefundable(fully)).toBe(0)
    expect(fully.deposit_refunded_at).toBe(T.refunded)
  })

  it("zaplacený doplatek zvedne „zaplaceno za zakázku“, dluh je nula", () => {
    const block = productionBlockOf(productionOrder, [
      paymentRequests[0],
      { ...paymentRequests[1], status: "paid" },
    ])
    expect(block.balance_paid).toBe(3500)
    expect(block.outstanding).toBe(0)
    expect(block.balance_request_status).toBe("paid")
    expect(commissionPaidRemaining(block)).toBe(5000)
  })
})

describe("zrušená zakázka nic nedluží (brána odeslání u smíšené objednávky)", () => {
  it("productionOutstanding vrací 0 pro stage cancelled", () => {
    const production = {
      agreed_total: 5000,
      surcharge: 0,
      payment_requests: [{ status: "paid", amount: 1500 }],
    }
    expect(productionOutstanding(production)).toBe(3500)
    expect(productionOutstanding({ ...production, stage: "cancelled" })).toBe(0)
  })
})

describe("requestRefunds — rozsah a položky refundace se zachovají", () => {
  it("nové záznamy nesou scope + items, staré dostanou null", () => {
    const refunds = requestRefunds({
      id: "rr_1",
      refunds: [
        { amount: 1305, method: "comgate", at: T.refunded, scope: "items", items: [{ line_item_id: "li_misa", quantity: 1, title: "Mísa", unit_total: 1305, amount: 1305 }] },
        { amount: 1500, method: "comgate", at: T.refunded, scope: "deposit" },
        { amount: 100, method: "manual", at: T.refunded },
        { amount: 10, method: "manual", at: T.refunded, scope: "nesmysl", items: "ne" },
      ],
    })
    expect(refunds[0].scope).toBe("items")
    expect(refunds[0].items).toEqual([
      { line_item_id: "li_misa", quantity: 1, title: "Mísa", unit_total: 1305, amount: 1305 },
    ])
    expect(refunds[1]).toMatchObject({ scope: "deposit", items: null })
    expect(refunds[2]).toMatchObject({ scope: null, items: null })
    expect(refunds[3]).toMatchObject({ scope: null, items: null })
  })
})
