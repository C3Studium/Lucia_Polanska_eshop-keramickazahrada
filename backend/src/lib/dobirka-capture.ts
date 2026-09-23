/**
 * Recording that the dobírka money actually arrived — the one capture core
 * shared by the admin button („Peníze přišly") and the iDoklad webhook.
 *
 * ## What "capture" means here
 *
 * The dobírka provider (`modules/dobirkaPayment`) authorizes at checkout and
 * never captures on its own: the carrier holds the money until Česká pošta
 * settles it to the owner's account. Its `capturePayment` charges nothing —
 * it only writes `collected: true` into the payment data. So running Medusa's
 * native `capturePaymentWorkflow` on the authorized payment is the entire
 * operation: the ledger flips to captured, `payment_status` becomes
 * `captured`, the workbench money math sees the amount, and the
 * `payment.captured` subscriber records the invoice as paid in iDoklad.
 *
 * ## Idempotence
 *
 * A dobírka payment that is already captured (or canceled) is a friendly
 * no-op — the second click, or a redelivered webhook, changes nothing.
 */

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { capturePaymentWorkflow } from "@medusajs/medusa/core-flows"
import { DOBIRKA_PROVIDER_ID } from "./ship-gate"

export type DobirkaPaymentPick = {
  /** The order pays (at least partly) by dobírka. */
  is_dobirka: boolean
  /** The authorized-but-uncaptured dobírka payment, when one exists. */
  payment_id: string | null
  /** Dobírka, but every dobírka payment is already captured or canceled. */
  already: boolean
}

/**
 * Pure: finds the dobírka payment still waiting for its money. Exported so
 * the idempotence boundary is testable without a container.
 */
export const pickDobirkaPayment = (order: any): DobirkaPaymentPick => {
  const payments = ((order?.payment_collections ?? []) as any[])
    .flatMap((collection: any) => collection?.payments ?? [])
    .filter((payment: any) => payment?.provider_id === DOBIRKA_PROVIDER_ID)

  if (!payments.length) {
    return { is_dobirka: false, payment_id: null, already: false }
  }

  const open = payments.find(
    (payment: any) => !payment?.captured_at && !payment?.canceled_at
  )

  return {
    is_dobirka: true,
    payment_id: open?.id ?? null,
    already: !open,
  }
}

export type DobirkaCaptureResult =
  | { outcome: "captured"; payment_id: string; display_id: number | string | null }
  | { outcome: "already"; display_id: number | string | null }
  | { outcome: "not_dobirka"; display_id: number | string | null }
  | { outcome: "not_found" }

export type CaptureRunner = (input: {
  payment_id: string
  captured_by?: string
}) => Promise<unknown>

/**
 * Captures the order's dobírka payment, exactly once, full amount only.
 *
 * `runCapture` exists as a seam for unit tests; production callers leave it
 * unset and get the native `capturePaymentWorkflow`.
 */
export const captureDobirkaPayment = async (
  container: MedusaContainer,
  orderId: string,
  options: { capturedBy?: string | null; runCapture?: CaptureRunner } = {}
): Promise<DobirkaCaptureResult> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "payment_collections.payments.id",
      "payment_collections.payments.provider_id",
      "payment_collections.payments.captured_at",
      "payment_collections.payments.canceled_at",
    ],
    filters: { id: orderId },
  })
  const order = orders[0] as any
  if (!order) {
    return { outcome: "not_found" }
  }

  const picked = pickDobirkaPayment(order)
  if (!picked.is_dobirka) {
    return { outcome: "not_dobirka", display_id: order.display_id ?? null }
  }
  if (!picked.payment_id) {
    return { outcome: "already", display_id: order.display_id ?? null }
  }

  const run: CaptureRunner =
    options.runCapture ??
    (async (input) => {
      await capturePaymentWorkflow(container).run({ input })
    })

  await run({
    payment_id: picked.payment_id,
    captured_by: options.capturedBy ?? undefined,
  })

  logger.info(
    `[dobirka] Objednávka #${order.display_id ?? order.id}: peníze z dobírky zapsané jako přijaté.`
  )

  return {
    outcome: "captured",
    payment_id: picked.payment_id,
    display_id: order.display_id ?? null,
  }
}
