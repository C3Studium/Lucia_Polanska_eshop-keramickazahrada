import {
  CnbRatesError,
  convertFromCzk,
  decimalDigitsFor,
  fetchCnbRates,
  parseCnbRates,
} from "../cnb-rates"

/** Verbatim slice of the real wire format (pipes, Czech decimal comma). */
const SAMPLE = [
  "14.08.2026 #156",
  "země|měna|množství|kód|kurz",
  "EMU|euro|1|EUR|24,210",
  "USA|dolar|1|USD|20,936",
  "Maďarsko|forint|100|HUF|6,127",
  "Velká Británie|libra|1|GBP|28,339",
].join("\n")

describe("ČNB rate sheet", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("parseCnbRates", () => {
    it("reads the date and the pipe-separated rows with decimal commas", () => {
      const sheet = parseCnbRates(SAMPLE)
      expect(sheet.date).toBe("14.08.2026")
      expect(sheet.rates.get("EUR")).toEqual({
        code: "EUR",
        amount: 1,
        rate: 24.21,
      })
      // HUF is quoted per 100 units — the amount must survive parsing.
      expect(sheet.rates.get("HUF")).toEqual({
        code: "HUF",
        amount: 100,
        rate: 6.127,
      })
    })

    it("skips malformed rows and refuses an empty sheet", () => {
      const sheet = parseCnbRates(`${SAMPLE}\nrozbitý řádek bez sloupců`)
      expect(sheet.rates.size).toBe(4)
      expect(() => parseCnbRates("14.08.2026 #156\nhlavička")).toThrow(
        CnbRatesError
      )
    })
  })

  describe("convertFromCzk", () => {
    const sheet = parseCnbRates(SAMPLE)

    it("converts through the fixing and rounds to the currency's decimals", () => {
      // 2 450 Kč / 24,210 = 101,198… → 101.2 EUR at two decimals.
      expect(convertFromCzk(2450, sheet.rates.get("EUR")!)).toBe(101.2)
      expect(decimalDigitsFor("eur")).toBe(2)
    })

    it("respects per-100 quotations and zero-decimal currencies", () => {
      // 2 450 Kč / (6,127/100) = 39 986,9… HUF → whole forints.
      expect(decimalDigitsFor("huf")).toBe(0)
      expect(convertFromCzk(2450, sheet.rates.get("HUF")!)).toBe(39987)
    })

    it("applies the merchant's markup before rounding", () => {
      const plain = convertFromCzk(2450, sheet.rates.get("EUR")!)
      const padded = convertFromCzk(2450, sheet.rates.get("EUR")!, {
        markupPercent: 2,
      })
      expect(padded).toBeCloseTo(plain * 1.02, 1)
      expect(padded).toBe(103.22)
    })
  })

  describe("fetchCnbRates", () => {
    it("labels an HTTP failure in Czech instead of leaking a stack", async () => {
      jest
        .spyOn(global, "fetch")
        .mockResolvedValue(new Response("maintenance", { status: 503 }))
      await expect(fetchCnbRates()).rejects.toThrow(
        "ČNB: kurzovní lístek se nepodařilo stáhnout (HTTP 503)."
      )
    })

    it("parses a successful download", async () => {
      jest
        .spyOn(global, "fetch")
        .mockResolvedValue(new Response(SAMPLE, { status: 200 }))
      const sheet = await fetchCnbRates()
      expect(sheet.rates.get("USD")?.rate).toBe(20.936)
    })
  })
})
