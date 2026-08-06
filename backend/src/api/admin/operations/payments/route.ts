import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getOrdersListWorkflow } from "@medusajs/medusa/core-flows"
import { isPaymentProblem } from "../../../../modules/merchant-order/payment-state"

/**
 * Money in, and money that did not arrive (§3.3, §15 #2).
 *
 * Built on orders rather than on the payment tables, for two reasons. Medusa's
 * authoritative view of whether an order is paid is `payment_status`, computed
 * by `getLastPaymentStatus` inside the list workflow and available nowhere
 * else. And a payment that *failed* often leaves no `payment` row at all —
 * only a collection that never completed — so a list built from payments would
 * be missing exactly the rows this page exists to show.
 */

const asPositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback
}

const toNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>
    return toNumber(candidate.value ?? candidate.numeric_ ?? candidate.raw_ ?? 0)
  }
  return 0
}

const ORDER_FIELDS = [
  "id",
  "display_id",
  "created_at",
  "email",
  "currency_code",
  "total",
  "items.*",
  "customer.first_name",
  "customer.last_name",
  "payment_collections.status",
  "payment_collections.amount",
  "payment_collections.captured_amount",
  "payment_collections.refunded_amount",
  "payment_collections.payments.provider_id",
  "payment_collections.payments.captured_at",
  "payment_collections.payments.canceled_at",
]

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const limit = Math.min(asPositiveInt(req.query.limit, 50), 100)
  const offset = asPositiveInt(req.query.offset, 0)
  const onlyProblems = req.query.filter === "problem"

  // Problem rows are rare and scattered, so the filter cannot be a database
  // one: `payment_status` is computed, not stored. A wider page is scanned and
  // filtered here instead.
  const scanSize = onlyProblems ? Math.min(limit * 10, 500) : limit

  const { result } = await getOrdersListWorkflow(req.scope).run({
    input: {
      fields: ORDER_FIELDS,
      variables: {
        filters: { is_draft_order: false },
        order: { created_at: "DESC" },
        skip: onlyProblems ? 0 : offset,
        take: scanSize,
      },
    },
  })

  const rows = Array.isArray(result) ? result : ((result as any)?.rows ?? [])
  const count = Array.isArray(result) ? rows.length : ((result as any)?.metadata?.count ?? rows.length)

  const mapped = (rows as any[]).map((order) => {
    const collections = order.payment_collections || []
    const captured = collections.reduce(
      (sum: number, collection: any) => sum + toNumber(collection.captured_amount),
      0
    )
    const refunded = collections.reduce(
      (sum: number, collection: any) => sum + toNumber(collection.refunded_amount),
      0
    )
    const provider = collections
      .flatMap((collection: any) => collection.payments || [])
      .map((payment: any) => payment?.provider_id)
      .find(Boolean)

    const name = [order.customer?.first_name, order.customer?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim()

    return {
      order_id: order.id,
      display_id: order.display_id,
      created_at: order.created_at,
      customer_name: name || order.email || null,
      currency_code: order.currency_code,
      total: toNumber(order.total),
      captured,
      refunded,
      outstanding: Math.max(0, toNumber(order.total) - (captured - refunded)),
      payment_status: order.payment_status ?? null,
      is_problem: isPaymentProblem(order.payment_status),
      // Authorized-but-uncaptured: pickup promises and cards on hold. They
      // were invisible — neither a problem nor paid, so no tab claimed them.
      is_authorized_unpaid:
        captured - refunded <= 0 &&
        String(order.payment_status ?? "") === "authorized",
      provider_id: provider ?? null,
    }
  })

  const onlyAuthorized = req.query.filter === "authorized"
  const visible = onlyProblems
    ? mapped.filter((row) => row.is_problem).slice(offset, offset + limit)
    : onlyAuthorized
      ? mapped
          .filter((row) => row.is_authorized_unpaid)
          .slice(offset, offset + limit)
      : mapped

  res.status(200).json({
    payments: visible,
    count: onlyProblems ? mapped.filter((row) => row.is_problem).length : count,
    problem_count: mapped.filter((row) => row.is_problem).length,
    authorized_count: mapped.filter((row) => row.is_authorized_unpaid).length,
    scanned: rows.length,
    limit,
    offset,
  })
}
