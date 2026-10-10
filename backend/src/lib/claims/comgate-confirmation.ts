import type { RefundMethod } from "./refund-rules"

/**
 * Potvrzení refundu od ComGate (docs/reklamace-a-zruseni.md §13.4) — ČISTÉ
 * čtení z dat platby po `refundPaymentWorkflow`, dokazované testem.
 *
 * ## Odkud se bere
 *
 * ComGate refund je synchronní (`/refund.json`, kód 0 = přijato) a webhook
 * pro refund NEMÁ. Potvrzení je tedy odpověď na ten jeden požadavek — a tu
 * provider (`modules/comgate/service.refundPayment`) zapíše do dat relace:
 * `lastRefundIdempotencyKey` (= `refId`), `lastRefundRequestedAt`,
 * `refundedAmountMinor` (součet vráceného na platbě), `test`, a čerstvý
 * `providerStatus` z `retrieveDetails`, které volá těsně před refundem.
 * Modul plateb pak `payment.data` přepíše (`refundPaymentFromProvider_`),
 * takže po workflow stačí platbu přečíst.
 *
 * ## Proč je `refId` id řádku refundace Medusy
 *
 * `refundPaymentWorkflow` žádný vlastní `context.idempotency_key` nebere —
 * modul plateb ho providerovi posílá sám jako `refund.id` (řádek
 * `payment_refund`). Náš klíč `refunds[].id` (`<žádost>:<pořadí>`) tedy do
 * ComGate neputuje; spojení je `provider_ref` = `refId` = Medusa refund id,
 * uložené na záznamu refundace. Nová `retrieveDetails` po refundu se nevolá:
 * metoda je privátní na provideru v kontejneru modulu plateb a ComGate v
 * detailu platby refundovanou částku stejně nevrací — `refundedAmountMinor`
 * je běžný součet provideru z dat relace.
 */

export type ProviderConfirmation = {
  provider: RefundMethod
  /** refId u ComGate (= Medusa refund id); u více plateb spojené čárkou. */
  provider_ref: string | null
  provider_confirmed_at: string | null
  provider_test: boolean | null
  /** Součet vráceného na dotčených platbách podle dat relace (hlavní jednotky). */
  provider_refunded_total: number | null
  provider_status: string | null
}

const truthy = (value: unknown): boolean =>
  value === true ||
  ["1", "true", "yes", "on"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase()
  )

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null

export const manualConfirmation = (now: Date): ProviderConfirmation => ({
  provider: "manual",
  provider_ref: null,
  provider_confirmed_at: now.toISOString(),
  provider_test: null,
  provider_refunded_total: null,
  provider_status: null,
})

/**
 * Z dat relací dotčených plateb (po refundu) poskládá potvrzení. Platba bez
 * dat (nečitelná) se přeskočí; když nic nečte, `provider_ref` je null a
 * admin ukáže „ComGate přijal" bez reference — peníze odešly tak jako tak.
 */
export const comgateConfirmationOf = (
  payments: Array<Record<string, unknown> | null | undefined>,
  now: Date
): ProviderConfirmation => {
  const refs: string[] = []
  let confirmedAt: string | null = null
  let test: boolean | null = null
  let refunded = 0
  let sawRefunded = false
  let status: string | null = null

  for (const data of payments) {
    if (!data) continue
    const ref = text(data.lastRefundIdempotencyKey)
    if (ref && !refs.includes(ref)) refs.push(ref)
    const at = text(data.lastRefundRequestedAt)
    if (at && (!confirmedAt || at > confirmedAt)) confirmedAt = at
    if (data.test !== undefined) test = truthy(data.test) || test === true
    const minor = Number(data.refundedAmountMinor)
    if (Number.isFinite(minor) && minor >= 0) {
      refunded += minor / 100
      sawRefunded = true
    }
    status = text(data.providerStatus) ?? text(data.provider_status) ?? status
  }

  return {
    provider: "comgate",
    provider_ref: refs.length ? refs.join(", ") : null,
    provider_confirmed_at: confirmedAt ?? now.toISOString(),
    provider_test: test,
    provider_refunded_total: sawRefunded ? Math.round(refunded * 100) / 100 : null,
    provider_status: status,
  }
}

/** „ComGate přijal (ref …, test)" — do hlášky i protokolu. */
export const providerConfirmationText = (confirmation: ProviderConfirmation | null): string | null => {
  if (!confirmation || confirmation.provider !== "comgate") return null
  const parts = [
    confirmation.provider_ref ? `ref ${confirmation.provider_ref}` : null,
    confirmation.provider_test ? "test" : null,
  ].filter(Boolean)
  return `ComGate přijal${parts.length ? ` (${parts.join(", ")})` : ""}`
}
