import { splitCustomPayment } from "../deposit-split"

/**
 * The slider's server-side guard. Two properties matter more than any single
 * case: the result never leaves `[Σfloor, Σceiling]` (the owner's minimum is
 * the law), and the per-line amounts sum *exactly* to what was applied
 * (a haléř of drift keeps `agreed_total − paid` from ever reaching zero).
 */
describe("splitCustomPayment", () => {
  const sum = (values: number[]) =>
    Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100

  it("pays only floors when the customer chooses the minimum", () => {
    const result = splitCustomPayment(
      [
        { floor: 250, ceiling: 1000 },
        { floor: 500, ceiling: 2000 },
      ],
      750
    )
    expect(result.applied).toBe(750)
    expect(result.amounts).toEqual([250, 500])
    expect(result.clamped).toBe(false)
  })

  it("pays everything when the customer slides to the top", () => {
    const result = splitCustomPayment(
      [
        { floor: 250, ceiling: 1000 },
        { floor: 500, ceiling: 2000 },
      ],
      3000
    )
    expect(result.applied).toBe(3000)
    expect(result.amounts).toEqual([1000, 2000])
  })

  it("distributes the surplus proportionally to headroom", () => {
    // Headrooms 750 and 1500 — the second line has twice the room, so it
    // takes twice the surplus.
    const result = splitCustomPayment(
      [
        { floor: 250, ceiling: 1000 },
        { floor: 500, ceiling: 2000 },
      ],
      1650 // floors 750 + surplus 900 → 300 / 600
    )
    expect(result.amounts).toEqual([550, 1100])
    expect(sum(result.amounts)).toBe(result.applied)
  })

  it("never goes below the owner's floor — the one hard rule", () => {
    const result = splitCustomPayment(
      [{ floor: 400, ceiling: 1000 }],
      1 // „pay later" by another name
    )
    expect(result.applied).toBe(400)
    expect(result.amounts).toEqual([400])
    expect(result.clamped).toBe(true)
  })

  it("never exceeds the ceiling", () => {
    const result = splitCustomPayment([{ floor: 400, ceiling: 1000 }], 99999)
    expect(result.applied).toBe(1000)
    expect(result.clamped).toBe(true)
  })

  it("gives a no-full-prepayment line zero headroom", () => {
    // Second line forbids full prepayment: ceiling === floor. All surplus
    // must land on the first line.
    const result = splitCustomPayment(
      [
        { floor: 250, ceiling: 1000 },
        { floor: 500, ceiling: 500 },
      ],
      1200
    )
    expect(result.amounts).toEqual([700, 500])
  })

  it("collapses to the floor when nothing has headroom", () => {
    const result = splitCustomPayment(
      [
        { floor: 300, ceiling: 300 },
        { floor: 200, ceiling: 200 },
      ],
      450
    )
    expect(result.applied).toBe(500)
    expect(result.amounts).toEqual([300, 200])
    expect(result.clamped).toBe(true)
  })

  it("sums exactly despite rounding across three lines", () => {
    // 0.10 surplus over three equal headrooms cannot split evenly; the last
    // line absorbs the drift and the sum stays exact.
    const result = splitCustomPayment(
      [
        { floor: 100, ceiling: 200 },
        { floor: 100, ceiling: 200 },
        { floor: 100, ceiling: 200 },
      ],
      300.1
    )
    expect(sum(result.amounts)).toBe(result.applied)
    expect(result.applied).toBe(300.1)
  })

  it("handles an empty cart without inventing money", () => {
    const result = splitCustomPayment([], 500)
    expect(result.applied).toBe(0)
    expect(result.amounts).toEqual([])
    expect(result.clamped).toBe(true)
  })

  it("property: 200 random cases stay in range and sum exactly", () => {
    // Deterministic seed — the suite must not flake.
    let seed = 42
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }

    for (let run = 0; run < 200; run++) {
      const lines = Array.from(
        { length: 1 + Math.floor(random() * 4) },
        () => {
          const floor = Math.round(random() * 50000) / 100
          const headroom = random() < 0.2 ? 0 : Math.round(random() * 100000) / 100
          return { floor, ceiling: floor + headroom }
        }
      )
      const floorSum = sum(lines.map((line) => line.floor))
      const ceilingSum = sum(lines.map((line) => line.ceiling))
      const target = Math.round(random() * ceilingSum * 1.2 * 100) / 100

      const result = splitCustomPayment(lines, target)

      expect(result.applied).toBeGreaterThanOrEqual(floorSum)
      expect(result.applied).toBeLessThanOrEqual(ceilingSum)
      expect(sum(result.amounts)).toBe(result.applied)
      result.amounts.forEach((amount, index) => {
        expect(amount).toBeGreaterThanOrEqual(lines[index].floor)
        expect(amount).toBeLessThanOrEqual(lines[index].ceiling + 0.005)
      })
    }
  })
})
