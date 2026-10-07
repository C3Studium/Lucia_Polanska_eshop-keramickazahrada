"use server"

import { revalidatePath } from "next/cache"
import { sdk } from "@lib/config"
import type { BalikovnaPoint } from "@lib/util/balikovna"
import { getAuthHeaders } from "./cookies"

/**
 * Zákaznická editace objednávky — tenká vrstva nad
 * /store/orders/:id/edit. Pravidla soudí server; tady se jen ptáme a
 * posíláme. Viz backend `order-edit-rules` pro tři zákony (zakázky ne,
 * prázdno ne, peníze podle matice).
 */

export type EditVariant = { id: string; title: string | null; price_czk: number | null }
export type EditableItem = {
  id: string
  title: string
  quantity: number
  variant_id: string | null
  unit_price: number
  is_made_to_order: boolean
  variants: EditVariant[]
}
export type OrderDeliveryContext = {
  /** `balikovna` → změna výdejny widgetem; `home` → změna adresy popupem;
   *  `pickup`/`other` → doručení se needituje. */
  method: "balikovna" | "home" | "pickup" | "other"
  shipping_address: {
    first_name: string
    last_name: string
    address_1: string
    address_2: string
    city: string
    postal_code: string
    country_code: string
    phone: string
  } | null
  pickup_point: { id: string; zip: string; name: string; address: string } | null
}

export type OrderEditContext = {
  editable: boolean
  /** Aktuální doručení — z čeho frontend pozná, co a jak nabídnout změnit. */
  delivery?: OrderDeliveryContext
  /**
   * Zabalená objednávka (K odeslání): jde JEN výměna varianty za stejnou cenu —
   * editor skryje odebírání a nabídne jen stejně drahé varianty.
   */
  swap_only?: boolean
  reason: string | null
  payment: "card" | "pickup" | "dobirka"
  currency_code: string
  items: EditableItem[]
  pending_change: { id: string; awaiting_payment: boolean } | null
}
export type EditAction =
  | { type: "swap"; item_id: string; variant_id: string }
  | { type: "remove"; item_id: string }
  | { type: "add"; variant_id: string; quantity: number }

export type EditResult =
  | { status: "awaiting_payment"; difference: number; payment_url: string; message: string }
  | { status: "confirmed"; difference: number; refund_due: number; message: string }

export async function getOrderEditContext(orderId: string): Promise<OrderEditContext | null> {
  try {
    return await sdk.client.fetch<OrderEditContext>(`/store/orders/${orderId}/edit`, {
      headers: { ...(await getAuthHeaders()) },
      cache: "no-store",
    })
  } catch {
    return null
  }
}

export async function submitOrderEdit(
  orderId: string,
  actions: EditAction[]
): Promise<EditResult | { error: string }> {
  try {
    return await sdk.client.fetch<EditResult>(`/store/orders/${orderId}/edit`, {
      method: "POST",
      headers: { ...(await getAuthHeaders()) },
      body: { actions },
    })
  } catch (error: any) {
    return { error: error?.message ?? "Úpravu se nepodařilo uložit." }
  }
}

export async function cancelOrderEdit(orderId: string): Promise<void> {
  try {
    await sdk.client.fetch(`/store/orders/${orderId}/edit`, {
      method: "DELETE",
      headers: { ...(await getAuthHeaders()) },
    })
  } catch {
    // rušení je best-effort
  }
}

/**
 * Změna DORUČENÍ (cíle) z hostovského odkazu — nová výdejna Balíkovny
 * (`balikovna`) nebo nová adresa „pošta domů" (`address`). Mění jen cíl v rámci
 * už zvolené dopravy, ne samotnou dopravu. Autorizace = podepsaný token z odkazu
 * (jako `submitGuestOrderEdit`), takže se posílá BEZ auth hlaviček a token jde
 * v těle. Soudcem je backend (`POST /store/orders/:id/delivery`); tady jen
 * posíláme a vracíme výsledek, nebo `{ error }` s jeho hláškou.
 */
export type DeliveryAddressInput = {
  first_name: string
  last_name: string
  address_1: string
  address_2: string
  city: string
  postal_code: string
  country_code: string
  phone: string
}

export type ChangeDeliveryInput =
  | { kind: "balikovna"; point: BalikovnaPoint }
  | { kind: "address"; address: DeliveryAddressInput }

/**
 * Stránky, které doručovací adresu objednávky vykreslují — po změně cíle se
 * musí vykreslit znovu. Tvar cesty = cesta souboru v `app/` VČETNĚ skupiny
 * `(main)` a slotu `@dashboard`: implicitní značka stránky, se kterou
 * `revalidatePath(…, "page")` porovnává, se staví z `routeModule.definition.page`
 * (viz `app-paths-manifest`: `/[countryCode]/(main)/store/page`), ne z URL.
 * Bez skupiny by se značka neshodla a server by nezneplatnil nic.
 */
const ORDER_PAGE_PATHS = [
  "/[countryCode]/(main)/order/[id]/confirmed",
  "/[countryCode]/(main)/order/[id]/edit",
  "/[countryCode]/(main)/account/@dashboard/orders/details/[id]",
]

export async function changeOrderDelivery(
  orderId: string,
  token: string,
  input: ChangeDeliveryInput
): Promise<{ ok: true; kind: string } | { error: string }> {
  try {
    const result = await sdk.client.fetch<{ ok: true; kind: string }>(
      `/store/orders/${orderId}/delivery`,
      { method: "POST", body: { token, ...input } }
    )
    /*
     * Zahodit uloženou podobu stránek objednávky, ať návrat na potvrzení
     * (tlačítko Zpět) ukáže nový cíl.
     *
     * Samotné načtení objednávky (`retrieveOrder`) jde bez cache, takže server
     * by vykreslil čerstvě — jenže klientský router Nextu si drží už jednou
     * vykreslený RSC payload potvrzovací stránky a při zpětné navigaci ho
     * použije beze slova, bez ohledu na `staleTimes`. Nic ho k novému dotazu
     * nenutilo: tahle akce jen poslala POST a vrátila se. `revalidatePath`
     * uvnitř server action nastaví `pathWasRevalidated`, odpověď akce pak nese
     * znovu vykreslený strom a klient kvůli tomu celou router cache zahodí
     * (server-action-reducer: „server actions have to invalidate the entire
     * cache"). Zpět → chybí uzel → stránka se stáhne znovu.
     */
    for (const path of ORDER_PAGE_PATHS) revalidatePath(path, "page")
    return result
  } catch (error: any) {
    return { error: error?.message ?? "Doručení se nepodařilo změnit." }
  }
}
