import { naplanujAkci } from "../lib/odlozena-akce"

describe("naplanujAkci — změna stavu s možností vrátit", () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it("provede akci až po uplynutí lhůty", () => {
    const provest = jest.fn()
    naplanujAkci(provest, 5000)
    jest.advanceTimersByTime(4999)
    expect(provest).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1)
    expect(provest).toHaveBeenCalledTimes(1)
  })

  it("Vrátit akci zruší — nic se neodešle", () => {
    const provest = jest.fn()
    const plan = naplanujAkci(provest, 5000)
    expect(plan.zrusit()).toBe(true)
    jest.advanceTimersByTime(10000)
    expect(provest).not.toHaveBeenCalled()
  })

  it("Vrátit po provedení už nic nevrátí", () => {
    const provest = jest.fn()
    const plan = naplanujAkci(provest, 5000)
    jest.advanceTimersByTime(5000)
    expect(plan.zrusit()).toBe(false)
    expect(provest).toHaveBeenCalledTimes(1)
  })

  it("hned = provede okamžitě a jen jednou (odchod ze stránky)", () => {
    const provest = jest.fn()
    const plan = naplanujAkci(provest, 5000)
    plan.hned()
    jest.advanceTimersByTime(10000)
    expect(provest).toHaveBeenCalledTimes(1)
  })
})
