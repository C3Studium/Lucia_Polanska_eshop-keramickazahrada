import {
  AUTO_CANCEL_DECISION_NOTE,
  isAutoCancelledClaim,
  shouldAutoCancel,
} from "../claims/auto-cancel"
import {
  attachComponents,
  buildClaimComponents,
  EVEN_SPLIT_NOTE,
  refundedComponentQuantitiesOf,
  splitUnitShare,
} from "../claims/bundle-components"
import {
  comgateConfirmationOf,
  manualConfirmation,
  providerConfirmationText,
} from "../claims/comgate-confirmation"
import { damageCauseSentence, isDamageCause, photosRequiredFor } from "../claims/constants"
import { checkClaimRules } from "../claims/intake"
import { photosRequiredMessage } from "../claims/line-items"
import {
  buildClaimOrderItems,
  refundedQuantitiesOf,
  type ClaimOrderItemDetail,
} from "../claims/order-items"
import {
  allRemainingLines,
  clampLinesToRemaining,
  itemsMirrorOf,
  legacyBodyToLines,
  MANUAL_AMOUNT_LABEL,
  priceRefundLines,
  refundLinesText,
  REFUND_LINES_REQUIRED,
  REFUND_SHIPPING_ALREADY,
  REFUND_SHIPPING_TWICE,
  shippingRefundedOf,
  shippingStateOf,
} from "../claims/refund-lines"
import { refundLinesOf, requestRefunds } from "../claims/refund-rules"

/**
 * Doplnění §13 (docs/reklamace-a-zruseni.md): auto-zrušení, košík vrácení,
 * balíček po komponentách, potvrzení ComGate, poškozený kus. Všechno čisté —
 * bez kontejneru.
 */

const item = (over: Partial<ClaimOrderItemDetail> = {}): ClaimOrderItemDetail => ({
  line_item_id: "li_misa",
  product_id: "prod_misa",
  title: "Zahradní mísa",
  variant_title: null,
  thumbnail: null,
  quantity: 2,
  unit_total: 500,
  line_total: 1000,
  is_made_to_order: false,
  is_bundle: false,
  refunded_quantity: 0,
  refundable_quantity: 2,
  refundable_amount: 1000,
  selected_in_claim: 0,
  ...over,
})

const shipping = (total = 129, refunded = 0) => ({
  total,
  refunded,
  refundable: Math.max(0, total - refunded),
})

describe("shouldAutoCancel — §13.1", () => {
  const base = {
    kind: "odstoupeni",
    nothing_captured: true,
    goods_shipped: false,
    is_commission: false,
  }

  it("odstoupení i vrácení: nezaplaceno + neodesláno + bez zakázky → zrušit hned", () => {
    expect(shouldAutoCancel(base)).toBe(true)
    expect(shouldAutoCancel({ ...base, kind: "vraceni" })).toBe(true)
  })

  it("reklamace se nikdy neruší sama", () => {
    expect(shouldAutoCancel({ ...base, kind: "reklamace" })).toBe(false)
    expect(shouldAutoCancel({ ...base, kind: null })).toBe(false)
  })

  it("cokoli zaplaceno, odesláno, nebo zakázka → rozhoduje majitelka", () => {
    expect(shouldAutoCancel({ ...base, nothing_captured: false })).toBe(false)
    expect(shouldAutoCancel({ ...base, goods_shipped: true })).toBe(false)
    expect(shouldAutoCancel({ ...base, is_commission: true })).toBe(false)
  })

  it("isAutoCancelledClaim pozná žádost vyřízenou serverem (subscriber order.canceled mlčí)", () => {
    expect(
      isAutoCancelledClaim({ status: "resolved", decision_note: AUTO_CANCEL_DECISION_NOTE })
    ).toBe(true)
    expect(isAutoCancelledClaim({ status: "resolved", decision_note: "ručně" })).toBe(false)
    expect(
      isAutoCancelledClaim({ status: "approved", decision_note: AUTO_CANCEL_DECISION_NOTE })
    ).toBe(false)
  })
})

