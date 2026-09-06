import {
  assignShippingProfile,
  productsMissingShippingProfile,
  resolveDefaultShippingProfile,
} from "../shipping-profile-default"

const kontejner = (profily: unknown[], link = { create: jest.fn() }) =>
  ({
    resolve: (klic: string) => {
      if (klic === "query") {
        return { graph: jest.fn().mockResolvedValue({ data: profily }) }
      }
      if (klic === "link") {
        return link
      }
      throw new Error(`neznámý klíč: ${klic}`)
    },
  }) as any

describe("výchozí profil dopravy", () => {
  it("bere produkt bez odkazu na profil jako chybějící", () => {
    const produkty = [
      { id: "prod_1", title: "S profilem", shipping_profile: { id: "sp_1" } },
      { id: "prod_2", title: "Bez profilu" },
      { id: "prod_3", title: "S prázdným profilem", shipping_profile: {} },
    ]

    expect(productsMissingShippingProfile(produkty)).toEqual([
      { id: "prod_2", title: "Bez profilu" },
      { id: "prod_3", title: "S prázdným profilem" },
    ])
  })

  it("vybere profil označený jako výchozí", async () => {
    const container = kontejner([
      { id: "sp_krehke", name: "Křehké", type: "custom" },
      { id: "sp_zaklad", name: "Default Shipping Profile", type: "default" },
    ])

    await expect(resolveDefaultShippingProfile(container)).resolves.toEqual({
      id: "sp_zaklad",
      name: "Default Shipping Profile",
    })
  })

  it("bere jediný profil i bez označení", async () => {
    const container = kontejner([{ id: "sp_jediny", name: "Základní" }])

    await expect(resolveDefaultShippingProfile(container)).resolves.toEqual({
      id: "sp_jediny",
      name: "Základní",
    })
  })

  /* Raději nic než tip: přiřadit kus ke špatnému profilu znamená nabídnout
     u něj špatnou dopravu, a to se pozná až u zákazníka. */
  it("nehádá, když je profilů víc a žádný není výchozí", async () => {
    const container = kontejner([
      { id: "sp_a", name: "A", type: "custom" },
      { id: "sp_b", name: "B", type: "custom" },
    ])

    await expect(resolveDefaultShippingProfile(container)).resolves.toBeNull()
  })

  it("zapisuje odkazy po dávkách", async () => {
    const link = { create: jest.fn() }
    const container = kontejner([], link)

    await assignShippingProfile(
      container,
      ["prod_1", "prod_2", "prod_3", "prod_4", "prod_5"],
      "sp_zaklad",
      2
    )

    expect(link.create).toHaveBeenCalledTimes(3)
    expect(link.create.mock.calls[0][0]).toHaveLength(2)
    expect(link.create.mock.calls[2][0]).toHaveLength(1)
    expect(link.create.mock.calls[0][0][0]).toMatchObject({
      product: { product_id: "prod_1" },
      fulfillment: { shipping_profile_id: "sp_zaklad" },
    })
  })
})
