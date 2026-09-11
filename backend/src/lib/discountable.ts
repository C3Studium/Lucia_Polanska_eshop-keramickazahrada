/**
 * „Na zlevněný kus slevový kód neplatí."
 *
 * ## Pravidlo
 *
 * Kus, který už má sníženou cenu, další slevu nedostane. Zlevněný je dvěma
 * způsoby a oba se sem počítají:
 *
 * - **Výprodej** (`metadata.clearance`) — poškozený nebo poslední kus, u kterého
 *   se cena stáhla ručně.
 * - **Sezónní akce** — produkt patří do výběru, jehož ceník právě platí. Cenu
 *   mění nativní ceník, takže „právě platí" se čte z něj, ne z data u výběru:
 *   ceník je to jediné, co skutečně rozhoduje o ceně.
 *
 * ## Proč zrovna `product.discountable`
 *
 * Medusa tenhle vypínač už má a její vlastní výpočet slev ho respektuje:
 * `promotion/utils/compute-actions/line-items.js` položku s `is_discountable:
 * false` z akce prostě vynechá. A `is_discountable` se na položku košíku
 * obtiskne z `product.discountable` ve chvíli přidání do košíku.
 *
 * Díky tomu platí pravidlo **po jednotlivých kusech**, ne na celý košík.
 * Zákazník se třemi hrnky za plnou cenu a jedním výprodejovým slevu dostane —
 * jen ne na ten výprodejový. Kdyby se to hlídalo v obchodě, dalo by se odmítnout
 * jen celé zadání kódu, což by ho potrestalo za to, že si přidal zlevněný kus.
 *
 * ## Co drží zpětnou vazbu na uzdě
 *
 * Zápis odsud vyvolá `product.updated` — modul produktů události vydává i při
 * volání napřímo (`EmitEvents()` nad `updateProducts`) — a `product.updated` je
 * přitom jedna z událostí, které sem vedou. Smyčku nezastavuje způsob zápisu,
 * ale to, že se **zapisuje jen rozdíl**: druhý průchod už najde hodnotu
 * srovnanou, nic nezapíše, a tím řada končí. Proto `rozdilyDiscountable` vrací
 * jen to, co se opravdu mění — je to podmínka správnosti, ne úspora.
 */

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { isClearanceProduct } from "./clearance"

export type DiscountableProduct = {
  id: string
  discountable?: boolean | null
  metadata?: Record<string, unknown> | null
}

/** Co potřebuje `rozdilyDiscountable` z `query.graph`. */
export const DISCOUNTABLE_PRODUCT_FIELDS = ["id", "discountable", "metadata"]

/** Produkty, které jsou právě v běžící sezónní akci. */
export type SaleMembership = {
  saleProductIds: ReadonlySet<string>
}

export const noSaleMembership: SaleMembership = {
  saleProductIds: new Set<string>(),
}

/**
 * Smí tenhle produkt dostat slevový kód?
 *
 * Čisté a vyvezené zvlášť, protože právě tohle je to rozhodnutí — zbytek
 * souboru je jen doprava dat.
 */
export const smiDostatSlevu = (
  product: DiscountableProduct,
  membership: SaleMembership = noSaleMembership
): boolean => {
  if (!product?.id) {
    return false
  }
  if (isClearanceProduct(product)) {
    return false
  }
  return !membership.saleProductIds.has(product.id)
}

/**
 * Které produkty se musí přepnout, a kam.
 *
 * Vrací se jen to, co se opravdu mění, a na tom stojí bezpečnost celé věci:
 * zápis vydá `product.updated`, což je událost, která přepočet znovu vyvolá.
 * Druhý průchod ale najde hodnotu srovnanou, nevrátí nic — a řada tím končí.
 */
export const rozdilyDiscountable = (
  products: DiscountableProduct[],
  membership: SaleMembership = noSaleMembership
): { zapnout: string[]; vypnout: string[] } => {
  const zapnout: string[] = []
  const vypnout: string[] = []

  for (const product of products ?? []) {
    if (!product?.id) {
      continue
    }
    const ma = smiDostatSlevu(product, membership)
    /* `discountable` je v Meduse výchozím `true`; chybějící hodnota se tedy
       čte jako „zatím zapnuto", ne jako neznámo. */
    const je = product.discountable !== false

    if (ma && !je) {
      zapnout.push(product.id)
    } else if (!ma && je) {
      vypnout.push(product.id)
    }
  }

  return { zapnout, vypnout }
}

