import { likePattern, parseSearchQuery } from "../admin-search"

describe("parseSearchQuery", () => {
  it("číslo (i s #) je číslo objednávky a nic jiného", () => {
    expect(parseSearchQuery("#123")).toMatchObject({
      orderNumber: 123,
      voucherCode: null,
      parcelCode: null,
      words: null,
    })
    // jednociferné číslo projde, i když je kratší než minimum
    expect(parseSearchQuery("5").orderNumber).toBe(5)
  })

  it("jméno hledá v názvech a jménech, kód poukazu jen když tak vypadá", () => {
    expect(parseSearchQuery("Nováková")).toMatchObject({
      orderNumber: null,
      voucherCode: null,
      words: "Nováková",
    })
    expect(parseSearchQuery(" 7hq4-m2xp ")).toMatchObject({
      voucherCode: "7HQ4M2XP",
      words: "7hq4-m2xp",
    })
  })

  it("podací číslo ČP", () => {
    expect(parseSearchQuery("dr1234567890u").parcelCode).toBe("DR1234567890U")
    expect(parseSearchQuery("Novák").parcelCode).toBeNull()
  })

  it("prázdné a jednopísmenné se nehledá", () => {
    expect(parseSearchQuery("").text).toBe("")
    expect(parseSearchQuery("a").text).toBe("")
    expect(parseSearchQuery(undefined).text).toBe("")
  })

  it("dlouhý text se ořízne", () => {
    expect(parseSearchQuery("x".repeat(200)).text).toHaveLength(80)
  })
})

describe("likePattern", () => {
  it("zástupné znaky z textu bere doslova", () => {
    expect(likePattern("50%_a")).toBe("%50\\%\\_a%")
  })
})
