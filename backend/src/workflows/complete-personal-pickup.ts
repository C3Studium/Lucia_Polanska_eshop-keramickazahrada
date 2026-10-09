import { MedusaError } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  capturePaymentWorkflow,
  completeOrderWorkflow,
  createOrderFulfillmentWorkflow,
  createOrderShipmentWorkflow,
  releaseLockStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { transitionMerchantOrderWorkflow } from "./transition-merchant-order"
import { toNumber } from "../lib/order-quantity"
import { formatMoney } from "../lib/ship-gate"
import {
  fulfillmentItemsOf,
  OUTSTANDING_ITEM_FIELDS,
  shipmentItemsOf,
} from "../lib/parcel-tracking/shipment-items"

/**
 * „Vyzvednuto a zaplaceno" — the customer collected the piece and paid at the
 * counter.
 *
 * ## Why personal collection needs its own action
 *
 * Every other order leaves through the dispatch flow, which is gated on the
 * money having already arrived (A2). Personal collection inverts that: the
 * money arrives *at the same moment* the goods leave, in cash, in her hand.
 * Running the ordinary flow would be impossible — the gate would refuse an
 * order that is about to be paid, correctly, forever.
 *
 * So this is one action that records both facts in the order they happen:
 *
 * 1. **capture the payment** — the customer has paid; until this the order
 *    holds only an authorization, a promise;
 * 2. **fulfil** — the goods leave stock;
 * 3. **ship** — Medusa's way of saying they are gone, which for a collection is
 *    true the instant she hands the bag over.
 *
 * Capture comes first deliberately. If it fails there is nothing to undo: the
 * piece is still on the shelf and the order is untouched. Doing it last would
 * mean handing over goods and *then* discovering the record could not be
 * written.
 *
 * ## It refuses to be used on anything else
 *
 * The validation step rejects orders that are not personal collection. Cash at
 * the counter is the one exception to „no money, no goods" (D1), and an
 * exception that can be applied to any order is not an exception — it is a
 * hole.
 *
 * ## Zámek: bez platby k zachycení a s dluhem se nevydává
 *
 * ZMĚŘENO 9. 10. 2026 na #31 (zakázka, osobní odběr): záloha zachycená přes
 * ComGate, doplatek = druhá kolekce `not_paid` BEZ platby. Krok 1 nenašel co
 * zachytit, tiše ho přeskočil a kroky 2–3 objednávku „odeslaly" s 3 225 Kč
 * nezaplacenými. Výjimka D1 platí pro autorizovanou platbu u pultu (je co
 * zachytit) — ne pro dluh, který nemá žádnou platbu. Ten se nejdřív zapíše
 * tlačítkem „Zaplaceno na místě" v panelu zakázky (lib/balance-settlement),
 * teprve pak jde vydat.
 *
 * ## Vyzvednuto = hotová objednávka
 *
 * Po vydání se objednávka nativně dokončí (`completeOrderWorkflow`): u osobního
 * odběru nic dalšího nepřijde — žádný dopravce, žádné doručení. Přání
 * majitelky; stejně jako převzetí zásilky u sledování ČP.
 */

export type CompletePersonalPickupInput = {
  order_id: string
  created_by?: string | null
}

/**
 * Confirms this really is a personal collection, and that there is money to
 * take. Exported for the unit tests, which is where the exception's boundary is
 * actually pinned down.
 */
export const assertPersonalPickup = (order: any): {
  paymentId: string | null
  amountDue: number
} => {
  const isPickup = (order?.shipping_methods || []).some((method: any) => {
    const data = method?.data || {}
    return (
      data.personal_pickup === true ||
      data.service_code === "PICKUP" ||
      String(method?.shipping_option?.provider_id ?? "").includes("pickup")
    )
  })

  if (!isPickup) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Tuto akci lze použít jen u objednávek s osobním odběrem."
    )
  }

  const collections = order?.payment_collections || []
  const payments = collections.flatMap(
    (collection: any) => collection?.payments || []
  )

  // The authorization created at checkout. Already-captured means she has
  // recorded the money before — nothing left to take.
  const outstanding = payments.find(
    (payment: any) => !payment?.captured_at && !payment?.canceled_at
  )

  // Zrušená/neúspěšná kolekce (vypršelý odkaz na doplatek) nic nedluží —
  // bez téhle výjimky by vydání blokovala navždy. Stejné stavy jako brána
  // odeslání (`ship-gate` SETTLED_COLLECTION_STATUSES).
  const amountDue = collections
    .filter(
      (collection: any) =>
        !["canceled", "failed"].includes(String(collection?.status ?? ""))
    )
    .reduce(
      (sum: number, collection: any) =>
        sum +
        (toNumber(collection.amount) - toNumber(collection.captured_amount)),
      0
    )

  // Dluh bez platby, kterou by šlo zachytit = nezaplacený doplatek zakázky
  // (nebo rozdíl po úpravě). Vydat nejde — nejdřív se peníze zapíší.
  if (!outstanding && amountDue > 0.005) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Zůstatek ${formatMoney(
        amountDue,
        order?.currency_code
      )} není zaplacený — nejdřív ho zaznamenejte tlačítkem „Zaplaceno na místě" (zakázka) nebo pošlete výzvu k doplacení.`
    )
  }

  return { paymentId: outstanding?.id ?? null, amountDue }
}

