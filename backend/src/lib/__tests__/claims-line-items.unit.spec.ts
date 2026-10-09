import {
  claimItemsText,
  lineItemsText,
  lineItemsTotal,
  orderItemsForClaims,
  perUnitOf,
  resolveClaimLineItems,
  suggestedRefundAmount,
} from "../claims/line-items"
import {
  carrierDamageDescription,
  checkClaimRules,
  type ClaimIntakeInput,
} from "../claims/intake"
import { CP_CLAIM_FORM_URL } from "../claims/constants"

/**
 * Položky žádosti (docs/reklamace-a-zruseni.md §11.1–11.5): která položka smí
 * do žádosti, kolik stojí po slevě a s DPH, kolik se má vrátit, a jak se to
 * vypíše. Čistá aritmetika — bez kontejneru.
 */

// Řádky tak, jak je vrací `query.graph` s `items.*` + `total`: množství na
// detailu (ne na řádku), částky občas jako BigNumber `{ value }`.
const order = {
  id: "order_1",
  display_id: 42,
  email: "a@b.cz",
  currency_code: "czk",
  items: [
    {
      id: "li_misa",
      title: "Zahradní mísa z pálené hlíny",
      product_title: "Zahradní mísa z pálené hlíny",
      variant_title: "Ø 32 cm",
      thumbnail: "https://cdn/misa.jpg",
      unit_price: 1450,
      // 2 ks × 1 450 = 2 900, sleva 10 % → 2 610 (po slevě, s DPH)
      total: { value: "2610", precision: 20 },
      detail: { quantity: 2, raw_quantity: { value: "2" } },
      metadata: {},
    },
    {
      id: "li_hrnek",
      title: "Hrnek",
      product_title: "Keramický hrnek",
      variant_title: null,
      thumbnail: null,
      unit_price: 390,
      total: 390,
      detail: { quantity: 1 },
      metadata: {},
    },
    {
      id: "li_bez_total",
      title: "Talíř",
      product_title: "Keramický talíř",
      variant_title: "bílý",
      unit_price: { value: "520" },
      // dotaz bez `total` → řádek ho nemá → záloha `unit_price`
      quantity: 3,
      metadata: {},
    },
  ],
  fulfillments: [],
}

// Normalizace Intl výstupu: cs-CZ používá nezlomitelné mezery (U+00A0).
const plain = (value: string | null) => (value ?? "").replace(/ /g, " ")

describe("perUnitOf / orderItemsForClaims — cena za kus po slevě, s DPH", () => {
  it("dělí item.total množstvím z detailu (BigNumber tvary)", () => {
    expect(perUnitOf(order.items[0] as any)).toBe(1305)
    expect(perUnitOf(order.items[1] as any)).toBe(390)
  })

  it("bez total spadne na unit_price; přítomná nula je pravda (100% sleva)", () => {
    expect(perUnitOf(order.items[2] as any)).toBe(520)
    expect(perUnitOf({ unit_price: 500, total: 0, quantity: 1 })).toBe(0)
    expect(perUnitOf({ unit_price: undefined, quantity: 1 })).toBe(0)
  })

  it("order_items pro formulář: id, název produktu, varianta, množství, ceny", () => {
    const items = orderItemsForClaims(order as any)
    expect(items).toEqual([
      {
        id: "li_misa",
        title: "Zahradní mísa z pálené hlíny",
        variant_title: "Ø 32 cm",
        thumbnail: "https://cdn/misa.jpg",
        quantity: 2,
        unit_price: 1305,
        total: 2610,
      },
      {
        id: "li_hrnek",
        title: "Keramický hrnek",
        variant_title: null,
        thumbnail: null,
        quantity: 1,
        unit_price: 390,
        total: 390,
      },
      {
        id: "li_bez_total",
        title: "Keramický talíř",
        variant_title: "bílý",
        thumbnail: null,
        quantity: 3,
        unit_price: 520,
        total: 1560,
      },
    ])
  })
})

