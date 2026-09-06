import { itemsWithoutShippingProfile } from "../require-shippable-cart"

const kus = (title: string, profil?: string, requires_shipping = true) => ({
  id: `item_${title}`,
  title,
  requires_shipping,
  variant: { product: profil ? { shipping_profile: { id: profil } } : {} },
})

describe("kusy bez profilu dopravy", () => {
  it("najde kus, jehož produkt profil nemá", () => {
    const cart = {
      items: [kus("Keramická růže", "sp_zaklad"), kus("Keramický motýl")],
    }

    expect(itemsWithoutShippingProfile(cart)).toEqual(["Keramický motýl"])
  })

  it("mlčí, když profil mají všechny", () => {
    const cart = {
      items: [kus("Růže", "sp_zaklad"), kus("Motýl", "sp_krehke")],
    }

    expect(itemsWithoutShippingProfile(cart)).toEqual([])
  })

  /* Položka, která dopravu nepotřebuje, profil mít nemusí — Medusa ji do své
     kontroly taky nepočítá (`filter((item) => item.requires_shipping)`). */
  it("nechává být položku, která dopravu nepotřebuje", () => {
    const cart = { items: [kus("Dárkový poukaz", undefined, false)] }

    expect(itemsWithoutShippingProfile(cart)).toEqual([])
  })

  it("zvládne prázdný i chybějící košík", () => {
    expect(itemsWithoutShippingProfile({ items: [] })).toEqual([])
    expect(itemsWithoutShippingProfile(undefined)).toEqual([])
    expect(itemsWithoutShippingProfile(null)).toEqual([])
  })

  it("kus bez názvu popíše, místo aby spadl", () => {
    const cart = { items: [{ requires_shipping: true, variant: {} }] }

    expect(itemsWithoutShippingProfile(cart)).toEqual(["neznámý kus"])
  })
})
