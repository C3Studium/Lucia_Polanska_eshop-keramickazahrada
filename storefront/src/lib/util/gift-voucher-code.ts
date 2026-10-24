/**
 * Kód dárkového poukazu ve storefrontu.
 *
 * ZRCADLÍ `backend/src/modules/gift-voucher/code.ts` (abeceda, délka,
 * normalizace i tvar „XXXX XXXX") — když se změní tam, musí se změnit i tady.
 * O tom, jestli kód opravdu je poukaz, rozhoduje backend
 * (`GET /store/gift-voucher-codes/:code`); tady se podle tvaru jen poznává,
 * který z kódů uplatněných v košíku je poukaz a který slevový kód.
 */

/** Bez 0/O, 1/I/L a 5/S — kód se opisuje z papíru a diktuje do telefonu. */
const ALPHABET = "ABCDEFGHJKMNPQRTUVWXYZ2346789"

export const VOUCHER_CODE_LENGTH = 8

/** „7hq4 m2xp", „7HQ4-M2XP " → „7HQ4M2XP" (tvar v košíku i v databázi). */
export const normalizeVoucherCode = (raw: string | null | undefined): string =>
  String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")

/** Vypadá to jako kód poukazu (8 znaků z abecedy poukazů)? */
export const looksLikeVoucherCode = (raw: string | null | undefined): boolean => {
  const code = normalizeVoucherCode(raw)
  return (
    code.length === VOUCHER_CODE_LENGTH &&
    code.split("").every((c) => ALPHABET.includes(c))
  )
}

/** Pro čtení: „7HQ4 M2XP". Kopíruje se a do košíku posílá bez mezery. */
export const formatVoucherCode = (code: string | null | undefined): string => {
  const c = String(code ?? "")
  return c.length === VOUCHER_CODE_LENGTH ? `${c.slice(0, 4)} ${c.slice(4)}` : c
}

/**
 * Je produkt dárkový poukaz? Stejné pravidlo jako `isGiftVoucherProduct`
 * v `backend/src/lib/gift-voucher-orders.ts`: vlajka `gift_voucher`, nebo
 * poukaz s vlastní částkou (`voucher_custom_amount`, viz
 * `isCustomAmountVoucher` v `modules/products/components/voucher-amount`).
 */
export const isGiftVoucherProduct = (
  metadata: Record<string, unknown> | null | undefined
): boolean =>
  metadata?.gift_voucher === true ||
  metadata?.gift_voucher === "true" ||
  metadata?.voucher_custom_amount === true ||
  metadata?.voucher_custom_amount === "true"

/**
 * Klíče metadat položky košíku z formuláře poukazu — musí sedět
 * s `VOUCHER_LINE_KEYS` v `backend/src/lib/gift-voucher-orders.ts`.
 */
export const VOUCHER_LINE_KEYS = {
  kind: "gift_voucher_kind",
  recipientName: "gift_voucher_recipient_name",
  recipientEmail: "gift_voucher_recipient_email",
  dedication: "gift_voucher_dedication",
} as const

export type VoucherKind = "electronic" | "physical"

export const VOUCHER_DEDICATION_MAX = 500

/** Stejná kontrola e-mailu jako v backendu (`gift-voucher-orders.ts`). */
export const isValidVoucherEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

/** „Elektronický pro Janu · jana@example.cz" — popis položky v košíku. */
export const voucherLineSummary = (
  metadata: Record<string, unknown> | null | undefined
): string | null => {
  const kind = metadata?.[VOUCHER_LINE_KEYS.kind]
  if (kind !== "electronic" && kind !== "physical") return null
  const name = String(metadata?.[VOUCHER_LINE_KEYS.recipientName] ?? "").trim()
  const email = String(metadata?.[VOUCHER_LINE_KEYS.recipientEmail] ?? "").trim()
  const head = kind === "electronic" ? "Elektronický" : "Vytištěný"
  const withName = name ? `${head} pro ${name}` : head
  return kind === "electronic" && email ? `${withName} · ${email}` : withName
}

/**
 * Jak se v souhrnu ceny jmenuje řádek slevy. Poukaz je v Meduse slevová
 * akce, takže jeho částka sedí ve stejném součtu (`item_discount_total`) —
 * řádek „Sleva" by u poukazu tvrdil něco, co zákazník nečeká.
 * `null` = v košíku žádný poukaz, volající nechá svůj popisek.
 */
export const discountRowLabel = (
  promotions:
    | ReadonlyArray<{ code?: string | null; is_automatic?: boolean | null } | null | undefined>
    | null
    | undefined
): string | null => {
  const list = (promotions ?? []).filter(Boolean) as Array<{
    code?: string | null
    is_automatic?: boolean | null
  }>
  const isVoucher = (p: { code?: string | null; is_automatic?: boolean | null }) =>
    !p.is_automatic && looksLikeVoucherCode(p.code)
  if (!list.some(isVoucher)) return null
  return list.some((p) => !isVoucher(p)) ? "Sleva a dárkový poukaz" : "Dárkový poukaz"
}