describe("resolveClaimLineItems — pravidla výběru (§11.1)", () => {
  it("reklamace: s výběrem položek aspoň jedna; bez výběru (záložní routa) projde", () => {
    expect(resolveClaimLineItems(order as any, "reklamace", []).ok).toBe(false)
    expect(resolveClaimLineItems(order as any, "reklamace", undefined)).toEqual({
      ok: true,
      line_items: null,
    })
    expect(resolveClaimLineItems(order as any, "reklamace", null)).toEqual({
      ok: true,
      line_items: null,
    })
  })

  it("vrácení: položky volitelné (prázdné = vše → null)", () => {
    expect(resolveClaimLineItems(order as any, "vraceni", [])).toEqual({
      ok: true,
      line_items: null,
    })
  })

  it("odstoupení: výběr se ignoruje — celá smlouva", () => {
    expect(
      resolveClaimLineItems(order as any, "odstoupeni", [{ id: "li_misa", quantity: 1 }])
    ).toEqual({ ok: true, line_items: null })
  })

  it("id musí patřit objednávce, množství celé a nejvýš objednané", () => {
    expect(
      resolveClaimLineItems(order as any, "reklamace", [{ id: "li_cizi", quantity: 1 }]).ok
    ).toBe(false)
    expect(
      resolveClaimLineItems(order as any, "reklamace", [{ id: "li_misa", quantity: 3 }]).ok
    ).toBe(false)
    expect(
      resolveClaimLineItems(order as any, "reklamace", [{ id: "li_misa", quantity: 0 }]).ok
    ).toBe(false)
    expect(
      resolveClaimLineItems(order as any, "reklamace", [{ id: "li_misa", quantity: 1.5 }]).ok
    ).toBe(false)
    // Duplicitní id se sčítá — 1 + 1 = 2 ještě projde, 1 + 2 už ne.
    expect(
      resolveClaimLineItems(order as any, "reklamace", [
        { id: "li_misa", quantity: 1 },
        { id: "li_misa", quantity: 1 },
      ]).ok
    ).toBe(true)
    expect(
      resolveClaimLineItems(order as any, "reklamace", [
        { id: "li_misa", quantity: 1 },
        { id: "li_misa", quantity: 2 },
      ]).ok
    ).toBe(false)
  })

  it("snapshot: název, varianta, náhled, množství, jednotková i celková cena, měna", () => {
    const verdict = resolveClaimLineItems(order as any, "reklamace", [
      { id: "li_misa", quantity: 1 },
      { id: "li_hrnek", quantity: 1 },
    ])
    expect(verdict.ok).toBe(true)
    if (verdict.ok) {
      expect(verdict.line_items).toEqual([
        {
          line_item_id: "li_misa",
          title: "Zahradní mísa z pálené hlíny",
          variant_title: "Ø 32 cm",
          thumbnail: "https://cdn/misa.jpg",
          quantity: 1,
          unit_price: 1305,
          total: 1305,
          currency_code: "czk",
        },
        {
          line_item_id: "li_hrnek",
          title: "Keramický hrnek",
          variant_title: null,
          thumbnail: null,
          quantity: 1,
          unit_price: 390,
          total: 390,
          currency_code: "czk",
        },
      ])
    }
  })
})

describe("checkClaimRules — položky a poškození přepravou v intake", () => {
  const input = (kind: ClaimIntakeInput["kind"], extra: Partial<ClaimIntakeInput> = {}) =>
    ({ kind, reason: "důvod", requested_resolution: "repair", ...extra }) as ClaimIntakeInput

  it("reklamace z tokenové routy (pole položek) bez položky → 400", () => {
    const verdict = checkClaimRules(order as any, [], input("reklamace", { line_items: [] }))
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) expect(verdict.message).toMatch(/aspoň jednu položku/)
  })

  it("záložní routa bez výběru položek u reklamace projde dál", () => {
    expect(checkClaimRules(order as any, [], input("reklamace")).ok).toBe(true)
  })

  it("cizí položka nebo moc kusů → 400 s českým důvodem", () => {
    const foreign = checkClaimRules(
      order as any,
      [],
      input("reklamace", { line_items: [{ id: "li_cizi", quantity: 1 }] })
    )
    expect(foreign.ok).toBe(false)
    if (!foreign.ok) expect(foreign.message).toMatch(/nepatří/)
    const tooMany = checkClaimRules(
      order as any,
      [],
      input("vraceni", { line_items: [{ id: "li_hrnek", quantity: 2 }] })
    )
    expect(tooMany.ok).toBe(false)
    if (!tooMany.ok) expect(tooMany.message).toMatch(/vyšší počet kusů/)
  })

  it("poškozeno přepravou vyžaduje aspoň jednu fotku", () => {
    const base = {
      line_items: [{ id: "li_misa", quantity: 1 }],
      damage_cause: "carrier",
    }
    const noPhoto = checkClaimRules(order as any, [], input("reklamace", base))
    expect(noPhoto.ok).toBe(false)
    if (!noPhoto.ok) expect(noPhoto.message).toMatch(/fotku/)
    expect(
      checkClaimRules(
        order as any,
        [],
        input("reklamace", {
          ...base,
          photos: [{ filename: "a.jpg", mime_type: "image/jpeg", data: "AAAA" }],
        })
      ).ok
    ).toBe(true)
    // Bez příčiny fotky povinné nejsou.
    expect(
      checkClaimRules(
        order as any,
        [],
        input("reklamace", { line_items: [{ id: "li_misa", quantity: 1 }] })
      ).ok
    ).toBe(true)
  })
})

