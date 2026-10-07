import crypto from "crypto"
import { storefrontBase } from "./storefront-url"

/**
 * Signed links that let a customer open ONE order's self-service pages — editace
 * (`/order/:id/edit`) a reklamace/vrácení/odstoupení (`/order/:id/refund`) — z
 * e-mailu, i když není přihlášený (většina objednávek je hostů).
 *
 * Stejný princip jako „doplatit" odkaz (`balance-payment-link.ts`): token je HMAC
 * čísla objednávky pod serverovým tajemstvím. Nehádatelný, bez nové DB sloupce,
 * nepřenosný na jinou objednávku (změň id → podpis nesedí). Jeden token na
 * objednávku odemkne obě stránky — příjemce e-mailu je zákazník té objednávky.
 *
 * NEEXPIRUJE schválně: co jde na stránce opravdu udělat, hlídají až samotné
 * endpointy (editace jen ve fázi received/working bez expedice; reklamace má
 * vlastní pravidla). Token je jen „tenhle člověk dostal tenhle odkaz".
 *
 * Bezpečnostní poznámka pro endpointy: KAŽDÝ token-auth endpoint si musí znovu
 * ověřit `verifyOrderAccessToken(orderId, token)` a řídit se stávajícími pravidly
 * (order-edit-rules atd.) — token NEOBCHÁZÍ obchodní logiku, jen přihlášení.
 */

const secret = (): string => {
  // Totéž tajemství, kterému server už věří pro session. Když chybí, proces by
  // nenaběhl (asserto v `lib/constants`).
  const value = process.env.JWT_SECRET || process.env.COOKIE_SECRET
  if (!value) {
    throw new Error(
      "Cannot sign an order-access link without JWT_SECRET or COOKIE_SECRET."
    )
  }
  return value
}

export const signOrderAccessToken = (orderId: string): string =>
  crypto
    .createHmac("sha256", secret())
    .update(`order-access:${orderId}`)
    .digest("hex")
    .slice(0, 32)

/** Constant-time compare, aby token nešel uhádnout po znacích. */
export const verifyOrderAccessToken = (
  orderId: string,
  token: unknown
): boolean => {
  if (typeof token !== "string" || !token.length) {
    return false
  }
  const expected = signOrderAccessToken(orderId)
  const given = Buffer.from(token)
  const wanted = Buffer.from(expected)

  if (given.length !== wanted.length) {
    return false
  }
  return crypto.timingSafeEqual(given, wanted)
}

/**
 * Absolutní URL na storefront stránku editace objednávky s tokenem — do e-mailu.
 * Míří na storefront (je to stránka), ne na backend. Prázdné, když storefront
 * není nakonfigurovaný (volající pak tlačítko nevykreslí).
 */
export const orderEditUrl = (orderId: string): string => {
  const base = storefrontBase()
  return base && orderId
    ? `${base}/order/${orderId}/edit?token=${signOrderAccessToken(orderId)}`
    : ""
}

/**
 * Absolutní URL na storefront stránku reklamace / vrácení / odstoupení od
 * smlouvy s tokenem — do e-mailu.
 */
export const orderRefundUrl = (orderId: string): string => {
  const base = storefrontBase()
  return base && orderId
    ? `${base}/order/${orderId}/refund?token=${signOrderAccessToken(orderId)}`
    : ""
}

/**
 * Absolutní URL na stránku „stav reklamace / vrácení" (`/order/:id/claims`) —
 * časová osa žádosti, protokol, číslo vrácené zásilky. Do e-mailů modulu
 * reklamací (potvrzení přijetí, schválení, přijetí zboží, vyřízení).
 */
export const orderClaimsUrl = (orderId: string): string => {
  const base = storefrontBase()
  return base && orderId
    ? `${base}/order/${orderId}/claims?token=${signOrderAccessToken(orderId)}`
    : ""
}
