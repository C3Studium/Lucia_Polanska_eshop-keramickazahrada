import { PDFDocument } from "pdf-lib"
import { labelPerParcel, parcelDefaultsFor } from "../cp-label-parcels"

const pdf = async (pages: number) => {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage([283, 425])
  return Buffer.from(await doc.save()).toString("base64")
}

describe("štítek po balících (vícekusová zásilka)", () => {
  it("dvoustránkové PDF od ČP → dvě PDF, každé o jedné stránce, s čísly balíků", async () => {
    const parts = await labelPerParcel(await pdf(2), ["DR1U", "DR2U"])
    expect(parts.map((p) => [p.index, p.total, p.tracking_number])).toEqual([
      [1, 2, "DR1U"],
      [2, 2, "DR2U"],
    ])
    for (const part of parts) {
      const doc = await PDFDocument.load(Buffer.from(part.pdf_base64, "base64"))
      expect(doc.getPageCount()).toBe(1)
    }
  })

  it("jeden balík = nic se nedělí", async () => {
    expect(await labelPerParcel(await pdf(1), ["DR1U"])).toEqual([])
  })

  it("poškozené PDF nic neshodí", async () => {
    expect(await labelPerParcel("nesmysl", ["DR1U", "DR2U"])).toEqual([])
  })
})

describe("předvyplnění velikosti a počtu balíků", () => {
  const item = (ship_class?: string) => ({ metadata: ship_class ? { ship_class } : {} })

  it("malé výrobky = S, velký = M; na adresu jde víc balíků", () => {
    expect(parcelDefaultsFor({ items: [item("male"), item()], balikovnaPickup: false })).toEqual({
      size: "S",
      packages: 1,
      max_packages: 5,
    })
    expect(parcelDefaultsFor({ items: [item("velke")], balikovnaPickup: false }).size).toBe("M")
  })

  it("Balíkovna (výdejna) jen jeden balík", () => {
    expect(parcelDefaultsFor({ items: [item("male")], balikovnaPickup: true }).max_packages).toBe(1)
  })

  it("balné a doběrečné se do velikosti nepočítají", () => {
    const balne = { metadata: { packaging_fee: true, ship_class: "velke" } }
    expect(parcelDefaultsFor({ items: [item("male"), balne], balikovnaPickup: false }).size).toBe("S")
  })
})
