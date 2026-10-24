import { blocksWithdrawal } from "../claims/constants"
import { withdrawalGate } from "../claims/context"
import { checkClaimRules, takeoverSnapshotFor, type ClaimIntakeInput } from "../claims/intake"
import { ITEMS_MADE_TO_ORDER_RETURN, ITEMS_NOT_IN_ORDER, ITEMS_QUANTITY_TOO_HIGH } from "../claims/line-items"
import { isMadeToOrderItem } from "../claims/made-to-order"
import {
  easterSunday,
  formatPragueDate,
  formatPragueDateTime,
  isCzechPublicHoliday,
  maskRefundAccount,
  refundMethodTextFor,
  resolveWithdrawalItems,
  takeoverTextFor,
  WITHDRAWAL_NOTHING_WITHDRAWABLE,
  withdrawalItemsOf,
  withdrawalPeriodEndFor,
  withdrawalReturnAddress,
  withdrawalTimingFor,
} from "../claims/withdrawal"

/**
 * Odstoupení od smlouvy online (§ 1829–1837 OZ, tlačítko § 1830a) —
 * lhůta od převzetí, převzetí podle toho, co o zásilce víme, zakázka po
 * položkách, fronta žádostí a texty do potvrzení (14. 10. 2026).
 */

const SHIPPED = "2026-10-01T10:00:00Z"

const order = (extra: Record<string, unknown> = {}) => ({
  id: "order_1",
  display_id: 42,
  email: "jana@example.cz",
  currency_code: "czk",
  created_at: "2026-09-29T08:00:00Z",
  items: [
    { id: "li_misa", title: "Mísa", quantity: 1, total: 1305, metadata: {} },
    { id: "li_hrnek", title: "Hrnek", quantity: 2, total: 780, metadata: {} },
  ],
  fulfillments: [] as unknown[],
  ...extra,
})

const shipped = (extra: Record<string, unknown> = {}) =>
  order({ fulfillments: [{ shipped_at: SHIPPED, canceled_at: null }], ...extra })

describe("withdrawalPeriodEndFor — 14 dnů od převzetí, pražský kalendář, § 607 OZ", () => {
  it("14. den po dni převzetí do 23:59:59 pražského času (letní čas)", () => {
    // čtvrtek 1. 10. → čtvrtek 15. 10.; Praha UTC+2
    expect(withdrawalPeriodEndFor(new Date("2026-10-01T10:00:00Z")).toISOString()).toBe(
      "2026-10-15T21:59:59.999Z"
    )
  })

  it("den převzetí je pražský — převzetí po půlnoci SELČ je už další den", () => {
    // 1. 10. 22:30 UTC = 2. 10. 00:30 v Praze → konec pátek 16. 10.
    expect(withdrawalPeriodEndFor(new Date("2026-10-01T22:30:00Z")).toISOString()).toBe(
      "2026-10-16T21:59:59.999Z"
    )
  })

  it("konec v sobotu → pondělí", () => {
    // sobota 3. 10. + 14 = sobota 17. 10. → pondělí 19. 10.
    expect(withdrawalPeriodEndFor(new Date("2026-10-03T09:00:00Z")).toISOString()).toBe(
      "2026-10-19T21:59:59.999Z"
    )
  })

  it("konec na státní svátek 28. 10. → 29. 10. (už zimní čas)", () => {
    expect(withdrawalPeriodEndFor(new Date("2026-10-14T09:00:00Z")).toISOString()).toBe(
      "2026-10-29T22:59:59.999Z"
    )
  })

  it("Velikonoce 2026: Velký pátek 3. 4. + víkend + Velikonoční pondělí → úterý 7. 4.", () => {
    expect(easterSunday(2026)).toEqual({ year: 2026, month: 4, day: 5 })
    expect(isCzechPublicHoliday({ year: 2026, month: 4, day: 3 })).toBe(true)
    expect(isCzechPublicHoliday({ year: 2026, month: 4, day: 6 })).toBe(true)
    expect(isCzechPublicHoliday({ year: 2026, month: 4, day: 7 })).toBe(false)
    expect(withdrawalPeriodEndFor(new Date("2026-03-20T09:00:00Z")).toISOString()).toBe(
      "2026-04-07T21:59:59.999Z"
    )
  })

  it("Velikonoční neděle i v jiných letech", () => {
    expect(easterSunday(2027)).toEqual({ year: 2027, month: 3, day: 28 })
    expect(easterSunday(2025)).toEqual({ year: 2025, month: 4, day: 20 })
  })
})

