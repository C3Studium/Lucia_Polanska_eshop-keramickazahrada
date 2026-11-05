import {
  jeMenaObchodu,
  MENA_ZAKLADNI,
  MENY_OBCHODU,
  vypisMen,
} from "../currencies"

describe("měny obchodu", () => {
  it("koruna a euro projdou, zlotý ne", () => {
    expect(jeMenaObchodu("czk")).toBe(true)
    expect(jeMenaObchodu("eur")).toBe(true)
    expect(jeMenaObchodu("pln")).toBe(false)
    expect(jeMenaObchodu("usd")).toBe(false)
  })

  /* Měna chodí z administrace i z Medusy — jednou velkými, jednou s mezerou. */
  it("velikost písmen ani mezery nerozhodují", () => {
    expect(jeMenaObchodu("CZK")).toBe(true)
    expect(jeMenaObchodu(" Eur ")).toBe(true)
  })

  it("co není řetězec, měna není", () => {
    expect(jeMenaObchodu(undefined)).toBe(false)
    expect(jeMenaObchodu(null)).toBe(false)
    expect(jeMenaObchodu(203)).toBe(false)
  })

  /* Kurzy ČNB se počítají OD koruny — kdyby základní měna byla jiná,
     přepočet by se neprovedl vůbec (viz jobs/sync-currency-prices). */
  it("základní měna je koruna a je mezi povolenými", () => {
    expect(MENA_ZAKLADNI).toBe("czk")
    expect(MENY_OBCHODU).toContain(MENA_ZAKLADNI)
  })

  it("výpis pro hlášky je čitelný", () => {
    expect(vypisMen()).toBe("CZK a EUR")
  })
})
