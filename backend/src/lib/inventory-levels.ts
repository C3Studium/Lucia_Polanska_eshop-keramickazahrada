/**
 * Každý skladový kus musí mít na skladě záznam — i když je jeho stav nula.
 *
 * ## Co se stalo
 *
 * Objednávka s osobním odběrem spadla na:
 *
 *     Item iitem_… is not stocked at location sloc_…
 *
 * Nešlo o osobní odběr. Medusa při dokončení košíku zakládá rezervaci a tu
 * nemá kam zapsat, když pro skladovou položku na dané lokaci neexistuje
 * **úroveň zásoby** (`inventory_level`). Změřeno na živé databázi: z 263
 * skladových položek jich 121 nemělo úroveň žádnou — všechny z jednoho
 * importu 17. 8. 2026. Táž objednávka by spadla i s Balíkovnou.
 *
 * ## Proč to vyplavalo teprve teď
 *
 * Protože se zapnul prodej bez skladu. Dokud se vyprodaný kus koupit nedal,
 * do košíku se nedostal a rezervace se pro něj nikdy nezakládala. S
 * `allow_backorder` se koupit dá — a rezervace se založit musí. Prodej bez
 * skladu umí jít pod nulu, ale **jen tam, kde nějaká nula je**.
 *
 * ## Proč je nula bezpečná
 *
 * Bez úrovně Medusa hlásí dostupnost 0. Založením úrovně s nulou se tedy na
 * dostupnosti nemění nic — jen se vytvoří místo, kam se dá rezervace zapsat
 * a odkud může stav klesnout do minusu, jak to prodej bez skladu má dělat.
 * Žádnému kusu se tím „nepřidá" ani „neubere".
 *
 * ## Proč to má i odběratele
 *
 * Táž díra se otevře pokaždé, když vznikne varianta bez úrovně — importem,
 * duplikací výrobku, nativním formulářem Medusy. Jednorázový skript spraví
 * dnešek a nic po něm; pravidlo musí platit u každého zápisu.
 */

import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

/** Stav, se kterým chybějící úroveň vzniká. Viz „Proč je nula bezpečná". */
const VYCHOZI_STAV = 0

/**
 * Skladové položky, kterým na dané lokaci úroveň chybí.
 *
 * Čisté a vyvezené zvlášť: je to jediné rozhodnutí v celém souboru a dá se
 * ověřit bez databáze.
 */
export const chybejiciUrovne = (
  inventoryItemIds: string[],
  existujici: { inventory_item_id?: string | null }[]
): string[] => {
  const maji = new Set(
    (existujici ?? [])
      .map((uroven) => uroven?.inventory_item_id)
      .filter((id): id is string => Boolean(id))
  )

  return Array.from(new Set(inventoryItemIds ?? []))
    .filter(Boolean)
    .filter((id) => !maji.has(id))
}

/**
 * Jediné skladové místo obchodu.
 *
 * Vrací `null`, když žádné není nebo je jich víc: „doplň nulu na to správné"
 * je při dvou skladech hádání a hádat se o zásobách nemá.
 */
export const jedineSkladoveMisto = async (
  container: MedusaContainer
): Promise<string | null> => {
  const stockLocations = container.resolve(Modules.STOCK_LOCATION) as any
  const locations = (await stockLocations.listStockLocations(
    {},
    { take: 5 }
  )) as any[]

  return locations.length === 1 ? locations[0].id : null
}

/**
 * Doplnit chybějící úrovně pro dané skladové položky.
 *
 * Vrací, co skutečně vzniklo — díky tomu je bezpečné volat to při každém
 * zápisu: položka, která úroveň má, nevyvolá žádný zápis.
 */
export const doplnUrovne = async (
  container: MedusaContainer,
  inventoryItemIds: string[],
  locationId?: string | null
): Promise<{ zalozeno: string[]; locationId: string | null }> => {
  const misto = locationId ?? (await jedineSkladoveMisto(container))

  if (!misto || !inventoryItemIds?.length) {
    return { zalozeno: [], locationId: misto ?? null }
  }

  const inventory = container.resolve(Modules.INVENTORY) as any

  const existujici = (await inventory.listInventoryLevels({
    inventory_item_id: inventoryItemIds,
    location_id: misto,
  })) as any[]

  const zalozit = chybejiciUrovne(inventoryItemIds, existujici)

  if (!zalozit.length) {
    return { zalozeno: [], locationId: misto }
  }

  await inventory.createInventoryLevels(
    zalozit.map((inventory_item_id) => ({
      inventory_item_id,
      location_id: misto,
      stocked_quantity: VYCHOZI_STAV,
    }))
  )

  return { zalozeno: zalozit, locationId: misto }
}

/**
 * Projít celý sklad a doplnit, co chybí.
 *
 * Po stránkách: strop na prvních N položkách by se choval jako „hotovo"
 * přesně do chvíle, kdy jich bude víc.
 */
export const sweepUrovne = async (
  container: MedusaContainer
): Promise<{ zalozeno: number; proslo: number; locationId: string | null }> => {
  const misto = await jedineSkladoveMisto(container)

  if (!misto) {
    return { zalozeno: 0, proslo: 0, locationId: null }
  }

  const inventory = container.resolve(Modules.INVENTORY) as any

  const pageSize = 200
  let skip = 0
  let zalozeno = 0
  let proslo = 0

  for (;;) {
    const polozky = (await inventory.listInventoryItems(
      {},
      { take: pageSize, skip }
    )) as any[]

    if (!polozky?.length) {
      break
    }

    const vysledek = await doplnUrovne(
      container,
      polozky.map((polozka) => polozka.id),
      misto
    )
    zalozeno += vysledek.zalozeno.length
    proslo += polozky.length

    if (polozky.length < pageSize) {
      break
    }
    skip += pageSize
  }

  return { zalozeno, proslo, locationId: misto }
}
