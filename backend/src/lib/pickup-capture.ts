/**
 * „Objednávka zaplacena" — zápis peněz, které zákazník nechal u pultu.
 *
 * ## Proč zvlášť od „Vyzvednuto"
 *
 * Osobní odběr dosud uměl jedinou věc: „Vyzvednuto a zaplaceno", tedy peníze
 * A zboží jedním kliknutím (`workflows/complete-personal-pickup.ts`). V dílně
 * to ale často nejde v jedné chvíli — zákazník zaplatí dopředu převodem nebo
 * zaplatí hotově a kus si odveze později. Do té doby nebylo kam platbu zapsat:
 * objednávka visela jako „Autorizováno" a faktura nevznikla.
 *
 * Tohle je ta chybějící půlka. Zachytí autorizovanou platbu „zaplatíte při
 * vyzvednutí" (`pp_osobni-odber_pickup`, modul `pickupPayment`) a tím zapne
 * všechno, co na zachycení visí, aniž by o tomhle tlačítku cokoli vědělo:
 * stav platby, statistiky, brána odeslání i faktura v iDokladu, kterou
 * zákazník dostane e-mailem (`subscribers/idoklad-invoice.ts`).
 *
 * Stejný tvar má „Peníze přišly (dobírka)" (`lib/dobirka-capture.ts`) — taky
 * jen zachycení platby, která se autorizovala u pokladny a skutečné peníze
 * přišly jinudy. Dvě tlačítka, dva poskytovatelé, jeden princip.
 *
 * ## Co tohle NEUMÍ
 *
 * Dluh BEZ platby, kterou by šlo zachytit — typicky nezaplacený doplatek
 * zakázky (druhá kolekce `not_paid` bez platby, změřeno na #31) — se zapisuje
 * tlačítkem „Zaplaceno na místě" v panelu zakázky (`lib/balance-settlement.ts`),
 * protože k němu patří vlastní faktura a vlastní e-mail. Tady se takový případ
 * pozná a pošle tam, místo aby tiše neudělal nic.
 *
 * ## Dvakrát kliknout nevadí
 *
 * Zachycená (nebo zrušená) platba je přátelské „už je to zapsané", ne chyba.
 */

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { capturePaymentWorkflow } from "@medusajs/medusa/core-flows"
import { isPersonalPickupOrder } from "./personal-pickup"
import { epsilonFor, isPayLaterPaymentProvider, toAmount } from "./ship-gate"

/** Kolekce, které nic nedluží — stejné stavy jako brána odeslání. */
const SETTLED_COLLECTION_STATUSES = ["canceled", "failed"]

export type PickupPaymentPick = {
  /** Objednávka se vyzvedává osobně. */
  is_pickup: boolean
  /** Autorizovaná, dosud nezachycená platba u pultu — když existuje. */
  payment_id: string | null
  /** Osobní odběr, ale všechny platby jsou zachycené nebo zrušené. */
  already: boolean
  /** Kolik na objednávce zbývá (kolekce − zachyceno), zaokrouhleno na měnu. */
  amount_due: number
}

/**
 * Čisté: najde platbu u pultu, která ještě čeká na peníze. Vytažené ven, aby
 * se hranice „co ještě zbývá" dala testovat bez kontejneru — a aby projekce
 * Denní práce ukazovala tlačítko přesně na ty objednávky, které tahle funkce
 * pustí dál.
 */
export const pickPickupPayment = (order: any): PickupPaymentPick => {
  if (!isPersonalPickupOrder(order)) {
    return { is_pickup: false, payment_id: null, already: false, amount_due: 0 }
  }

  const collections = ((order?.payment_collections ?? []) as any[]).filter(
    (collection: any) =>
      !SETTLED_COLLECTION_STATUSES.includes(String(collection?.status ?? ""))
  )

  const amountDue = collections.reduce(
    (sum: number, collection: any) =>
      sum + (toAmount(collection?.amount) - toAmount(collection?.captured_amount)),
    0
  )

  /*
   * Jen platby „zaplatíte při vyzvednutí" (a dobírka, která se k pultu dostat
   * nemůže, ale pravidlo je jedno): zachytit rozdělanou kartu z brány by
   * znamenalo strhnout peníze, které zákazník u pultu zaplatil hotově.
   */
  const open = collections
    .flatMap((collection: any) => collection?.payments ?? [])
    .find(
      (payment: any) =>
        isPayLaterPaymentProvider(payment?.provider_id) &&
        !payment?.captured_at &&
        !payment?.canceled_at
    )

  return {
    is_pickup: true,
    payment_id: open?.id ?? null,
    already: !open && amountDue <= epsilonFor(order?.currency_code),
    amount_due: amountDue,
  }
}

export type PickupCaptureResult =
  | { outcome: "captured"; payment_id: string; display_id: number | string | null }
  | { outcome: "already"; display_id: number | string | null }
  | { outcome: "not_pickup"; display_id: number | string | null }
  | {
      outcome: "needs_manual"
      amount_due: number
      currency_code: string | null
      display_id: number | string | null
    }
  | { outcome: "not_found" }

export type PickupCaptureRunner = (input: {
  payment_id: string
  captured_by?: string
}) => Promise<unknown>

export const PICKUP_ORDER_FIELDS = [
  "id",
  "display_id",
  "currency_code",
  "shipping_methods.data",
  "shipping_methods.shipping_option.provider_id",
  "payment_collections.status",
  "payment_collections.amount",
  "payment_collections.captured_amount",
  "payment_collections.payments.id",
  "payment_collections.payments.provider_id",
  "payment_collections.payments.captured_at",
  "payment_collections.payments.canceled_at",
]

/**
 * Zapíše peníze z pultu, právě jednou, celou částku.
 *
 * `runCapture` je jen švík pro testy; v provozu se nepředává a jede nativní
 * `capturePaymentWorkflow`.
 */
export const capturePickupPayment = async (
  container: MedusaContainer,
  orderId: string,
  options: { capturedBy?: string | null; runCapture?: PickupCaptureRunner } = {}
): Promise<PickupCaptureResult> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: PICKUP_ORDER_FIELDS,
    filters: { id: orderId },
  })
  const order = orders[0] as any
  if (!order) {
    return { outcome: "not_found" }
  }

  const picked = pickPickupPayment(order)
  if (!picked.is_pickup) {
    return { outcome: "not_pickup", display_id: order.display_id ?? null }
  }
  if (!picked.payment_id) {
    return picked.already
      ? { outcome: "already", display_id: order.display_id ?? null }
      : {
          outcome: "needs_manual",
          amount_due: picked.amount_due,
          currency_code: order.currency_code ?? null,
          display_id: order.display_id ?? null,
        }
  }

  const run: PickupCaptureRunner =
    options.runCapture ??
    (async (input) => {
      await capturePaymentWorkflow(container).run({ input })
    })

  await run({
    payment_id: picked.payment_id,
    captured_by: options.capturedBy ?? undefined,
  })

  logger.info(
    `[odber] Objednávka #${order.display_id ?? order.id}: platba na místě zapsaná jako přijatá.`
  )

  return {
    outcome: "captured",
    payment_id: picked.payment_id,
    display_id: order.display_id ?? null,
  }
}