describe("withdrawalTimingFor — kdy zákazník zboží převzal", () => {
  it("neodesláno → lhůta neběží", () => {
    const timing = withdrawalTimingFor(order())
    expect(timing.basis).toBe("not_shipped")
    expect(timing.deadline).toBeNull()
    expect(takeoverTextFor(timing)).toMatch(/ještě neodeslali/)
  })

  it("fulfillment.delivered_at = převzetí", () => {
    const timing = withdrawalTimingFor(
      order({
        fulfillments: [
          { shipped_at: SHIPPED, delivered_at: "2026-10-03T12:00:00Z", canceled_at: null },
        ],
      })
    )
    expect(timing.basis).toBe("delivered")
    expect(timing.takeover_at?.toISOString()).toBe("2026-10-03T12:00:00.000Z")
    // sobota 3. 10. + 14 = sobota 17. 10. → pondělí 19. 10.
    expect(timing.deadline?.toISOString()).toBe("2026-10-19T21:59:59.999Z")
    expect(takeoverTextFor(timing)).toBe("3. 10. 2026")
  })

  it("sledování ČP: delivered_at z řádku parcel_tracking", () => {
    const timing = withdrawalTimingFor(
      shipped({ parcel_tracking: { delivered_at: "2026-10-05T09:00:00Z", done: true } })
    )
    expect(timing.basis).toBe("delivered")
    expect(timing.deadline?.toISOString()).toBe("2026-10-19T21:59:59.999Z")
  })

  it("sledování běží, doručeno ještě není → zásilka na cestě, lhůta neběží", () => {
    const timing = withdrawalTimingFor(
      shipped({ parcel_tracking: { delivered_at: null, done: false } })
    )
    expect(timing.basis).toBe("in_transit")
    expect(timing.deadline).toBeNull()
    expect(takeoverTextFor(timing)).toMatch(/na cestě/)
  })

  it("sledování skončilo bez doručení (vrácená / vzdaná) → odhad", () => {
    const timing = withdrawalTimingFor(
      shipped({ parcel_tracking: { delivered_at: null, done: true } })
    )
    expect(timing.basis).toBe("estimated")
  })

  it("osobní odběr: převzetí = vyzvednutí (shipped_at)", () => {
    const timing = withdrawalTimingFor(
      shipped({ shipping_methods: [{ data: { personal_pickup: true } }] })
    )
    expect(timing.basis).toBe("pickup")
    expect(timing.takeover_at?.toISOString()).toBe("2026-10-01T10:00:00.000Z")
    expect(timing.deadline?.toISOString()).toBe("2026-10-15T21:59:59.999Z")
    expect(takeoverTextFor(timing)).toBe("1. 10. 2026 (osobní odběr)")
  })

  it("jen odesláno, převzetí neznámé → odeslání + 7 dnů rezerva (konec 21. den)", () => {
    const timing = withdrawalTimingFor(shipped())
    expect(timing.basis).toBe("estimated")
    expect(timing.takeover_at?.toISOString()).toBe("2026-10-08T10:00:00.000Z")
    // 8. 10. + 14 = čtvrtek 22. 10.
    expect(timing.deadline?.toISOString()).toBe("2026-10-22T21:59:59.999Z")
    expect(takeoverTextFor(timing)).toMatch(/nemáme potvrzené — zásilka odešla 1\. 10\. 2026/)
  })

  it("zrušená zásilka se nepočítá; u více zásilek platí poslední převzetí", () => {
    expect(
      withdrawalTimingFor(
        order({ fulfillments: [{ shipped_at: SHIPPED, canceled_at: "2026-10-02T10:00:00Z" }] })
      ).basis
    ).toBe("not_shipped")

    const twoParcels = withdrawalTimingFor(
      order({
        fulfillments: [
          { shipped_at: SHIPPED, delivered_at: "2026-10-02T10:00:00Z" },
          { shipped_at: "2026-10-05T10:00:00Z", delivered_at: "2026-10-06T10:00:00Z" },
        ],
      })
    )
    expect(twoParcels.takeover_at?.toISOString()).toBe("2026-10-06T10:00:00.000Z")
  })
})

