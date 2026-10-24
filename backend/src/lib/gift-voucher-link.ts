import crypto from "crypto"
import { storefrontBase } from "./storefront-url"

/**
 * Podepsané odkazy na stránku poukazu — vzor `course-reservation-link.ts`.
 *
 * Stránku `/poukaz/:id` otevírá kupující z e-mailu s platebním odkazem
 * a obdarovaný z e-mailu s poukazem; ani jeden nemá účet. Token je HMAC id
 * pod tajemstvím serveru: nedá se uhodnout ani přenést na jiný poukaz.
 * Nevyprší — poukaz platí rok a odkaz má fungovat celou tu dobu.
 */
const secret = (): string => {
  const value = process.env.JWT_SECRET || process.env.COOKIE_SECRET
  if (!value) {
    throw new Error("Cannot sign a gift voucher link without JWT_SECRET or COOKIE_SECRET.")
  }
  return value
}

export const signGiftVoucherToken = (voucherId: string): string =>
  crypto.createHmac("sha256", secret()).update(`gift-voucher:${voucherId}`).digest("hex").slice(0, 32)

export const verifyGiftVoucherToken = (voucherId: string, token: unknown): boolean => {
  if (typeof token !== "string" || !token.length) return false
  const expected = signGiftVoucherToken(voucherId)
  const a = Buffer.from(expected)
  const b = Buffer.from(token)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/** Relativní cesta (ComGate návratové adresy, `url_paid`…). */
export const giftVoucherPath = (voucherId: string, outcome?: string): string => {
  const country = (process.env.STOREFRONT_COUNTRY || "cz").toLowerCase()
  const token = signGiftVoucherToken(voucherId)
  const suffix = outcome ? `&vysledek=${outcome}` : ""
  return `/${country}/poukaz/${voucherId}?token=${token}${suffix}`
}

/**
 * Absolutní odkaz pro tlačítka v e-mailech, nebo `""`, když chybí adresa
 * obchodu. `storefrontBase()` už končí kódem země (`…/cz`), proto se tu
 * skládá bez něj — jinak vznikne `/cz/cz/poukaz` (404).
 */
export const giftVoucherLink = (voucherId: string): string => {
  const base = storefrontBase()
  return base ? `${base}/poukaz/${voucherId}?token=${signGiftVoucherToken(voucherId)}` : ""
}
