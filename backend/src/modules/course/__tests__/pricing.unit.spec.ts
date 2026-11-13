import {
  childMaxAge,
  fitsCapacity,
  hasGroupPricing,
  hasPairPricing,
  pricingTierFor,
  quoteFor,
  seatsLeft,
  seatsTaken,
  toAmount,
  volumePricingOn,
} from "../pricing"

/**
 * The money and capacity rules of the course system, pinned.
 *
 * These functions run in three places — the quote endpoint, the reservation
 * create inside its row lock, and the admin manual entry — so a behavior
 * change here is a price change for a customer.
 */

const fullRules = {
  price_single: 1500,
  price_two: 1300,
  group_min: 4,
  price_group_per_person: 1100,
}

describe("pricingTierFor — bez množstevních slev (13. 11. 2026)", () => {
  /* Skupinová cena ani cena za dva není: každý počet osob je „single",
     i když má termín ceny za dva a za skupinu pořád vyplněné. */
  it("prices every party size as single", () => {
    for (const people of [1, 2, 3, 4, 9]) {
      expect(pricingTierFor(people, fullRules)).toBe("single")
    }
  })

  it("ignores a term that still has the old switch on", () => {
    expect(
      pricingTierFor(4, { ...fullRules, volume_pricing_enabled: true })
    ).toBe("single")
  })
})

describe("quoteFor", () => {
  it("computes totals as price × people", () => {
    expect(quoteFor(1, fullRules)).toEqual({
      tier: "single",
      per_person: 1500,
      child_per_person: 1500,
      children: 0,
      total: 1500,
    })
    expect(quoteFor(2, fullRules).total).toBe(3000)
    expect(quoteFor(4, fullRules).total).toBe(6000)
  })

  it("accepts numeric strings from the database", () => {
    const dbRules = {
      price_single: "1500.00",
      price_two: "1300.00",
      group_min: "4",
      price_group_per_person: "1100.00",
    }
    expect(quoteFor(2, dbRules).total).toBe(3000)
    expect(quoteFor(5, dbRules).total).toBe(7500)
  })

  it("rounds to haléře", () => {
    expect(quoteFor(3, { price_single: 333.333 }).total).toBe(1000)
  })

  it("refuses a non-positive or fractional party size", () => {
    expect(() => quoteFor(0, fullRules)).toThrow()
    expect(() => quoteFor(-2, fullRules)).toThrow()
    expect(() => quoteFor(2.5, fullRules)).toThrow()
  })
})

describe("pricing rule guards", () => {
  it("never offers pair or group pricing", () => {
    expect(hasPairPricing({ price_single: 100, price_two: 90 })).toBe(false)
    expect(
      hasGroupPricing({ price_single: 100, group_min: 4, price_group_per_person: 80 })
    ).toBe(false)
    expect(volumePricingOn({ price_single: 100, volume_pricing_enabled: true })).toBe(false)
    expect(volumePricingOn({ price_single: 100 })).toBe(false)
  })
})

describe("capacity math", () => {
  const reservations = [
    { party_size: 2, status: "active" },
    { party_size: 3, status: "active" },
    { party_size: 4, status: "cancelled" },
  ]

  it("counts only non-cancelled reservations", () => {
    expect(seatsTaken(reservations)).toBe(5)
  })

  it("computes seats left and never goes negative", () => {
    expect(seatsLeft(8, reservations)).toBe(3)
    expect(seatsLeft(4, reservations)).toBe(0)
  })

  it("accepts party sizes exactly up to capacity", () => {
    expect(fitsCapacity(8, 5, 3)).toBe(true)
    expect(fitsCapacity(8, 5, 4)).toBe(false)
  })

  it("handles database strings for capacity and party sizes", () => {
    expect(seatsTaken([{ party_size: "3", status: "active" }])).toBe(3)
    expect(seatsLeft("10", [{ party_size: "3", status: "active" }])).toBe(7)
  })
})

describe("toAmount", () => {
  it("coerces numbers, strings and big-number shapes", () => {
    expect(toAmount(12.5)).toBe(12.5)
    expect(toAmount("12.50")).toBe(12.5)
    expect(toAmount({ value: "1200" })).toBe(1200)
    expect(toAmount(null)).toBe(0)
    expect(toAmount("nonsense")).toBe(0)
  })
})

describe("dospělý a dítě (8. a 13. 11. 2026)", () => {
  /* Termín se staršími cenami za dva a za skupinu — ty se už nepoužijí. */
  const termin = {
    price_single: 500,
    price_two: 450,
    group_min: 3,
    price_group_per_person: 350,
    price_child: 430,
  }

  it("dítě platí svou cenu, dospělý svou", () => {
    /* Přání majitelky: dospělák 500, dítě 430 za lekci. */
    expect(quoteFor({ people: 1, children: 1 }, termin).total).toBe(430)
    expect(quoteFor({ people: 2, children: 1 }, termin).total).toBe(930)
    expect(quoteFor({ people: 3, children: 2 }, termin).total).toBe(1360)
    expect(quoteFor({ people: 3, children: 1 }, termin).tier).toBe("single")
  })

  it("bez dětské ceny platí dítě jako dospělý", () => {
    const bezDetske = { price_single: 500 }
    expect(quoteFor({ people: 2, children: 1 }, bezDetske).total).toBe(1000)
  })

  it("dětí nemůže být víc než lidí ani záporně", () => {
    expect(quoteFor({ people: 2, children: 5 }, termin).total).toBe(860)
    expect(quoteFor({ people: 2, children: -3 }, termin).total).toBe(1000)
  })

  it("věk dítěte má výchozí 15 let", () => {
    expect(childMaxAge({ price_single: 500 })).toBe(15)
    expect(childMaxAge({ price_single: 500, child_max_age: 12 })).toBe(12)
  })
})
