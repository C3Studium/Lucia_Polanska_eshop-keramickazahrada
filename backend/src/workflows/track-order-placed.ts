import { 
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { trackEventStep } from "./steps/track-event"

type WorkflowInput = {
  id: string
}

export const trackOrderPlacedWorkflow = createWorkflow(
  "track-order-placed",
  ({ id }: WorkflowInput) => {
    /*
     * Do Segmentu (zpracovatel v USA) jdou jen údaje o objednávce, NE přímé
     * identifikátory zákazníka — dřív sem šel e-mail a jméno, aniž by to
     * Zásady ochrany osobních údajů zmiňovaly (čl. 5 odst. 1 písm. c) a čl. 13
     * GDPR; 15. 10. 2026, viz docs/legal/CHANGELOG.md). Jestli Segment vůbec
     * používat, je otevřená otázka (docs/legal/OPEN_QUESTIONS.md).
     */
    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: [
        "id",
        "total",
        "currency_code",
        // `items.*`, ne jednotlivá pole: explicitní `items.quantity` query.graph
        // nevrací (množství žije na detailu položky).
        "items.*",
        "customer.id",
        "created_at"
      ],
      filters: {
        id,
      },
    }).config({ name: "get-order-details" })

    const order = transform({
      order: orders[0],
    }, ({ order }) => ({
      orderId: order.id,
      total: order.total,
      currency: order.currency_code,
      items: order.items?.map((item) => ({
        id: item?.id,
        title: item?.title,
        quantity: item?.quantity,
        variant_id: item?.variant_id,
        unit_price: item?.unit_price
      })),
      customer: {
        id: order.customer?.id,
      },
      timestamp: order.created_at
    }))

    trackEventStep({
      event: "order.placed",
      userId: order.customer?.id,
      properties: order
    })
  }
)
