/**
 * Single source of truth for the merchant workflow stages.
 *
 * These stages are deliberately *not* a copy of Medusa's order lifecycle. Medusa owns
 * `status`, `payment_status` and `fulfillment_status`; this enum only answers the
 * merchant-facing question "what should I do with this order next?". Everything that
 * touches money or stock is delegated to native workflows.
 */
export const MERCHANT_ORDER_STAGES = [
  "received",
  "working",
  "shipping",
  "shipped",
  "payment_problem",
  "cancelled",
] as const

export type MerchantOrderStage = (typeof MERCHANT_ORDER_STAGES)[number]

/**
 * Stages the merchant actively works through, in the order they appear in the sidebar.
 * `cancelled` is intentionally excluded — it is an outcome, not a queue.
 */
export const MERCHANT_ORDER_ACTIVE_STAGES: MerchantOrderStage[] = [
  "received",
  "working",
  "shipping",
  "shipped",
  "payment_problem",
]

/**
 * Allowed stage transitions. Kept byte-for-byte identical to the pre-refactor table so
 * this extraction stays behaviour-neutral; loosening it is a separate, deliberate change.
 *
 * `received → shipping` povoleno vědomě (13. 11. 2026): osobní odběr nabízí u nové
 * objednávky rovnou „Připraveno k vyzvednutí" (detail objednávky i fronta Denní
 * práce), ale tabulka chtěla mezikrok „working", takže tlačítko vracelo 400
 * „Objednávku nelze přesunout ze stavu received do stavu shipping" a novou
 * objednávku k vyzvednutí nešlo připravit vůbec. Proskočit přes „working" v routě
 * by zákazníkovi poslalo dva e-maily naráz.
 */
export const MERCHANT_ORDER_STAGE_TRANSITIONS: Record<
  MerchantOrderStage,
  MerchantOrderStage[]
> = {
  received: ["working", "shipping", "payment_problem", "cancelled"],
  working: ["shipping", "payment_problem", "cancelled"],
  shipping: ["shipped", "payment_problem", "cancelled"],
  shipped: [],
  payment_problem: ["received", "working", "cancelled"],
  cancelled: [],
}

export const isMerchantOrderStage = (
  value: unknown
): value is MerchantOrderStage =>
  typeof value === "string" &&
  MERCHANT_ORDER_STAGES.includes(value as MerchantOrderStage)
