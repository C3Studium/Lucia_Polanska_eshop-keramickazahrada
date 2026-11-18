import {
  asciiHandle,
  needsAsciiHandle,
  needsShopChannel,
  uniqueHandle,
} from "../product-shop-defaults"

describe("výrobek musí být v obchodě vidět (18. 11. 2026)", () => {
  it("adresa bez diakritiky — případ z produkce", () => {
    expect(asciiHandle("Modelovaný květináč Bonsaj s Vážkou - 20")).toBe(
      "modelovany-kvetinac-bonsaj-s-vazkou-20"
    )
    expect(asciiHandle("  Zvonkové tlačítko, Jeřabina! ")).toBe("zvonkove-tlacitko-jerabina")
  })

  it("pozná adresu, kterou je třeba opravit", () => {
    expect(needsAsciiHandle("modelovaný-květináč-bonsaj-s-vážkou-20")).toBe(true)
    expect(needsAsciiHandle("modelovany-kvetinac-bonsaj-20")).toBe(false)
    expect(needsAsciiHandle(null)).toBe(false)
  })

  it("obsazenou adresu nepřepíše", () => {
    expect(uniqueHandle("a", new Set())).toBe("a")
    expect(uniqueHandle("a", new Set(["a", "a-2"]))).toBe("a-3")
  })

  it("kanál: nový bez kanálu vždy, úprava jen publikovaného", () => {
    expect(needsShopChannel({ status: "draft", sales_channels: [] }, "product.created")).toBe(true)
    expect(needsShopChannel({ status: "published", sales_channels: [] }, "product.updated")).toBe(true)
    expect(needsShopChannel({ status: "draft", sales_channels: [] }, "product.updated")).toBe(false)
    expect(
      needsShopChannel({ status: "published", sales_channels: [{ id: "sc" }] }, "product.created")
    ).toBe(false)
  })
})
