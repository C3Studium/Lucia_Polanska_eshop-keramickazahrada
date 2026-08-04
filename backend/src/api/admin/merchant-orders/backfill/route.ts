import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getOrdersListWorkflow } from "@medusajs/medusa/core-flows"
import { MERCHANT_ORDER_MODULE } from "../../../../modules/merchant-order"
import type MerchantOrderModuleService from "../../../../modules/merchant-order/service"
import {
  initialStageForPayment,
  paymentProblemReason,
} from "../../../../modules/merchant-order/payment-state"

/**
 * Bring older orders into the queues (WorkflowPlan.md §5.3, §18).
 *
 * Orders placed before the merchant-order module existed have no stage row, so
 * they are invisible in Denní práce — safe behaviour, but it means the queue
 * quietly disagrees with the order list, and nobody can tell whether that is
 * because there is no work or because the rows are missing.
 *
 * `GET` counts what is missing so the queue can say so; `POST` creates the rows.
 *
 * Both are safe to run repeatedly: rows are only created for orders that have
 * none, so a double click, a retry or a second admin running it at the same
 * time all converge on the same result. Nothing is ever updated or deleted —
 * an order that already has a stage is left exactly as the merchant left it.
 *
 * Static path segments are matched before parameterised ones
 * (`RoutesSorter`: global → wildcard → regex → **static** → params), so this
 * does not collide with `/admin/merchant-orders/:orderId`.
 */

/** Page size for the scan. The shop is small; this keeps memory flat regardless. */
const SCAN_PAGE_SIZE = 200

/** Upper bound on one run, so a runaway history cannot hang the request. */
const MAX_SCANNED_ORDERS = 5_000

const ORDER_FIELDS = [
  "id",
  "status",
  "created_at",
  "currency_code",
  // `payment_status` is computed inside the list workflow; without `items.*`
  // the totals it is derived from come back empty.
  "total",
  "items.*",
  "payment_collections.status",
  "payment_collections.amount",
  "payment_collections.captured_amount",
  "payment_collections.refunded_amount",
]

type ScanResult = {
  scanned: number
  missing: Array<{ id: string; status: string; payment_status: string | null }>
  truncated: boolean
}

/**
 * Walks the order history and returns the ones with no stage row.
 *
 * Draft orders are skipped: they are not orders anybody works on until they are
 * completed, and completing one emits `order.placed`, which creates the row
 * through the normal path.
 */
const scanForMissingStates = async (
  req: MedusaRequest
): Promise<ScanResult> => {
  const service = req.scope.resolve<MerchantOrderModuleService>(
    MERCHANT_ORDER_MODULE
  )

  const missing: ScanResult["missing"] = []
  let scanned = 0
  let offset = 0
  let truncated = false

  for (;;) {
    const { result } = await getOrdersListWorkflow(req.scope).run({
      input: {
        fields: ORDER_FIELDS,
        variables: {
          filters: { is_draft_order: false },
          order: { created_at: "DESC" },
          skip: offset,
          take: SCAN_PAGE_SIZE,
        },
      },
    })

    const page = Array.isArray(result) ? result : ((result as any)?.rows ?? [])
    if (!page.length) {
      break
    }

    const states = await service.listMerchantOrderStates({
      order_id: page.map((order: any) => order.id),
    } as never)
    const covered = new Set(states.map((state: any) => state.order_id))

    for (const order of page as any[]) {
      if (!covered.has(order.id)) {
        missing.push({
          id: order.id,
          status: order.status,
          payment_status: order.payment_status ?? null,
        })
      }
    }

    scanned += page.length
    offset += SCAN_PAGE_SIZE

    if (page.length < SCAN_PAGE_SIZE) {
      break
    }
    if (scanned >= MAX_SCANNED_ORDERS) {
      truncated = true
      break
    }
  }

  return { scanned, missing, truncated }
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { scanned, missing, truncated } = await scanForMissingStates(req)

  res.status(200).json({
    scanned,
    missing: missing.length,
    truncated,
  })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const service = req.scope.resolve<MerchantOrderModuleService>(
    MERCHANT_ORDER_MODULE
  )
  const logger = req.scope.resolve("logger")

  const { scanned, missing, truncated } = await scanForMissingStates(req)

  if (!missing.length) {
    res.status(200).json({ scanned, created: 0, truncated })
    return
  }

  const now = new Date()
  const rows = missing.map((order) => {
    // A cancelled order is not work — it goes straight to the outcome stage
    // rather than reappearing in „Nové" years later.
    const stage =
      order.status === "canceled"
        ? ("cancelled" as const)
        : initialStageForPayment(order.payment_status)

    return {
      order_id: order.id,
      stage,
      stage_changed_at: now,
      requires_attention: stage === "payment_problem",
      attention_reason:
        stage === "payment_problem"
          ? paymentProblemReason(order.payment_status)
          : null,
    }
  })

  await service.createMerchantOrderStates(rows as never)

  logger.info(
    `[backfill] Doplněno ${rows.length} stavů objednávek (prohledáno ${scanned}).`
  )

  res.status(200).json({ scanned, created: rows.length, truncated })
}
