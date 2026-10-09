"use server"

import { sdk } from "@lib/config"
import type {
  ClaimDamageCause,
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
  reason: string
  /** Povinné u `reklamace` (§19/1 ZOS) — server to vynucuje. */
  requested_resolution?: ClaimRequestedResolution
  /** Fotky vady (base64, max 6) — jako dnes. */
  photos?: CommissionUpload[]
  /**
   * Vybrané položky (§11.1): u `reklamace` povinné (≥ 1), u `vraceni` volitelné
   * (prázdné = celá objednávka), u `odstoupeni` se neposílají. Server ověří, že
   * id patří objednávce a `quantity ≤ objednané`.
   */
  items?: { id: string; quantity: number }[]
  /** `"carrier"` = poškozeno přepravou (§11.3) → server vyžaduje ≥ 1 fotku. */
  damage_cause?: ClaimDamageCause
}

export async function submitClaim(
  orderId: string,
  token: string,
  input: SubmitClaimInput
): Promise<{ received: true; id: string } | { error: string }> {
  try {
    return await sdk.client.fetch<{ received: true; id: string }>(
      `/store/orders/${orderId}/claims`,
      {
        method: "POST",
        body: {
          token,
          kind: input.kind,
          reason: input.reason.trim(),
          ...(input.requested_resolution
            ? { requested_resolution: input.requested_resolution }
            : {}),
          ...(input.photos?.length ? { photos: input.photos } : {}),
          ...(input.items?.length ? { items: input.items } : {}),
          ...(input.damage_cause ? { damage_cause: input.damage_cause } : {}),
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
