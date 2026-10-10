import { buildCreditNoteItems } from "../credit-note"

/**
 * Položky dobropisu z návrhu iDokladu (docs/reklamace-a-zruseni.md §13.3):
 * plný = návrh beze změny, částečný = spárované a zkrácené položky, jinak
 * jeden poctivý řádek na vrácenou částku.
 */

const line = (name: string, amount: number, unitPrice: number) => ({
  Name: name,
  Amount: amount,
  UnitPrice: unitPrice,
  PriceType: 0,
  VatRateType: 2,
  IsTaxMovement: false,
  DiscountPercentage: 0,
  ItemType: 0,
})

const draft = (items: unknown[]) => ({
  CurrencyId: 1,
  DateOfIssue: "2026-10-10",
  NumericSequenceId: 5,
  Items: items,
})

const value = (items: Array<Record<string, unknown>>) =>
  Math.round(
    items.reduce((sum, item) => sum + Math.abs(Number(item.Amount)) * Number(item.UnitPrice), 0) * 100
  ) / 100

describe("buildCreditNoteItems", () => {
  const invoice = [
    line("Zahradní mísa", 2, 500),
    line("Hrnek", 1, 390),
    line("Poštovné — Zásilkovna", 1, 99),
    line("Balné", 1, 30),
  ]

  it("plné vrácení = návrh beze změny", () => {
    const result = buildCreditNoteItems(draft(invoice), {
      amount: 1519,
      lines: [],
      orderDisplayId: "42",
      vatRateTypeFallback: 2,
    })
    expect(result.strategy).toBe("full")
    expect(result.items).toEqual(invoice)
  })

  it("částečné: položka zkrácená na vrácené kusy, poštovné + balné celé, součet sedí", () => {
    const result = buildCreditNoteItems(draft(invoice), {
      amount: 629,
      lines: [
        { type: "item", title: "Zahradní mísa", quantity: 1, amount: 500 },
        { type: "shipping", amount: 129 },
      ],
      orderDisplayId: "42",
      vatRateTypeFallback: 2,
    })
    expect(result.strategy).toBe("matched")
    expect(result.items.map((item) => [item.Name, item.Amount])).toEqual([
      ["Zahradní mísa", 1],
      ["Poštovné — Zásilkovna", 1],
      ["Balné", 1],
    ])
    expect(value(result.items)).toBe(629)
  })

  it("komponenta a ruční částka = nové řádky se sazbou z návrhu", () => {
    const result = buildCreditNoteItems(draft(invoice), {
      amount: 350,
      lines: [
        { type: "component", title: "Miska A", quantity: 1, amount: 300 },
        { type: "custom", title: "Náhrada", amount: 50 },
      ],
      orderDisplayId: "42",
      vatRateTypeFallback: 1,
    })
    expect(result.strategy).toBe("matched")
    expect(result.items[0]).toMatchObject({ Name: "Vrácení — Miska A", Amount: 1, UnitPrice: 300, VatRateType: 2 })
    expect(result.items[1]).toMatchObject({ Name: "Vrácení — Náhrada", Amount: 1, UnitPrice: 50 })
    expect(value(result.items)).toBe(350)
  })

  it("nesedí název, cena za kus nebo kusy → jeden řádek „Vrácení — objednávka“", () => {
    const cases = [
      [{ type: "item", title: "Neznámá", quantity: 1, amount: 500 }],
      // Zakázkový řádek seříznutý zaplaceným: 1 ks za 400 místo 500.
      [{ type: "item", title: "Zahradní mísa", quantity: 1, amount: 400 }],
      [{ type: "item", title: "Zahradní mísa", quantity: 3, amount: 1500 }],
    ]
    for (const lines of cases) {
      const amount = lines[0].amount
      const result = buildCreditNoteItems(draft(invoice), {
        amount,
        lines: lines as any,
        orderDisplayId: "42",
        vatRateTypeFallback: 2,
      })
      expect(result.strategy).toBe("single")
      expect(result.items).toHaveLength(1)
      expect(result.items[0]).toMatchObject({
        Name: "Vrácení — objednávka #42",
        Amount: 1,
        UnitPrice: amount,
        VatRateType: 2,
        PriceType: 0,
      })
    }
  })

  it("bez košíku (záloha, staré tělo) jeden řádek; bez položek v návrhu sazba z fallbacku", () => {
    const noLines = buildCreditNoteItems(draft(invoice), {
      amount: 250,
      lines: null,
      orderDisplayId: "42",
      vatRateTypeFallback: 2,
    })
    expect(noLines.strategy).toBe("single")
    expect(noLines.items[0].UnitPrice).toBe(250)

    const noDraftItems = buildCreditNoteItems({ CurrencyId: 1 }, {
      amount: 250,
      lines: [{ type: "custom", title: "x", amount: 250 }],
      orderDisplayId: "7",
      vatRateTypeFallback: 1,
    })
    expect(noDraftItems.items[0]).toMatchObject({ VatRateType: 1, UnitPrice: 250, Amount: 1 })
  })

  it("záporná množství v návrhu → nové i zkrácené řádky zůstávají záporné", () => {
    const negative = [line("Zahradní mísa", -2, 500), line("Poštovné", -1, 129)]
    const result = buildCreditNoteItems(draft(negative), {
      amount: 550,
      lines: [
        { type: "item", title: "Zahradní mísa", quantity: 1, amount: 500 },
        { type: "custom", title: "Sleva", amount: 50 },
      ],
      orderDisplayId: "42",
      vatRateTypeFallback: 2,
    })
    expect(result.strategy).toBe("matched")
    expect(result.items[0].Amount).toBe(-1)
    expect(result.items[1].Amount).toBe(-1)
    expect(value(result.items)).toBe(550)
    const full = buildCreditNoteItems(draft(negative), {
      amount: 1129,
      lines: [],
      orderDisplayId: "42",
      vatRateTypeFallback: 2,
    })
    expect(full.strategy).toBe("full")
  })
})
