import "server-only"

import { sdk } from "@lib/config"
import { revalidateTag } from "next/cache"

import { BUILD_STAMP } from "@lib/util/session-version"
import { retrieveCart } from "./cart"
import {
  getAuthHeaders,
  getCacheTag,
  getCartId,
  removeCartId,
  setCartId,
} from "./cookies"

/*
 * Převod košíku na novou verzi obchodu.
 *
 * Košík není jen seznam zboží — nese v sobě i rozdělanou pokladnu: vybranou
 * dopravu, výdejní místo, platební kolekci, souhlas s podmínkami. Tahle část
 * stárne. Když se mezitím změní ceník dopravy nebo se přepíše krok pokladny,
 * zůstane v košíku volba, kterou nová verze neumí dokončit — a zákazník se
 * z ní nedostane ničím, co má po ruce. Tvrdý reload nepomůže: `_medusa_cart_id`
 * je httpOnly cookie a drží se dál.
 *
 * Zboží se přitom nezkazí nikdy. Proto se tady nic nemaže: co si zákazník
 * vybral, se přenese do čerstvého košíku a zahodí se jen ta rozdělaná
 * pokladna, kterou stejně projde znovu.
 *
 * Překládá se každý košík, který už do pokladny vstoupil — ne jen ten, na
 * kterém je stáří vidět. Důvod je konkrétní: rozdělaná pokladna drží platební
 * relaci navázanou na transakci u brány a ta má omezenou platnost. Jakmile
 * vyprší, nedá se zrušit — a protože ji Medusa musí smazat pokaždé, když se
 * mění částka nebo způsob platby, přestane jít dokončit doprava i platba.
 * Zvenčí to na košíku poznat není, takže se nespoléhá na to, že se prošlost
 * podaří odhalit.
 *
 * Nákup, který do pokladny ještě nevstoupil, nemá co zastarat — ten se jen
 * orazítkuje a nechá být. Zákazník tedy po nasazení znovu vybere dopravu;
 * zboží ani adresu neztratí.
 */

export type VysledekPrevodu = {
  stav: "nic" | "zahozen" | "aktualni" | "orazitkovan" | "prenesen"
  preneseno?: number
  vynechano?: number
}

const STAMP_KEY = "build_stamp"

/*
 * Klíče, které patří ke konkrétní volbě dopravy a k souhlasu. Do nového
 * košíku nejdou schválně: dopravu si zákazník vybere znovu (o to tu jde)
 * a podmínky musí odsouhlasit v té verzi, ve které nakupuje.
 */
const NEPRENASET = [
  "packeta_pickup_point",
  "packeta_pickup_point_label",
  "balikovna_point_id",
  "balikovna_point_zip",
  "balikovna_point_name",
  "balikovna_point_address",
  "terms_accepted_at",
  "terms_version",
]

const adresaProKopii = (adresa: any) =>
  adresa
    ? {
        first_name: adresa.first_name ?? undefined,
        last_name: adresa.last_name ?? undefined,
        company: adresa.company ?? undefined,
        address_1: adresa.address_1 ?? undefined,
        address_2: adresa.address_2 ?? undefined,
        city: adresa.city ?? undefined,
        postal_code: adresa.postal_code ?? undefined,
        province: adresa.province ?? undefined,
        country_code: adresa.country_code ?? undefined,
        phone: adresa.phone ?? undefined,
      }
    : undefined

const vstoupilDoPokladny = (cart: any) =>
  (cart.shipping_methods?.length ?? 0) > 0 || Boolean(cart.payment_collection)

export async function carryCartToCurrentVersion(): Promise<VysledekPrevodu> {
  const puvodniId = await getCartId()
  if (!puvodniId) {
    return { stav: "nic" }
  }

  // `retrieveCart` vrací null i pro dokončený košík — pak cookie jen zahodíme.
  const cart: any = await retrieveCart()
  if (!cart) {
    await removeCartId()
    return { stav: "zahozen" }
  }

  if (BUILD_STAMP && cart.metadata?.[STAMP_KEY] === BUILD_STAMP) {
    return { stav: "aktualni" }
  }

  const headers = { ...(await getAuthHeaders()) }
  const razitko = { ...(cart.metadata ?? {}), [STAMP_KEY]: BUILD_STAMP }

  if (!vstoupilDoPokladny(cart)) {
    // Do pokladny nevstoupil, není co resetovat — jen se poznamená verze.
    await sdk.store.cart.update(cart.id, { metadata: razitko }, {}, headers)
    const tag = await getCacheTag("carts")
    if (tag) revalidateTag(tag)
    return { stav: "orazitkovan" }
  }

  const { cart: novy } = await sdk.store.cart.create(
    { region_id: cart.region_id },
    {},
    headers
  )

  const metadata = Object.fromEntries(
    Object.entries(razitko).filter(([klic]) => !NEPRENASET.includes(klic))
  )

  await sdk.store.cart.update(
    novy.id,
    {
      email: cart.email ?? undefined,
      shipping_address: adresaProKopii(cart.shipping_address),
      billing_address: adresaProKopii(cart.billing_address),
      metadata,
    } as any,
    {},
    headers
  )

  /*
   * Sady se nedají přidat po řádcích — vznikají jedním voláním, které si
   * rozpad na položky spočítá samo. Řádky jedné sady drží pohromadě
   * `bundle_group_id`; `bundle_quantity` a `bundle_item_id` v metadatech
   * stačí na to, aby se sada složila přesně tak, jak ji zákazník poskládal.
   */
  const radky: any[] = cart.items ?? []
  const sady = new Map<string, any[]>()
  const jednotlive: any[] = []

  for (const radek of radky) {
    const skupina = radek.metadata?.bundle_group_id
    if (typeof skupina === "string" && skupina) {
      sady.set(skupina, [...(sady.get(skupina) ?? []), radek])
    } else {
      jednotlive.push(radek)
    }
  }

  let preneseno = 0
  let vynechano = 0

  for (const [skupina, polozky] of Array.from(sady.entries())) {
    try {
      await sdk.client.fetch(`/store/carts/${novy.id}/line-item-bundles`, {
        method: "POST",
        body: {
          bundle_id: polozky[0].metadata?.bundle_id,
          quantity: Number(polozky[0].metadata?.bundle_quantity) || 1,
          items: polozky.map((p: any) => ({
            item_id: p.metadata?.bundle_item_id,
            variant_id: p.variant_id,
          })),
        },
        headers,
      })
      preneseno += polozky.length
    } catch (chyba) {
      vynechano += polozky.length
      console.error(`[košík] sadu ${skupina} se nepodařilo přenést:`, chyba)
    }
  }

  for (const radek of jednotlive) {
    try {
      await sdk.store.cart.createLineItem(
        novy.id,
        {
          variant_id: radek.variant_id,
          quantity: radek.quantity,
          metadata: radek.metadata ?? undefined,
        },
        {},
        headers
      )
      preneseno += 1
    } catch (chyba) {
      // Typicky doprodáno. Zboží, které nelze koupit, se přenést nedá.
      vynechano += 1
      console.error(
        `[košík] položku ${radek.title ?? radek.variant_id} se nepodařilo přenést:`,
        chyba
      )
    }
  }

  await setCartId(novy.id)

  const tag = await getCacheTag("carts")
  if (tag) revalidateTag(tag)

  console.info(
    `[košík] ${puvodniId} → ${novy.id} (přeneseno ${preneseno}, vynecháno ${vynechano})`
  )

  return { stav: "prenesen", preneseno, vynechano }
}