describe("priceRefundLines — košík vrácení (§13.2)", () => {
  const items = [
    item(),
    item({
      line_item_id: "li_hrnek",
      product_id: "prod_hrnek",
      title: "Hrnek",
      quantity: 1,
      unit_total: 390,
      line_total: 390,
      refundable_quantity: 1,
      refundable_amount: 390,
    }),
  ]

  it("ocení položky, poštovné i ruční částku; součet = částka", () => {
    const verdict = priceRefundLines({
      items,
      shipping: shipping(),
      lines: [
        { type: "item", line_item_id: "li_misa", quantity: 1 },
        { type: "shipping" },
        { type: "custom", amount: 50.5, label: "Náhrada balného" },
      ],
      remaining: 2000,
    })
    expect(verdict.ok).toBe(true)
    if (verdict.ok) {
      expect(verdict.amount).toBe(679.5)
      expect(verdict.lines.map((line) => line.type)).toEqual(["item", "shipping", "custom"])
      expect(verdict.lines[0]).toMatchObject({ title: "Zahradní mísa", quantity: 1, amount: 500 })
      expect(verdict.lines[1]).toMatchObject({ amount: 129 })
      expect(verdict.lines[2]).toMatchObject({ title: "Náhrada balného", amount: 50.5 })
      expect(verdict.clamped).toBe(false)
    }
  })

  it("prázdný košík a neznámý řádek se odmítnou", () => {
    const empty = priceRefundLines({ items, shipping: shipping(), lines: [], remaining: 100 })
    expect(empty.ok).toBe(false)
    if (!empty.ok) expect(empty.message).toBe(REFUND_LINES_REQUIRED)
    const weird = priceRefundLines({
      items,
      shipping: shipping(),
      lines: [{ type: "gift" }],
      remaining: 100,
    })
    expect(weird.ok).toBe(false)
  })

  it("položka jen do refundable_quantity (tutéž mísu nejde vrátit dvakrát)", () => {
    const verdict = priceRefundLines({
      items: [item({ refunded_quantity: 1, refundable_quantity: 1, refundable_amount: 500 })],
      shipping: shipping(0),
      lines: [{ type: "item", line_item_id: "li_misa", quantity: 2 }],
      remaining: 5000,
    })
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) expect(verdict.message).toMatch(/nejvýš 1 ks/)
  })

  it("poštovné jen jednou: dvakrát v košíku i po dřívější refundaci se odmítne", () => {
    const twice = priceRefundLines({
      items,
      shipping: shipping(),
      lines: [{ type: "shipping" }, { type: "shipping" }],
      remaining: 1000,
    })
    expect(twice.ok).toBe(false)
    if (!twice.ok) expect(twice.message).toBe(REFUND_SHIPPING_TWICE)

    const already = priceRefundLines({
      items,
      shipping: shipping(129, 129),
      lines: [{ type: "shipping" }],
      remaining: 1000,
    })
    expect(already.ok).toBe(false)
    if (!already.ok) expect(already.message).toBe(REFUND_SHIPPING_ALREADY)
  })

  it("výslovný košík přes zbývá se odmítne; „celá objednávka“ se seřízne odzadu", () => {
    const lines = [
      { type: "item", line_item_id: "li_misa", quantity: 2 },
      { type: "shipping" },
    ]
    const over = priceRefundLines({ items, shipping: shipping(), lines, remaining: 1050 })
    expect(over.ok).toBe(false)
    if (!over.ok) expect(over.message).toMatch(/přesahuje zbývající/)

    const clamped = priceRefundLines({
      items,
      shipping: shipping(),
      lines,
      remaining: 1050,
      clampToRemaining: true,
    })
    expect(clamped.ok).toBe(true)
    if (clamped.ok) {
      expect(clamped.clamped).toBe(true)
      expect(clamped.amount).toBe(1050)
      // Zboží zůstává celé (2 ks · 1 000), poštovné dostane jen zbytek.
      expect(clamped.lines[0]).toMatchObject({ type: "item", quantity: 2, amount: 1000 })
      expect(clamped.lines[1]).toMatchObject({ type: "shipping", amount: 50 })
    }
  })

  it("komponenta balíčku: jen u balíčku, jen známá, jen do stropu", () => {
    const bundle = item({
      line_item_id: "li_set",
      product_id: "prod_set",
      title: "Sada",
      quantity: 1,
      unit_total: 900,
      line_total: 900,
      refundable_quantity: 1,
      refundable_amount: 900,
      is_bundle: true,
      components: [
        {
          product_id: "prod_a",
          variant_id: "var_a",
          title: "Miska A",
          thumbnail: null,
          quantity: 2,
          unit_share: 300,
          refunded_quantity: 0,
          refundable_quantity: 2,
        },
        {
          product_id: "prod_b",
          variant_id: "var_b",
          title: "Miska B",
          thumbnail: null,
          quantity: 1,
          unit_share: 300,
          refunded_quantity: 0,
          refundable_quantity: 1,
        },
      ],
    })
    const ok = priceRefundLines({
      items: [bundle],
      shipping: shipping(0),
      lines: [{ type: "component", line_item_id: "li_set", product_id: "prod_a", quantity: 2 }],
      remaining: 900,
    })
    expect(ok.ok).toBe(true)
    if (ok.ok) {
      expect(ok.amount).toBe(600)
      expect(ok.lines[0]).toMatchObject({ type: "component", product_id: "prod_a", quantity: 2 })
    }
    const tooMany = priceRefundLines({
      items: [bundle],
      shipping: shipping(0),
      lines: [{ type: "component", line_item_id: "li_set", product_id: "prod_b", quantity: 2 }],
      remaining: 900,
    })
    expect(tooMany.ok).toBe(false)
    if (!tooMany.ok) expect(tooMany.message).toMatch(/nejvýš 1 ks/)
    const notBundle = priceRefundLines({
      items,
      shipping: shipping(0),
      lines: [{ type: "component", line_item_id: "li_misa", product_id: "prod_a", quantity: 1 }],
      remaining: 900,
    })
    expect(notBundle.ok).toBe(false)
  })

  it("staré tělo se mapuje: items → řádky položek, amount → ruční řádek, nic → null", () => {
    expect(legacyBodyToLines({ items: [{ line_item_id: "li_misa", quantity: 1 }] })).toEqual([
      { type: "item", line_item_id: "li_misa", quantity: 1 },
    ])
    expect(legacyBodyToLines({ amount: 250 })).toEqual([
      { type: "custom", amount: 250, label: MANUAL_AMOUNT_LABEL },
    ])
    expect(legacyBodyToLines({ lines: [{ type: "shipping" }], amount: 250 })).toEqual([
      { type: "shipping" },
    ])
    expect(legacyBodyToLines({})).toBeNull()
  })

  it("„celá objednávka“ = všechny zbývající kusy + poštovné (jen když zbývá)", () => {
    expect(allRemainingLines(items, shipping())).toEqual([
      { type: "item", line_item_id: "li_misa", quantity: 2 },
      { type: "item", line_item_id: "li_hrnek", quantity: 1 },
      { type: "shipping" },
    ])
    expect(
      allRemainingLines(
        [item({ refundable_quantity: 0, refundable_amount: 0 })],
        shipping(129, 129)
      )
    ).toEqual([])
  })

  it("clampLinesToRemaining ubírá odzadu a drží součet", () => {
    const result = clampLinesToRemaining(
      [
        { type: "item", amount: 500, quantity: 1 },
        { type: "custom", amount: 300, quantity: 1 },
      ],
      600
    )
    expect(result.amount).toBe(600)
    expect(result.lines[1].amount).toBe(100)
  })

  it("text řádků pro e-mail a protokol", () => {
    // `Intl.NumberFormat("cs-CZ")` odděluje tisíce a měnu nezlomitelnou
    // mezerou — pro porovnání se sjednotí na obyčejnou.
    const text = refundLinesText(
      [
        { type: "item", title: "Zahradní mísa", quantity: 2, amount: 1000 },
        { type: "component", title: "Miska A", quantity: 1, amount: 300 },
        { type: "shipping", title: "Poštovné a balné", amount: 129 },
        { type: "custom", title: "Náhrada", amount: 50 },
      ],
      "czk"
    )?.replace(/[  ]/g, " ")
    expect(text).toContain("Zahradní mísa · 2 ks · 1 000 Kč")
    expect(text).toContain("Miska A (komponenta balíčku) · 1 ks · 300 Kč")
    expect(text).toContain("Poštovné a balné · 129 Kč")
    expect(text).toContain("Vrácení — Náhrada · 50 Kč")
    expect(refundLinesText(null, "czk")).toBeNull()
  })
})

