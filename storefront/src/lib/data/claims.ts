"use server"

import { sdk } from "@lib/config"
import type {
  ClaimConfirmation,
  ClaimDamageCause,
  ClaimItemInput,
  ClaimKind,
  ClaimRequestedResolution,
  OrderClaims,
} from "@lib/util/claims"
import type { CommissionUpload } from "@lib/util/made-to-order"
import { toCzechErrorMessage } from "@lib/util/error-messages"

/**
 * Reklamace a zrušení — tenká vrstva nad `/store/orders/:id/claims`
 * (kontrakt `docs/reklamace-a-zruseni.md` §4). Autorizace = podepsaný token
 * z e-mailového odkazu / `getOrderAccessToken`, proto BEZ auth hlaviček (jen
 * publishable key, který doplní SDK). Pravidla (§1837, lhůta 14 d, jedna
 * otevřená žádost, povinné „co požadujete" u reklamace) soudí server; tady se
 * jen ptáme, posíláme a překládáme chybu do češtiny.
 */

export type { OrderClaims }

export async function getOrderClaims(
  orderId: string,
  token: string
): Promise<OrderClaims | null> {
  try {
    return await sdk.client.fetch<OrderClaims>(
      `/store/orders/${orderId}/claims`,
      { query: { token }, cache: "no-store" }
    )
  } catch {
    return null
  }
}

export type SubmitClaimInput = {
  kind: ClaimKind
  /**
   * Popis vady — povinný jen u `reklamace`. Odstoupení a vrácení ho nemají
   * (12. 10. 2026, Matěj); server pak uloží výchozí větu podle druhu.
   */
  reason?: string
  /** Povinné u `reklamace` (§19/1 ZOS) — jen výměna / vrácení peněz; server to vynucuje. */
  requested_resolution?: ClaimRequestedResolution
  /** Fotky vady (base64, max 6) — jen u reklamace. */
  photos?: CommissionUpload[]
  /**
   * Vybrané položky (§11.1): u `reklamace` i `vraceni` povinné (≥ 1); u
   * `odstoupeni` zboží, od jehož koupě se odstupuje (zakázku server vyjme
   * sám). Server ověří, že id patří objednávce a `quantity ≤ objednané`.
   * U balíčku (§13.5) může položka nést `components` — jen zaškrtnuté
   * komponenty; bez nich = celý balíček.
   */
  items?: ClaimItemInput[]
  /** Odstoupení: jméno z formuláře (předvyplněné, lze opravit). */
  customer_name?: string
  /**
   * `"carrier"` = poškozeno přepravou (§11.3), `"damaged"` = poškozený kus
   * (§13.7) → server u obou vyžaduje ≥ 1 fotku. Vada/nefunkčnost = neposílá se.
   */
  damage_cause?: ClaimDamageCause
  /**
   * Účet pro vrácení převodem — posílá se (i prázdný), když kontext řekne
   * `refund_account_needed` (objednávka nebyla placená kartou). Formát a
   * povinnost hlídá server (`refund-account.ts`).
   */
  refund_account?: string
}

export type SubmitClaimResult = {
  received: true
  id: string
  /**
   * §13.1 — nezaplaceno + neodesláno: server žádost rovnou schválil, vyřídil
   * a objednávku zrušil. Storefront pak neříká „posoudíme", ale „zrušeno".
   */
  auto_cancelled?: boolean
  /** Okamžik odeslání podle serveru (ISO). */
  submitted_at?: string
  /**
   * Obsah potvrzení s datem a časem odeslání — totéž, co odešlo e-mailem
   * (§ 1830a OZ). Starší backend ho neposílá.
   */
  confirmation?: ClaimConfirmation
}

export async function submitClaim(
  orderId: string,
  token: string,
  input: SubmitClaimInput
): Promise<SubmitClaimResult | { error: string }> {
  try {
    return await sdk.client.fetch<SubmitClaimResult>(
      `/store/orders/${orderId}/claims`,
      {
        method: "POST",
        body: {
          token,
          kind: input.kind,
          ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}),
          ...(input.requested_resolution
            ? { requested_resolution: input.requested_resolution }
            : {}),
          ...(input.photos?.length ? { photos: input.photos } : {}),
          ...(input.items?.length ? { items: input.items } : {}),
          ...(input.damage_cause ? { damage_cause: input.damage_cause } : {}),
          ...(input.refund_account !== undefined
            ? { refund_account: input.refund_account.trim() }
            : {}),
          ...(input.customer_name?.trim()
            ? { customer_name: input.customer_name.trim() }
            : {}),
        },
      }
    )
  } catch (error: any) {
    return { error: toCzechErrorMessage(error?.message) }
  }
}

/**
 * Číslo zásilky, kterou zákazník poslal zpět (jen ve stavu `approved`).
 */
export async function submitClaimTracking(
  orderId: string,
  token: string,
  claimId: string,
  tracking: string
): Promise<{ ok: true } | { error: string }> {
  try {
    await sdk.client.fetch(
      `/store/orders/${orderId}/claims/${claimId}/tracking`,
      { method: "POST", body: { token, tracking: tracking.trim() } }
    )
    return { ok: true }
  } catch (error: any) {
    return { error: toCzechErrorMessage(error?.message) }
  }
}
