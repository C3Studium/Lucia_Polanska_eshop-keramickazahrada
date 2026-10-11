"use server"

import { sdk } from "@lib/config"
import { revalidateOrderPages } from "@lib/util/order-pages"
import type {
  EditAction,
  EditPreviewResponse,
  EditResult,
  OrderEditCatalog,
  OrderEditContext,
} from "./order-edit"

/**
 * Úprava objednávky přes **podepsaný token** (`?token=`) — jediná cesta pro
 * hosta z e-mailu i přihlášeného zákazníka (ten si token vyzvedne v
 * `getOrderEditContext`). Posílá se BEZ auth hlaviček (jen publishable key přes
 * SDK) a token jde v query/body; backend ho ověří (`verifyOrderAccessToken`) a
 * pravidla soudí sám. Tvary odpovědí viz `docs/uprava-objednavky-plan.md` §5.
 */

/**
 * Hláška pro zákazníka z chyby SDK. Chyba pravidla (400/403/409/422) nese
 * českou `message` ze serveru — tu ukážeme. Cokoli jiného (výpadek, 404 při
 * nasazování, síť) má anglickou nebo technickou hlášku, takže radši vlastní věta.
 */
const customerMessage = (error: any, fallback: string) => {
  const status = Number(error?.status)
  if ([400, 403, 409, 422].includes(status) && error?.message) {
    return String(error.message)
  }
  return fallback
}

export async function getGuestOrderEditContext(
  orderId: string,
  token: string
): Promise<OrderEditContext | null> {
  try {
    return await sdk.client.fetch<OrderEditContext>(
      `/store/orders/${orderId}/guest-edit`,
      { query: { token }, cache: "no-store" }
    )
  } catch {
    return null
  }
}

/**
 * Náhled úpravy (`dry_run: true`) — server úpravu v Meduse založí, spočítá a
 * hned zahodí, nic se neuloží. Volá se s odstupem po každé změně v UI; proto
 * bez `revalidateOrderPages` — náhled stránky nemění a zahození router cache po
 * každém kliknutí na stepper by jen zdržovalo.
 */
export async function previewGuestOrderEdit(
  orderId: string,
  actions: EditAction[],
  token: string
): Promise<EditPreviewResponse | { error: string }> {
  try {
    return await sdk.client.fetch<EditPreviewResponse>(
      `/store/orders/${orderId}/guest-edit`,
      {
        method: "POST",
        body: { token, actions, dry_run: true },
        cache: "no-store",
      }
    )
  } catch (error: any) {
    return {
      error: customerMessage(
        error,
        "Rozdíl ceny se teď nepodařilo spočítat. Zkuste to prosím za chvíli znovu."
      ),
    }
  }
}

/**
 * Uložení úpravy. Karta + dráž → `awaiting_payment` s odkazem na platbu;
 * jinak `confirmed` (levněji na kartu navíc s `claim_request_id` — žádost
 * o vrácení rozdílu v modulu Reklamace a zrušení).
 */
export async function submitGuestOrderEdit(
  orderId: string,
  actions: EditAction[],
  token: string
): Promise<EditResult | { error: string }> {
  try {
    const result = await sdk.client.fetch<EditResult>(
      `/store/orders/${orderId}/guest-edit`,
      { method: "POST", body: { token, actions }, cache: "no-store" }
    )
    /* Objednávka se změnila (nebo na ni čeká platba) — stránky, které ji
       vykreslují, se musí vykreslit znovu. Proč tudy, viz `changeOrderDelivery`. */
    revalidateOrderPages()
    return result
  } catch (error: any) {
    return {
      error: customerMessage(
        error,
        "Úpravu se nepodařilo uložit. Zkuste to prosím znovu, nebo nám napište na info@keramickazahrada.cz."
      ),
    }
  }
}

/** Zruší čekající změnu (`DELETE`) — objednávka zůstane, jak byla. */
export async function cancelGuestOrderEdit(
  orderId: string,
  token: string
): Promise<void> {
  try {
    await sdk.client.fetch(`/store/orders/${orderId}/guest-edit`, {
      method: "DELETE",
      query: { token },
    })
    revalidateOrderPages()
  } catch {
    // rušení je best-effort
  }
}

/**
 * Mini obchod úpravy: které produkty a varianty jde k objednávce přidat
 * (bez zakázek, balíčků, poškozených kusů, vyprodaných bez backorderu; u
 * dobírky jen `cod_allowed`). Produkty samotné si storefront načte běžným
 * výpisem a ukáže jen ty z `allowed` — server je soudce i při uložení.
 */
export async function getGuestOrderEditCatalog(
  orderId: string,
  token: string
): Promise<OrderEditCatalog | null> {
  try {
    return await sdk.client.fetch<OrderEditCatalog>(
      `/store/orders/${orderId}/guest-edit/catalog`,
      { query: { token }, cache: "no-store" }
    )
  } catch {
    return null
  }
}