/**
 * Produkty v běžících sezónních akcích.
 *
 * Rozhoduje ceník, ne datum u výběru: ten může být vyplněný i u akce, které se
 * ceník nikdy nezaložil, a naopak ceník může být ručně pozastavený. Cenu na
 * pultě mění ceník, takže se ptáme jeho.
 *
 * Chyba se tu snáší: bez tohohle seznamu vyjde pravidlo o výprodeji pořád
 * správně a jediné, co se pokazí, je sezónní část — což je pořád lepší než
 * shodit zápis do katalogu.
 */
export const loadSaleMembership = async (
  container: MedusaContainer
): Promise<SaleMembership> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const { data: selections } = await query.graph({
      entity: "seasonal_selection",
      fields: ["id", "linked_price_list_id", "items.product_id"],
    })

    const podleCeniku = new Map<string, string[]>()
    for (const selection of selections as any[]) {
      const priceListId = selection?.linked_price_list_id
      if (!priceListId) {
        continue
      }
      const productIds = (selection.items || [])
        .map((item: any) => item?.product_id)
        .filter((id: unknown): id is string => Boolean(id))

      podleCeniku.set(priceListId, [
        ...(podleCeniku.get(priceListId) ?? []),
        ...productIds,
      ])
    }

    if (!podleCeniku.size) {
      return noSaleMembership
    }

    const { data: priceLists } = await query.graph({
      entity: "price_list",
      fields: ["id", "status", "starts_at", "ends_at"],
      filters: { id: Array.from(podleCeniku.keys()) },
    })

    const ted = Date.now()
    const saleProductIds = new Set<string>()

    for (const priceList of priceLists as any[]) {
      if (priceList?.status !== "active") {
        continue
      }
      const zacatek = priceList.starts_at
        ? new Date(priceList.starts_at).getTime()
        : null
      const konec = priceList.ends_at
        ? new Date(priceList.ends_at).getTime()
        : null

      if ((zacatek !== null && ted < zacatek) || (konec !== null && ted > konec)) {
        continue
      }

      for (const productId of podleCeniku.get(priceList.id) ?? []) {
        saleProductIds.add(productId)
      }
    }

    return { saleProductIds }
  } catch {
    return noSaleMembership
  }
}

/** Použít pravidlo na dané produkty a říct, co se změnilo. */
export const applyDiscountableRule = async (
  container: MedusaContainer,
  products: DiscountableProduct[],
  membership?: SaleMembership
): Promise<{ zapnuto: string[]; vypnuto: string[] }> => {
  const resolved = membership ?? (await loadSaleMembership(container))
  const { zapnout, vypnout } = rozdilyDiscountable(products, resolved)

  if (!zapnout.length && !vypnout.length) {
    return { zapnuto: [], vypnuto: [] }
  }

  const productModule = container.resolve(Modules.PRODUCT)

  if (vypnout.length) {
    await productModule.updateProducts(
      { id: vypnout } as never,
      { discountable: false } as never
    )
  }
  if (zapnout.length) {
    await productModule.updateProducts(
      { id: zapnout } as never,
      { discountable: true } as never
    )
  }

  return { zapnuto: zapnout, vypnuto: vypnout }
}

/**
 * Projít celý katalog a srovnat ho s pravidlem.
 *
 * Po stránkách: strop na prvních N produktů by se choval jako „hotovo" přesně
 * do chvíle, kdy jich bude víc.
 */
export const sweepDiscountable = async (
  container: MedusaContainer
): Promise<{ zapnuto: number; vypnuto: number; proslo: number }> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const membership = await loadSaleMembership(container)

  const pageSize = 200
  let skip = 0
  let zapnuto = 0
  let vypnuto = 0
  let proslo = 0

  for (;;) {
    const { data: products } = await query.graph({
      entity: "product",
      fields: DISCOUNTABLE_PRODUCT_FIELDS,
      pagination: { take: pageSize, skip },
    })

    if (!products?.length) {
      break
    }

    const vysledek = await applyDiscountableRule(
      container,
      products as DiscountableProduct[],
      membership
    )
    zapnuto += vysledek.zapnuto.length
    vypnuto += vysledek.vypnuto.length
    proslo += products.length

    if (products.length < pageSize) {
      break
    }
    skip += pageSize
  }

  return { zapnuto, vypnuto, proslo }
}