describe("poštovné a položky přes všechny žádosti (§13.2 stropy)", () => {
  const requests = [
    {
      id: "rr_1",
      refunds: [
        {
          amount: 629,
          method: "comgate",
          at: "2026-10-01T10:00:00Z",
          lines: [
            { type: "item", line_item_id: "li_misa", quantity: 1, amount: 500 },
            { type: "shipping", amount: 129 },
          ],
          // Zrcadlo `items` nesmí položku započítat podruhé.
          items: [{ line_item_id: "li_misa", quantity: 1, amount: 500 }],
        },
      ],
    },
    {
      id: "rr_0",
      // Starší záznam bez `lines` — čte se z `items`.
      refunds: [{ amount: 500, method: "manual", at: "2026-09-01T10:00:00Z", items: [{ line_item_id: "li_misa", quantity: 1 }] }],
    },
  ]

  it("shippingRefundedOf / shippingStateOf: poštovné jednou odešlo → nic k vrácení", () => {
    expect(shippingRefundedOf(requests)).toBe(true)
    expect(shippingRefundedOf([requests[1]])).toBe(false)
    expect(shippingStateOf({ shipping_total: 129 }, requests)).toEqual({
      total: 129,
      refunded: 129,
      refundable: 0,
      allowed: true,
    })
    expect(shippingStateOf({ shipping_total: "129" }, [requests[1]])).toEqual({
      total: 129,
      refunded: 0,
      refundable: 129,
      allowed: true,
    })
    // I přes `refund_history` bez žádosti.
    expect(
      shippingRefundedOf([], [{ amount: 129, lines: [{ type: "shipping", amount: 129 }] }])
    ).toBe(true)
  })

  it("refundedQuantitiesOf: lines mají přednost před items, starší záznam z items", () => {
    const totals = refundedQuantitiesOf(requests)
    expect(totals.get("li_misa")).toBe(2)
  })

  it("requestRefunds zachová id, lines, potvrzení ComGate i dobropis", () => {
    const [refund] = requestRefunds({
      id: "rr_1",
      refunds: [
        {
          id: "rr_1:1",
          amount: 629,
          method: "comgate",
          at: "2026-10-01T10:00:00Z",
          lines: [{ type: "shipping", amount: 129 }, { type: "nonsense" }],
          provider: "comgate",
          provider_ref: "ref_01",
          provider_test: true,
          provider_refunded_total: 629,
          credit_note: { status: "issued", number: "DO-2026-3", pdf_url: "https://x/do.pdf" },
        },
      ],
    })
    expect(refund.id).toBe("rr_1:1")
    expect(refund.lines).toEqual([
      expect.objectContaining({ type: "shipping", amount: 129 }),
    ])
    expect(refund.provider).toBe("comgate")
    expect(refund.provider_ref).toBe("ref_01")
    expect(refund.provider_test).toBe(true)
    expect(refund.provider_refunded_total).toBe(629)
    expect(refund.credit_note).toEqual({
      status: "issued",
      number: "DO-2026-3",
      pdf_url: "https://x/do.pdf",
      reason: null,
    })
    expect(refundLinesOf("nope")).toEqual([])
    expect(itemsMirrorOf([{ type: "item", line_item_id: "li_misa", quantity: 1, amount: 500 }])).toEqual([
      { line_item_id: "li_misa", quantity: 1, title: null, unit_total: 0, amount: 500 },
    ])
  })
})