describe("isMadeToOrderItem — zakázka i podle kategorie", () => {
  it("značka na řádku, na produktu, nebo kategorie Zakázková výroba", () => {
    expect(isMadeToOrderItem({ metadata: { made_to_order: { brief: "č. 229" } } })).toBe(true)
    expect(isMadeToOrderItem({ product: { metadata: { made_to_order: true } } })).toBe(true)
    expect(
      isMadeToOrderItem({ product: { categories: [{ handle: "zakazkova-vyroba" }] } })
    ).toBe(true)
    expect(
      isMadeToOrderItem({ product: { categories: [{ handle: "zahrada" }], metadata: {} } })
    ).toBe(false)
    // „na zakázku" jen v názvu zakázkou není
    expect(isMadeToOrderItem({ title: "Domovní číslo NA ZAKÁZKU" } as any)).toBe(false)
  })
})

const commissionItem = {
  id: "li_cislo",
  title: "Domovní číslo",
  quantity: 1,
  total: 1200,
  metadata: {},
  product: { categories: [{ handle: "zakazkova-vyroba" }] },
}
const packagingItem = {
  id: "li_balne",
  title: "Balné",
  quantity: 1,
  total: 30,
  metadata: { packaging_fee: true },
}

describe("resolveWithdrawalItems — výběr zboží, zakázka se vyjímá na serveru", () => {
  it("bez výběru: všechno běžné zboží = celá smlouva", () => {
    const verdict = resolveWithdrawalItems(order(), [])
    expect(verdict.ok).toBe(true)
    if (verdict.ok) {
      expect(verdict.whole).toBe(true)
      expect(verdict.line_items.map((item) => [item.line_item_id, item.quantity])).toEqual([
        ["li_misa", 1],
        ["li_hrnek", 2],
      ])
      expect(verdict.excluded).toEqual([])
    }
  })

  it("smíšená objednávka: zakázka (kategorie) vyjmutá, balné se nepočítá", () => {
    const mixed = order({ items: [...order().items, commissionItem, packagingItem] })
    const verdict = resolveWithdrawalItems(mixed, null)
    expect(verdict.ok).toBe(true)
    if (verdict.ok) {
      expect(verdict.whole).toBe(false)
      expect(verdict.line_items.map((item) => item.line_item_id)).toEqual(["li_misa", "li_hrnek"])
      expect(verdict.excluded.map((item) => item.line_item_id)).toEqual(["li_cislo"])
    }
    const view = withdrawalItemsOf(mixed)
    expect(view.map((item) => item.id)).toEqual(["li_misa", "li_hrnek", "li_cislo"])
    expect(view.find((item) => item.id === "li_cislo")?.withdrawable).toBe(false)
    expect(view.find((item) => item.id === "li_cislo")?.block_reason).toMatch(/§ 1837 písm\. d\)/)
  })

  it("zakázku poslanou prohlížečem server tiše vyjme; jen zakázka → odmítnout", () => {
    const mixed = order({ items: [...order().items, commissionItem] })
    const verdict = resolveWithdrawalItems(mixed, [
      { id: "li_misa", quantity: 1 },
      { id: "li_cislo", quantity: 1 },
    ])
    expect(verdict.ok).toBe(true)
    if (verdict.ok) {
      expect(verdict.line_items.map((item) => item.line_item_id)).toEqual(["li_misa"])
    }
    const onlyCommission = resolveWithdrawalItems(mixed, [{ id: "li_cislo", quantity: 1 }])
    expect(onlyCommission).toEqual({ ok: false, message: WITHDRAWAL_NOTHING_WITHDRAWABLE })
  })

  it("částečné odstoupení (méně kusů) není celá smlouva; cizí id a moc kusů se odmítnou", () => {
    const partial = resolveWithdrawalItems(order(), [
      { id: "li_misa", quantity: 1 },
      { id: "li_hrnek", quantity: 1 },
    ])
    expect(partial.ok && partial.whole).toBe(false)
    if (partial.ok) {
      expect(partial.line_items.find((item) => item.line_item_id === "li_hrnek")?.total).toBe(390)
    }
    expect(resolveWithdrawalItems(order(), [{ id: "li_cizi", quantity: 1 }])).toEqual({
      ok: false,
      message: ITEMS_NOT_IN_ORDER,
    })
    expect(resolveWithdrawalItems(order(), [{ id: "li_hrnek", quantity: 3 }])).toEqual({
      ok: false,
      message: ITEMS_QUANTITY_TOO_HIGH,
    })
  })
})

