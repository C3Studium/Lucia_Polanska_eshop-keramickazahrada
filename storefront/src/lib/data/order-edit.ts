"use server"

import { sdk } from "@lib/config"
import type { BalikovnaPoint } from "@lib/util/balikovna"
import { revalidateOrderPages } from "@lib/util/order-pages"
import { getAuthHeaders } from "./cookies"

/**
 * Úprava objednávky — typy rozhraní a zákaznická (přihlášená) cesta.
 *
 * Od 11. 10. 2026 (plán `docs/uprava-objednavky-plan.md` §5) jede úprava
 * položek JEDNOU cestou pro hosta i účet: přes podepsaný token objednávky
 * (`guest-order-edit.ts`). Přihlášený zákazník bez tokenu si ho tady vyzvedne
 * (`access_token` v kontextu, jen vlastníkovi) a pokračuje tokenovou cestou.
 * Pravidla soudí server; tady se jen ptáme a posíláme.
 */

/* ─── Kontrakt §5 — drží se doslova, nic nepřidávat ani neubírat ─────────── */

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

export type EditVariant = {
  id: string
  title: string | null
  price_czk: number | null
  available: boolean
}

/** Proč řádek nejde upravit: zakázka (chat), balíček (celek), poškozený kus. */
export type EditItemLock = "made_to_order" | "bundle" | "clearance"

export type EditableItem = {
  id: string
  title: string
  product_title: string | null
  variant_title: string | null
  thumbnail: string | null
  product_id: string | null
  product_handle: string | null
  variant_id: string | null
  quantity: number
  unit_price: number
  total: number
  lock: EditItemLock | null
  /** Česká věta pro šedý řádek. */
  lock_reason: string | null
  /** Zpětná kompatibilita — totéž co `lock === "made_to_order"`. */
  is_made_to_order: boolean
  /** Strop stepperu (sklad / 99). */
  max_quantity: number
  variants: EditVariant[]
}

export type OrderEditMode = "full" | "swap_only" | "none"

export type OrderEditContext = {
  /** `mode !== "none" && !limit_reached` */
  editable: boolean
  mode: OrderEditMode
  /** `= mode === "swap_only"` (zpětná kompatibilita). */
  swap_only: boolean
  /** Proč nejde (none / limit / čistá zakázka). */
  reason: string | null
  /** `false` u čisté zakázky se zálohou (§3c.7). */
  items_editable: boolean
  /** `mode === "full" && items_editable` */
  can_add: boolean
  payment: "card" | "pickup" | "dobirka"
  currency_code: string
  order: {
    id: string
    display_id: number
    item_total: number
    shipping_total: number
    total: number
  }
  delivery: OrderDeliveryContext
  items: EditableItem[]
  pending_change: { id: string; awaiting_payment: boolean } | null
  edits: { confirmed: number; limit: number; remaining: number }
}

/** Max 1 akce na řádek, max 30 akcí. */
export type EditAction =
  | { type: "swap"; item_id: string; variant_id: string }
  | { type: "remove"; item_id: string }
  /** 1–99 */
  | { type: "set_quantity"; item_id: string; quantity: number }
  /** 1–20 */
  | { type: "add"; variant_id: string; quantity: number }

export type EditPreview = {
  item_total_before: number
  item_total_after: number
  shipping_before: number
  shipping_after: number
  total_before: number
  total_after: number
  /** `total_after − total_before` */
  difference: number
  settlement: { kind: "none" | "collect" | "refund_due"; amount: number }
  /** Co se stane s penězi, česky. */
  money_sentence: string
  /** „Poštovné 90 Kč → 0 Kč." / null */
  shipping_note: string | null
  /** „Slevový kód … se na doplněné kusy nevztahuje." / null */
  promo_note: string | null
}

/** Odpověď na `dry_run: true` — nic se neuložilo. */
export type EditPreviewResponse = { status: "preview"; preview: EditPreview }

/** Odpověď na uložení: karta + dráž → platba; jinak potvrzeno. */
export type EditResult =
  | {
      status: "awaiting_payment"
      preview: EditPreview
      payment_url: string
      message: string
    }
  | {
      status: "confirmed"
      preview: EditPreview
      message: string
      /** Levněji na kartu → založená žádost v modulu Reklamace a zrušení. */
      claim_request_id: string | null
    }

/** Mini obchod úpravy — jen produkty a varianty, které jde přidat. */
export type OrderEditCatalog = {
  can_add: boolean
  reason: string | null
  payment: "card" | "pickup" | "dobirka"
  /** product_id → variant_id[] */
  allowed: Record<string, string[]>
}

/* ─── Přihlášená cesta ───────────────────────────────────────────────────── */

/**
 * Kontext úpravy pro přihlášeného zákazníka (`GET /store/orders/:id/edit`).
 * Navíc nese `access_token` (jen vlastníkovi) — s ním stránka úpravy
 * přesměruje na tokenovou cestu, kterou jede host i účet.
 */
export async function getOrderEditContext(
  orderId: string
): Promise<(OrderEditContext & { access_token?: string | null }) | null> {
  try {
    return await sdk.client.fetch<
      OrderEditContext & { access_token?: string | null }
    >(`/store/orders/${orderId}/edit`, {
      headers: { ...(await getAuthHeaders()) },
      cache: "no-store",
    })
  } catch {
    return null
  }
}

/* ─── Změna doručení ─────────────────────────────────────────────────────── */

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
    revalidateOrderPages()
    return result
  } catch (error: any) {
    return { error: error?.message ?? "Doručení se nepodařilo změnit." }
  }
}