describe("balíček po komponentách (§13.5)", () => {
  it("splitUnitShare: poměr podle cen, Σ = unit_total, dorovnání na poslední", () => {
    const split = splitUnitShare(900, [
      { quantity: 2, price: 400 },
      { quantity: 1, price: 400 },
    ])
    expect(split.pricing_note).toBeNull()
    expect(split.shares).toEqual([300, 300])
    const sum = split.shares[0] * 2 + split.shares[1]
    expect(sum).toBe(900)

    const odd = splitUnitShare(1000, [
      { quantity: 1, price: 333 },
      { quantity: 1, price: 333 },
      { quantity: 1, price: 333 },
    ])
    expect(odd.shares[0] + odd.shares[1] + odd.shares[2]).toBeCloseTo(1000, 2)
  })

  it("splitUnitShare: bez cen rovným dílem po kusech + poznámka", () => {
    const split = splitUnitShare(900, [
      { quantity: 2, price: null },
      { quantity: 1, price: 400 },
    ])
    expect(split.pricing_note).toBe(EVEN_SPLIT_NOTE)
    expect(split.shares).toEqual([300, 300])
    expect(splitUnitShare(900, [])).toEqual({ shares: [], pricing_note: null })
  })

  it("buildClaimComponents: strop = per balíček × nevrácené balíčky − vrácené kusy", () => {
    const bundle = item({
      line_item_id: "li_set",
      product_id: "prod_set",
      is_bundle: true,
      quantity: 2,
      unit_total: 900,
      refundable_quantity: 1,
      refunded_quantity: 1,
    })
    const refunded = refundedComponentQuantitiesOf([
      {
        id: "rr_1",
        refunds: [
          {
            amount: 300,
            method: "manual",
            at: "",
            lines: [{ type: "component", line_item_id: "li_set", product_id: "prod_a", quantity: 1, amount: 300 }],
          },
        ],
      },
    ])
    const built = buildClaimComponents(
      bundle,
      [
        { product_id: "prod_a", variant_id: "var_a", title: "Miska A", thumbnail: null, quantity: 2, price: 400 },
        { product_id: "prod_b", variant_id: null, title: "Miska B", thumbnail: null, quantity: 1, price: 400 },
      ],
      refunded
    )
    expect(built.components[0]).toMatchObject({
      product_id: "prod_a",
      unit_share: 300,
      refunded_quantity: 1,
      refundable_quantity: 1,
    })
    expect(built.components[1]).toMatchObject({ refundable_quantity: 1 })

    const attached = attachComponents(
      [bundle, item()],
      new Map([["li_set", [{ product_id: "prod_a", variant_id: null, title: "A", thumbnail: null, quantity: 1, price: null }]]]),
      []
    )
    expect(attached[0].components).toHaveLength(1)
    expect(attached[0].pricing_note).toBe(EVEN_SPLIT_NOTE)
    expect(attached[1].components).toBeUndefined()
  })

  it("buildClaimOrderItems značí balíček a nese product_id", () => {
    const [row] = buildClaimOrderItems({
      order: {
        items: [
          {
            id: "li_set",
            product_id: "prod_set",
            title: "Sada",
            quantity: 1,
            total: 900,
            product: { metadata: { is_bundle: true } },
          } as any,
        ],
      },
      requests: [],
      request: null,
      commissionPaidRemaining: null,
    })
    expect(row.is_bundle).toBe(true)
    expect(row.product_id).toBe("prod_set")
  })
})