describe("withdrawalGate / checkClaimRules — odstoupení online", () => {
  const input = (kind: ClaimIntakeInput["kind"], extra: Partial<ClaimIntakeInput> = {}) =>
    ({ kind, reason: "", ...extra }) as ClaimIntakeInput

  it("otevřená reklamace odstoupení NEblokuje (§ 1830a), otevřené odstoupení ano", () => {
    expect(blocksWithdrawal({ status: "pending", kind: "reklamace" })).toBe(false)
    expect(blocksWithdrawal({ status: "approved", kind: "uprava" })).toBe(false)
    expect(blocksWithdrawal({ status: "pending", kind: "odstoupeni" })).toBe(true)
    expect(blocksWithdrawal({ status: "received", kind: "vraceni" })).toBe(true)
    expect(blocksWithdrawal({ status: "pending", kind: null })).toBe(true)
    expect(blocksWithdrawal({ status: "resolved", kind: "odstoupeni" })).toBe(false)

    const openClaim = [{ status: "pending", kind: "reklamace" }]
    expect(withdrawalGate(order(), openClaim).can_withdraw).toBe(true)
    expect(checkClaimRules(order(), openClaim, input("odstoupeni")).ok).toBe(true)
    // Vrácení zboží dál čeká na uzavření reklamace (jedna otevřená žádost).
    expect(
      checkClaimRules(order(), openClaim, input("vraceni", { line_items: [{ id: "li_misa", quantity: 1 }] })).ok
    ).toBe(false)

    const openWithdrawal = [{ status: "pending", kind: "odstoupeni" }]
    const gate = withdrawalGate(order(), openWithdrawal)
    expect(gate.can_withdraw).toBe(false)
    expect(gate.withdraw_block_code).toBe("open_withdrawal")
    expect(checkClaimRules(order(), openWithdrawal, input("odstoupeni")).ok).toBe(false)
  })

  it("čistá zakázka podle kategorie: § 1837 písm. d); zrušená objednávka: nejde", () => {
    const pure = order({ items: [commissionItem, packagingItem] })
    const gate = withdrawalGate(pure, [])
    expect(gate.can_withdraw).toBe(false)
    expect(gate.withdraw_block_code).toBe("made_to_order")
    expect(checkClaimRules(pure, [], input("odstoupeni")).ok).toBe(false)

    const cancelled = order({ status: "canceled" })
    expect(withdrawalGate(cancelled, []).withdraw_block_code).toBe("cancelled")
    expect(checkClaimRules(cancelled, [], input("odstoupeni")).ok).toBe(false)
  })

  it("lhůta od převzetí: sledované doručení později než odhad prodlouží lhůtu", () => {
    // odesláno 1. 10., doručeno 12. 10. → konec 26. 10. (odhad by končil 22. 10.)
    const tracked = shipped({ parcel_tracking: { delivered_at: "2026-10-12T10:00:00Z", done: true } })
    const lateForEstimate = new Date("2026-10-24T10:00:00Z")
    expect(checkClaimRules(tracked, [], input("odstoupeni"), lateForEstimate).ok).toBe(true)
    expect(checkClaimRules(shipped(), [], input("odstoupeni"), lateForEstimate).ok).toBe(false)
    expect(
      withdrawalGate(tracked, [], new Date("2026-10-27T10:00:00Z")).withdraw_block_code
    ).toBe("expired")
  })

  it("vrácení zboží zakázkovou položku odmítne s § 1837", () => {
    const mixed = order({ items: [...order().items, commissionItem] })
    const verdict = checkClaimRules(
      mixed,
      [],
      input("vraceni", { line_items: [{ id: "li_cislo", quantity: 1 }] })
    )
    expect(verdict).toEqual({ ok: false, message: ITEMS_MADE_TO_ORDER_RETURN })
  })

  it("odstoupení jen se zakázkou ve výběru (smíšená objednávka) → česká hláška", () => {
    const mixed = order({ items: [...order().items, commissionItem] })
    const verdict = checkClaimRules(
      mixed,
      [],
      input("odstoupeni", { line_items: [{ id: "li_cislo", quantity: 1 }] })
    )
    expect(verdict).toEqual({ ok: false, message: WITHDRAWAL_NOTHING_WITHDRAWABLE })
  })
})