const validatePickupStep = createStep(
  "validate-personal-pickup",
  async (order: any) => new StepResponse(assertPersonalPickup(order))
)

export const completePersonalPickupWorkflow = createWorkflow(
  "complete-personal-pickup",
  (input: CompletePersonalPickupInput) => {
    const lockKey = transform(
      input,
      ({ order_id }) => `merchant-order:${order_id}`
    )
    acquireLockStep({ key: lockKey, timeout: 10, ttl: 120 })

    const orderQuery = useQueryGraphStep({
      entity: "order",
      fields: [
        "id",
        // `status` pro „už dokončená/zrušená se znovu nedokončuje", měna pro hlášku zámku.
        "status",
        "currency_code",
        "items.*",
        ...OUTSTANDING_ITEM_FIELDS,
        "shipping_methods.*",
        "shipping_methods.shipping_option.provider_id",
        "payment_collections.status",
        "payment_collections.amount",
        "payment_collections.captured_amount",
        "payment_collections.payments.id",
        "payment_collections.payments.captured_at",
        "payment_collections.payments.canceled_at",
        "fulfillments.id",
        "fulfillments.shipped_at",
        "fulfillments.canceled_at",
      ],
      filters: { id: input.order_id },
      options: { throwIfKeyNotFound: true },
    }).config({ name: "personal-pickup-get-order" })

    const order = transform(
      { orderQuery },
      ({ orderQuery }) => (orderQuery.data || [])[0] as any
    )

    const check = validatePickupStep(order)

    // 1 — the money, first, because a failure here costs nothing.
    when(
      "capture-pickup-payment",
      { check },
      ({ check }) => Boolean(check.paymentId) && check.amountDue > 0.005
    ).then(() => {
      capturePaymentWorkflow.runAsStep({
        input: {
          payment_id: check.paymentId as string,
          captured_by: input.created_by ?? undefined,
        },
      })
    })

    const plan = transform({ order }, ({ order }) => {
      // BigNumber-safe (lib/parcel-tracking/shipment-items.ts) — naivní
      // Number() na `detail.*_quantity` dával 0 a shipment nikdy nevznikl.
      const toFulfill = fulfillmentItemsOf(order)
      const toShip = shipmentItemsOf(order)

      const openFulfillment = (order?.fulfillments || []).find(
        (fulfillment: any) =>
          !fulfillment?.canceled_at && !fulfillment?.shipped_at
      )

      return {
        toFulfill,
        toShip,
        existingFulfillmentId: openFulfillment?.id ?? null,
        needsFulfillment: toFulfill.length > 0,
      }
    })

    // 2 — the goods leave stock.
    const created = when(
      "fulfil-on-pickup",
      { plan },
      ({ plan }) => plan.needsFulfillment
    ).then(() =>
      createOrderFulfillmentWorkflow.runAsStep({
        input: {
          order_id: input.order_id,
          items: plan.toFulfill,
          created_by: input.created_by ?? undefined,
        },
      })
    )

    // 3 — and they are gone, which for a collection is true immediately.
    const shipment = transform({ created, plan }, ({ created, plan }) => ({
      fulfillment_id: (created as any)?.id ?? plan.existingFulfillmentId,
      items: plan.toShip,
    }))

    when(
      "ship-on-pickup",
      { shipment, plan },
      ({ shipment, plan }) =>
        !!shipment.fulfillment_id && plan.toShip.length > 0
    ).then(() => {
      createOrderShipmentWorkflow.runAsStep({
        input: {
          order_id: input.order_id,
          fulfillment_id: shipment.fulfillment_id as string,
          items: shipment.items,
          created_by: input.created_by ?? undefined,
        },
      })

      transitionMerchantOrderWorkflow.runAsStep({
        input: {
          order_id: input.order_id,
          stage: "shipped",
          changed_by: input.created_by ?? null,
        },
      })
    })

    // 4 — vyzvednuto = hotová objednávka. Nativní `completed`, protože u
    //     osobního odběru už nic nepřijde. Dokončená se nedokončuje znovu a
    //     zrušenou by modul objednávek odmítl (a ani by sem neměla dojít).
    when(
      "complete-on-pickup",
      { order },
      ({ order }) =>
        !["completed", "canceled"].includes(String(order?.status ?? ""))
    ).then(() => {
      completeOrderWorkflow.runAsStep({
        input: { orderIds: [input.order_id] },
      })
    })

    releaseLockStep({ key: lockKey })

    return new WorkflowResponse(check)
  }
)