describe("suggestedRefundAmount — výchozí částka (§11.2)", () => {
  const lineItems = [
    { line_item_id: "li_misa", title: "Mísa", quantity: 1, unit_price: 1305, total: 1305, currency_code: "czk" },
    { line_item_id: "li_hrnek", title: "Hrnek", quantity: 1, unit_price: 390, total: 390, currency_code: "czk" },
  ]

  it("s položkami min(zbývá, Σ položek)", () => {
    expect(lineItemsTotal(lineItems)).toBe(1695)
    expect(suggestedRefundAmount(3000, lineItems)).toBe(1695)
    expect(suggestedRefundAmount(1000, lineItems)).toBe(1000)
    expect(suggestedRefundAmount(0, lineItems)).toBe(0)
  })

  it("bez položek (null, [], nesmysl) celé zbývá; nikdy záporné", () => {
    expect(suggestedRefundAmount(1250, null)).toBe(1250)
    expect(suggestedRefundAmount(1250, [])).toBe(1250)
    expect(suggestedRefundAmount(1250, "text")).toBe(1250)
    expect(suggestedRefundAmount(-5, null)).toBe(0)
  })

  it("položky bez ceny (součet 0) nepřebijí zbývá", () => {
    expect(
      suggestedRefundAmount(800, [{ line_item_id: "x", title: "X", quantity: 1, total: 0 }])
    ).toBe(800)
  })
})

describe("lineItemsText — „název · varianta · N ks · částka“ (§11.5)", () => {
  it("řádek za položku, varianta jen když je, částka česky", () => {
    const text = lineItemsText([
      {
        line_item_id: "li_misa",
        title: "Zahradní mísa z pálené hlíny",
        variant_title: "Ø 32 cm",
        quantity: 2,
        unit_price: 1305,
        total: 2610,
        currency_code: "czk",
      },
      {
        line_item_id: "li_hrnek",
        title: "Keramický hrnek",
        variant_title: null,
        quantity: 1,
        unit_price: 390,
        total: 390,
        currency_code: "czk",
      },
    ])
    expect(plain(text).split("\n")).toEqual([
      "Zahradní mísa z pálené hlíny · Ø 32 cm · 2 ks · 2 610 Kč",
      "Keramický hrnek · 1 ks · 390 Kč",
    ])
  })

  it("haléře jen když jsou", () => {
    expect(
      plain(
        lineItemsText([
          { line_item_id: "a", title: "A", quantity: 1, unit_price: 333.33, total: 333.33, currency_code: "czk" },
        ])
      )
    ).toBe("A · 1 ks · 333,33 Kč")
  })

  it("bez položek null → claimItemsText spadne na starý text zákazníka", () => {
    expect(lineItemsText(null)).toBeNull()
    expect(lineItemsText([])).toBeNull()
    expect(claimItemsText({ line_items: null, items: "  modrý hrnek  " })).toBe("modrý hrnek")
    expect(claimItemsText({ line_items: [], items: null })).toBeNull()
    expect(
      plain(
        claimItemsText({
          line_items: [{ line_item_id: "a", title: "A", quantity: 1, total: 10, currency_code: "czk" }],
          items: "ignorovaný text",
        })
      )
    ).toBe("A · 1 ks · 10 Kč")
  })
})

describe("carrierDamageDescription — e-mail majitelce (§11.3)", () => {
  it("nese číslo zásilky, odkaz na formulář ČP, lhůtu, položky a fotky", () => {
    const text = carrierDamageDescription({
      parcelCode: "DR1234567890X",
      itemsText: "Mísa · 1 ks · 1 305 Kč",
      photoUrls: ["https://cdn/1.jpg"],
      reason: "Rozbitá mísa, krabice promáčklá",
    })
    expect(text).toContain("DR1234567890X")
    expect(text).toContain(CP_CLAIM_FORM_URL)
    expect(text).toMatch(/2 pracovních dnů/)
    expect(text).toContain("Mísa · 1 ks · 1 305 Kč")
    expect(text).toContain("https://cdn/1.jpg")
    expect(text).toContain("Rozbitá mísa")
  })

  it("bez čísla zásilky to řekne, místo aby vypsalo prázdno", () => {
    const text = carrierDamageDescription({
      parcelCode: null,
      itemsText: null,
      photoUrls: [],
      reason: "x",
    })
    expect(text).toMatch(/nepodařilo dohledat/)
    expect(text).toMatch(/Fotky se nepodařilo uložit/)
  })
})
