import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  createOrderFulfillmentWorkflow,
  releaseLockStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { assertShipGateStep } from "./steps/assert-ship-gate"
import { stampDobirkaStep } from "./steps/stamp-dobirka"
import {
  fulfillmentItemsOf,
  OUTSTANDING_ITEM_FIELDS,
} from "../lib/parcel-tracking/shipment-items"

/**
 * „Vygenerovat štítek" bez odeslání — podá zásilku České poště (čímž vznikne
 * štítek + číslo zásilky), ale NEvytvoří shipment, NEzmění stav na „odesláno"
 * a NEpošle zákazníkovi e-mail.
 *
 * ## Proč samostatně od `ship-merchant-order`
 *
 * V API módu `shipMerchantOrderWorkflow` podání (vznik štítku) a odeslání dělá
 * jedním dechem. Majitelka ale chce štítek vytisknout, nalepit na krabici a
 * teprve PAK ji předat dopravci — tedy štítek napřed, „odesláno" až na tlačítko
 * „Zásilku jsem předala dopravci".
 *
 * Tohle workflow je proto `ship-merchant-order` MINUS shipment a MINUS přechod
 * fáze: brána (A2, ať se nepodává nezaplacené) a razítko dobírky (ČP u podání
 * vyžaduje částku dobírky i e-mail — viz `stamp-dobirka`) zůstávají stejné kroky,
 * takže se chování nerozejde. Výsledný fulfillment je ten samý „otevřený, zatím
 * neodeslaný" stav, který fronta zná: objednávka ve fázi „K odeslání" pak nabídne
 * „Zásilku jsem předala dopravci" (`confirm-merchant-handover`), což vytvoří
 * shipment + e-mail. Štítek nese `fulfillment.data.label_pdf_base64`.
 */

export type GenerateCpLabelInput = {
  order_id: string
  created_by?: string | null
}

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export const generateCpLabelWorkflow = createWorkflow(
  "generate-cp-label",
  (input: GenerateCpLabelInput) => {
    // Stejný zámek jako odeslání — dvojklik ani souběh s odesláním nerozjede
    // dvě podání jedné objednávky.
    const lockKey = transform(
      input,
      ({ order_id }) => `merchant-order:${order_id}`
    )
    acquireLockStep({ key: lockKey, timeout: 10, ttl: 120 })

    const orderQuery = useQueryGraphStep({
      entity: "order",
      fields: [
        "id",
        "status",
        "currency_code",
        "total",
        "items.*",
        ...OUTSTANDING_ITEM_FIELDS,
        "summary.*",
        "payment_collections.status",
        "payment_collections.amount",
        "payment_collections.captured_amount",
        "payment_collections.refunded_amount",
        "payment_collections.payments.provider_id",
        "fulfillments.id",
        "fulfillments.shipped_at",
        "fulfillments.canceled_at",
      ],
      filters: { id: input.order_id },
      options: { throwIfKeyNotFound: true },
    }).config({ name: "generate-cp-label-get-order" })

    const productionQuery = useQueryGraphStep({
      entity: "production_order",
      fields: [
        "id",
        "order_id",
        "agreed_total",
        "original_total",
        "payment_requests.status",
        "payment_requests.amount",
      ],
      filters: { order_id: input.order_id },
    }).config({ name: "generate-cp-label-get-production" })

    const orderChangeQuery = useQueryGraphStep({
      entity: "order_change",
      fields: ["id", "status"],
      filters: { order_id: input.order_id },
    }).config({ name: "generate-cp-label-get-order-changes" })

    const gateInput = transform(
      { orderQuery, productionQuery, orderChangeQuery },
      ({ orderQuery, productionQuery, orderChangeQuery }) => {
        const order = (orderQuery.data || [])[0] as any
        return {
          currency_code: order?.currency_code,
          total: order?.total,
          summary: order?.summary,
          payment_collections: order?.payment_collections || [],
          order_changes: (orderChangeQuery.data || []) as any[],
          production_order: ((productionQuery.data || [])[0] as any) ?? null,
        }
      }
    )

    // Nejdřív brána — podat nezaplacenou zásilku (mimo dobírku) nedává smysl a
    // ČP by to stejně stálo peníze. Dobírku brána pouští.
    assertShipGateStep(gateInput)

    // Částka dobírky + e-mail na objednávku, než se sáhne na podání — provider
    // se k platbám nedostane, čte je z metadat.
    stampDobirkaStep(
      transform({ input, gateInput }, ({ input, gateInput }) => ({
        order_id: input.order_id,
        payment_collections: gateInput.payment_collections,
        total: gateInput.total,
      }))
    )

    const plan = transform({ orderQuery }, ({ orderQuery }) => {
      const order = (orderQuery.data || [])[0] as any
      // Jen fyzické položky se vyskladňují. Případný už existující (třeba
      // z nativní stránky) otevřený fulfillment se znovupoužije — jeho štítek
      // čte route; druhý fulfillment pro totéž zboží nevznikne.
      // BigNumber-safe převod — viz lib/parcel-tracking/shipment-items.ts.
      const itemsToFulfill = fulfillmentItemsOf(order)

      const openFulfillment = (order?.fulfillments || []).find(
        (fulfillment: any) =>
          !fulfillment?.canceled_at && !fulfillment?.shipped_at
      )

      return {
        itemsToFulfill,
        existingFulfillmentId: openFulfillment?.id ?? null,
        needsFulfillment: itemsToFulfill.length > 0 && !openFulfillment,
      }
    })

    when(
      "create-fulfillment-for-label",
      { plan },
      ({ plan }) => plan.needsFulfillment
    ).then(() => {
      createOrderFulfillmentWorkflow.runAsStep({
        input: {
          order_id: input.order_id,
          items: plan.itemsToFulfill,
          created_by: input.created_by ?? undefined,
        },
      })
    })

    releaseLockStep({ key: lockKey })

    return new WorkflowResponse(plan)
  }
)