describe("potvrzení ComGate (§13.4)", () => {
  const now = new Date("2026-10-10T12:00:00Z")

  it("čte refId, čas, test a součet z dat relace po refundu", () => {
    const confirmation = comgateConfirmationOf(
      [
        {
          lastRefundIdempotencyKey: "ref_01ABC",
          lastRefundRequestedAt: "2026-10-10T11:59:00.000Z",
          refundedAmountMinor: 62900,
          test: "true",
          providerStatus: "PAID",
        },
        null,
        { lastRefundIdempotencyKey: "ref_02DEF", refundedAmountMinor: 10000, test: false },
      ],
      now
    )
    expect(confirmation).toEqual({
      provider: "comgate",
      provider_ref: "ref_01ABC, ref_02DEF",
      provider_confirmed_at: "2026-10-10T11:59:00.000Z",
      provider_test: true,
      provider_refunded_total: 729,
      provider_status: "PAID",
    })
    expect(providerConfirmationText(confirmation)).toBe(
      "ComGate přijal (ref ref_01ABC, ref_02DEF, test)"
    )
  })

  it("bez čitelných dat: provider comgate, čas = teď, bez reference", () => {
    const confirmation = comgateConfirmationOf([null], now)
    expect(confirmation.provider_ref).toBeNull()
    expect(confirmation.provider_confirmed_at).toBe(now.toISOString())
    expect(confirmation.provider_refunded_total).toBeNull()
    expect(providerConfirmationText(confirmation)).toBe("ComGate přijal")
    expect(manualConfirmation(now).provider).toBe("manual")
    expect(providerConfirmationText(manualConfirmation(now))).toBeNull()
  })
})

describe("poškozený kus (§13.7)", () => {
  const order = {
    id: "order_1",
    display_id: 42,
    currency_code: "czk",
    items: [{ id: "li_misa", title: "Mísa", quantity: 1, total: 500 }],
    fulfillments: [],
  }

  it("damaged je platná příčina, fotky povinné, věta do protokolu", () => {
    expect(isDamageCause("damaged")).toBe(true)
    expect(photosRequiredFor("damaged")).toBe(true)
    expect(photosRequiredFor(null)).toBe(false)
    expect(damageCauseSentence("damaged")).toMatch(/Poškozený kus/)
    // 12. 10. 2026, Matěj: u ČP reklamuje příjemce, ne prodávající.
    expect(damageCauseSentence("carrier")).toMatch(/České pošty uplatňuje příjemce/)
    expect(damageCauseSentence(null)).toBeNull()
    expect(photosRequiredMessage("damaged")).toMatch(/poškozeného kusu/)
  })

  it("checkClaimRules: poškozený kus bez fotky = 400, s fotkou projde", () => {
    const base = {
      kind: "reklamace" as const,
      reason: "prasklá glazura",
      requested_resolution: "replace",
      line_items: [{ id: "li_misa", quantity: 1 }],
      damage_cause: "damaged",
    }
    const noPhoto = checkClaimRules(order as any, [], base)
    expect(noPhoto.ok).toBe(false)
    if (!noPhoto.ok) expect(noPhoto.message).toMatch(/fotku/)
    expect(
      checkClaimRules(order as any, [], {
        ...base,
        photos: [{ filename: "a.jpg", mime_type: "image/jpeg", data: "AAAA" }],
      }).ok
    ).toBe(true)
  })
})