describe("texty do potvrzení — pražský čas, maskovaný účet, adresa", () => {
  it("datum a čas odeslání v Europe/Prague", () => {
    expect(formatPragueDateTime("2026-10-15T12:32:00Z")).toBe("15. 10. 2026 v 14:32")
    expect(formatPragueDateTime("2026-12-01T09:05:00Z")).toBe("1. 12. 2026 v 10:05")
    expect(formatPragueDate("2026-10-31T23:30:00Z")).toBe("1. 11. 2026")
    expect(formatPragueDateTime(null)).toBe("")
  })

  it("účet zamaskovaný, IBAN zkrácený; způsob vrácení slovy", () => {
    expect(maskRefundAccount("19-2000145399/0800")).toBe("••••5399/0800")
    expect(maskRefundAccount("SK31 1200 0000 1987 4263 7541")).toBe("SK•• •••• 7541")
    expect(maskRefundAccount("")).toBeNull()
    expect(refundMethodTextFor("account", "19-2000145399/0800")).toContain("••••5399/0800")
    expect(refundMethodTextFor("account", "19-2000145399/0800")).not.toContain("2000145399")
    expect(refundMethodTextFor("card")).toMatch(/Stejným platebním prostředkem/)
    // ComGate bere i převod a Apple/Google Pay — slib „na kartu" by nebyl pravda.
    expect(refundMethodTextFor("card")).toContain("vrátím je stejnou cestou (přes ComGate)")
    expect(refundMethodTextFor("card")).not.toMatch(/na kartu/)
    expect(refundMethodTextFor("account")).not.toMatch(/kartou/)
    expect(refundMethodTextFor("none")).toMatch(/není co vracet/)
  })

  it("adresa pro vrácení: výchozí značka obchodu → jméno prodávající; vlastní adresa zůstane", () => {
    expect(withdrawalReturnAddress("Keramická zahrada\nPutim 229\n397 01 Písek")).toBe(
      "Lucie Polanská, Putim 229, 397 01 Písek"
    )
    expect(withdrawalReturnAddress("")).toBe("Lucie Polanská, Putim 229, 397 01 Písek")
    expect(withdrawalReturnAddress("Lucie Polanská\nJiná 1\n397 01 Písek")).toBe(
      "Lucie Polanská, Jiná 1, 397 01 Písek"
    )
  })
})

describe("takeoverSnapshotFor — převzetí ukládané k žádosti", () => {
  const delivered = () =>
    order({
      fulfillments: [
        { shipped_at: SHIPPED, delivered_at: "2026-10-03T12:00:00Z", canceled_at: null },
      ],
    })

  it("reklamace u doručené objednávky ukládá převzetí stejně jako odstoupení", () => {
    const complaint = takeoverSnapshotFor("reklamace", delivered())
    expect(complaint?.toISOString()).toBe("2026-10-03T12:00:00.000Z")
    const withdrawal = takeoverSnapshotFor("odstoupeni", delivered(), withdrawalTimingFor(delivered()))
    expect(withdrawal?.toISOString()).toBe(complaint?.toISOString())
  })

  it("reklamace: sledování ČP i odhad z odeslání; neodesláno / na cestě = null", () => {
    expect(
      takeoverSnapshotFor(
        "reklamace",
        shipped({ parcel_tracking: { delivered_at: "2026-10-05T09:00:00Z", done: true } })
      )?.toISOString()
    ).toBe("2026-10-05T09:00:00.000Z")
    expect(takeoverSnapshotFor("reklamace", shipped())).toBeInstanceOf(Date)
    expect(takeoverSnapshotFor("reklamace", order())).toBeNull()
    expect(
      takeoverSnapshotFor("reklamace", shipped({ parcel_tracking: { delivered_at: null, done: false } }))
    ).toBeNull()
  })

  it("žádost bez druhu převzetí neukládá", () => {
    expect(takeoverSnapshotFor(null, delivered())).toBeNull()
  })
})
