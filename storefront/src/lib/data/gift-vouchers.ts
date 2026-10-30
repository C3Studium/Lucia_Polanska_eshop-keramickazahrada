"use server"

import { sdk } from "@lib/config"

/**
 * Stránka dárkového poukazu (`/[countryCode]/poukaz/[id]?token=…`) — vzor
 * `courses.ts` (rezervace kurzu). Přístup dokazuje podepsaný `token` z odkazu
 * v e-mailu; bez platného tokenu backend vrací 404 a tady je z toho `null`.
 *
 * Peníze ani stav se tu nepočítají: zůstatek, stav a možnost platit online
 * posílá backend (`serializePublicVoucher`), kód poukazu jen po zaplacení.
 */

export type GiftVoucherState =
  | "pending_payment"
  | "active"
  | "used"
  | "expired"
  | "cancelled"
  /** Peníze za poukaz se vrátily — spotřebovaný natrvalo. */
  | "refunded"

export type PublicGiftVoucher = {
  id: string
  /** `null`, dokud poukaz není zaplacený. */
  code: string | null
  kind: "physical" | "electronic"
  initial_value: number
  balance: number
  currency_code: string
  valid_until: string
  /** Datum konce platnosti česky („24. 10. 2027"), formátované backendem. */
  valid_until_label: string
  recipient_name: string | null
  dedication: string | null
  buyer_name: string | null
  payment_method: "cash" | "transfer" | "comgate" | "order"
  payment_status: "pending" | "paid"
  can_pay_online: boolean
  state: GiftVoucherState
  state_label: string
}

/**
 * Chyby z backendu jsou česky a pro zákazníka; chyby přenosu anglicky
 * a interní. Ukázat ty první, ty druhé nahradit.
 */
const readableMessage = (error: unknown, fallback: string): string => {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message || "").trim()
      : ""
  const looksInternal =
    !message ||
    message.length < 4 ||
    /internal|unauthorized|forbidden|not allowed|fetch|network|unexpected|error/i.test(
      message
    )
  return looksInternal ? fallback : message
}

/** Poukaz pro držitele podepsaného odkazu; špatný token / neexistující id = `null`. */
export const getGiftVoucher = async (
  voucherId: string,
  token: string
): Promise<PublicGiftVoucher | null> =>
  sdk.client
    .fetch<{ gift_voucher: PublicGiftVoucher }>(
      `/store/gift-vouchers/${encodeURIComponent(voucherId)}?token=${encodeURIComponent(token)}`,
      { cache: "no-store" }
    )
    .then(({ gift_voucher }) => gift_voucher ?? null)
    .catch(() => null)

/**
 * Poukaz jako PDF — tatáž kartička, jaká chodí e-mailem. Backend ji vystaví
 * a vrátí adresu v úložišti, takže stažení už nepotřebuje token ani klíč
 * obchodu a odkaz jde přeposlat obdarovanému.
 *
 * Nezaplacený nebo zrušený poukaz se nevystavuje (backend vrátí 409) —
 * odtud přijde `null` a tlačítko se neukáže.
 */
export const getGiftVoucherPdfUrl = async (
  voucherId: string,
  token: string
): Promise<string | null> =>
  sdk.client
    .fetch<{ url: string }>(
      `/store/gift-vouchers/${encodeURIComponent(voucherId)}/pdf?token=${encodeURIComponent(token)}`,
      { cache: "no-store" }
    )
    .then(({ url }) => url || null)
    .catch(() => null)

/**
 * Platební odkaz ComGate — „Zaplatit" i „Zkusit znovu". Backend je
 * idempotentní: platný odkaz vrátí beze změny, zrušená platba dostane nový.
 */
export const payGiftVoucher = async (
  voucherId: string,
  token: string
): Promise<{ payment_url?: string; message?: string }> =>
  sdk.client
    .fetch<{ payment_url: string }>(
      `/store/gift-vouchers/${encodeURIComponent(voucherId)}/pay?token=${encodeURIComponent(token)}`,
      { method: "POST", cache: "no-store" }
    )
    .catch((error: unknown) => ({
      message: readableMessage(
        error,
        "Platbu se teď nepodařilo založit. Zkuste to prosím za chvíli."
      ),
    }))
