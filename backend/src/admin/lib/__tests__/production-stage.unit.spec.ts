import { leastAdvancedStage, productionStepPlacement } from "../production-stage"

/**
 * Kde se ovládá postup výroby — a tím i odkud zákazníkovi odejde e-mail
 * o zahájení a průběhu jedné konkrétní zakázky (3. 11. 2026).
 *
 * Pravidlo se čte na dvou místech (Denní práce na detailu objednávky a karta
 * „Výroba na zakázku"), a kdyby se rozešla, tlačítko by bylo dvakrát, nebo
 * vůbec — proto je tady a ne dvakrát v JSX.
 */
describe("kde je další krok výroby", () => {
  it("jediná zakázka a nic jiného: nahoře v Denní práci", () => {
    expect(
      productionStepPlacement({ pureCommission: true, commissionCount: 1 })
    ).toBe("daily-work")
  })

  it("jediná zakázka a k ní běžné zboží: v kartě zakázky", () => {
    expect(
      productionStepPlacement({ pureCommission: false, commissionCount: 1 })
    ).toBe("commission-card")
  })

  it("víc zakázek: v kartě každé zakázky, i když jiné zboží v objednávce není", () => {
    expect(
      productionStepPlacement({ pureCommission: true, commissionCount: 2 })
    ).toBe("commission-card")
    expect(
      productionStepPlacement({ pureCommission: false, commissionCount: 3 })
    ).toBe("commission-card")
  })

  it("objednávka bez zakázky nikde nic nenabízí (krok si o ni neřekne)", () => {
    expect(
      productionStepPlacement({ pureCommission: true, commissionCount: 0 })
    ).toBe("daily-work")
  })
})

describe("souhrnná fáze nad víc zakázkami", () => {
  it("ukazuje tu nejméně rozpracovanou — co ještě čeká", () => {
    expect(leastAdvancedStage(["in_production", "specification_pending"])).toBe(
      "specification_pending"
    )
    expect(leastAdvancedStage(["ready_to_ship", "awaiting_balance"])).toBe(
      "awaiting_balance"
    )
  })

  it("zrušená zakázka neodznačí ty, které se pořád vyrábějí", () => {
    expect(leastAdvancedStage(["cancelled", "in_production"])).toBe("in_production")
    expect(leastAdvancedStage(["cancelled"])).toBe("cancelled")
  })

  it("jedna zakázka = její vlastní fáze; nesmysly a prázdno nic nerozhodí", () => {
    expect(leastAdvancedStage(["confirmed"])).toBe("confirmed")
    expect(leastAdvancedStage([])).toBe("cancelled")
    expect(leastAdvancedStage([null, undefined, "vymysleno"])).toBe("cancelled")
  })
})
