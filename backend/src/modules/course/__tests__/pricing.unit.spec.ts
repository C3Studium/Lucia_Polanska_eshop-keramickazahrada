import {
  fitsCapacity,
  hasGroupPricing,
  hasPairPricing,
  pricingTierFor,
  quoteFor,
  seatsLeft,
  seatsTaken,
  toAmount,
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

describe("pricingTierFor", () => {
  it("prices one person as single", () => {
    expect(pricingTierFor(1, fullRules)).toBe("single")
  })

  it("prices two people with a pair price as pair", () => {
    expect(pricingTierFor(2, fullRules)).toBe("pair")
  })

  it("prices two people without a pair price as single", () => {
    expect(pricingTierFor(2, { ...fullRules, price_two: null })).toBe("single")
  })

  it("stays single below the group threshold", () => {
    expect(pricingTierFor(3, fullRules)).toBe("single")
  })

  it("switches to group exactly at the threshold", () => {
    expect(pricingTierFor(4, fullRules)).toBe("group")
    expect(pricingTierFor(9, fullRules)).toBe("group")
  })

  it("never uses group pricing when the term has none", () => {
    expect(
      pricingTierFor(8, { price_single: 1500, price_two: 1300 })
    ).toBe("single")
  })

  it("prefers the pair price when a group rate technically starts at 2", () => {
    const rules = {
      price_single: 1500,
      price_two: 1300,
      group_min: 2,
      price_group_per_person: 1000,
    }
    expect(pricingTierFor(2, rules)).toBe("pair")
    expect(pricingTierFor(3, rules)).toBe("group")
  })

  it("uses the group rate for 2 when there is no pair price", () => {
    const rules = {
      price_single: 1500,
      price_two: null,
      group_min: 2,
      price_group_per_person: 1000,
    }
    expect(pricingTierFor(2, rules)).toBe("group")
  })
})

describe("quoteFor", () => {
  it("computes single totals as price × people", () => {
    expect(quoteFor(1, fullRules)).toEqual({
      tier: "single",
      per_person: 1500,
      total: 1500,
    })
    expect(quoteFor(3, fullRules)).toEqual({
      tier: "single",
      per_person: 1500,
      total: 4500,
    })
  })

  it("computes the pair total as pair price per person × 2", () => {
    expect(quoteFor(2, fullRules)).toEqual({
      tier: "pair",
      per_person: 1300,
      total: 2600,
    })
  })

  it("computes group totals per person from the threshold up", () => {
    expect(quoteFor(4, fullRules)).toEqual({
      tier: "group",
      per_person: 1100,
      total: 4400,
    })
    expect(quoteFor(7, fullRules)).toEqual({
      tier: "group",
      per_person: 1100,
      total: 7700,
    })
  })

  it("crossing the threshold by one person can lower the total", () => {
    // 3 people pay 3 × 1500 = 4500; the fourth makes it 4 × 1100 = 4400.
    expect(quoteFor(3, fullRules).total).toBe(4500)
    expect(quoteFor(4, fullRules).total).toBe(4400)
  })

  it("accepts numeric strings from the database", () => {
    const dbRules = {
      price_single: "1500.00",
      price_two: "1300.00",
      group_min: "4",
      price_group_per_person: "1100.00",
    }
    expect(quoteFor(2, dbRules).total).toBe(2600)
    expect(quoteFor(5, dbRules).total).toBe(5500)
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
  it("treats a zero or missing pair price as no pair pricing", () => {
    expect(hasPairPricing({ price_single: 100, price_two: 0 })).toBe(false)
    expect(hasPairPricing({ price_single: 100 })).toBe(false)
    expect(hasPairPricing({ price_single: 100, price_two: 90 })).toBe(true)
  })

  it("requires both a sane threshold and a positive rate for group pricing", () => {
    expect(
      hasGroupPricing({ price_single: 100, group_min: 4 })
    ).toBe(false)
    expect(
      hasGroupPricing({ price_single: 100, price_group_per_person: 80 })
    ).toBe(false)
    expect(
      hasGroupPricing({ price_single: 100, group_min: 1, price_group_per_person: 80 })
    ).toBe(false)
    expect(
      hasGroupPricing({ price_single: 100, group_min: 4, price_group_per_person: 80 })
    ).toBe(true)
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
