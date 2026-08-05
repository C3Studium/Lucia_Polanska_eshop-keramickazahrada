import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { RETURN_REQUEST_MODULE } from "../../../modules/return-request"
import type ReturnRequestModuleService from "../../../modules/return-request/service"

/**
 * The returns-intake queue for the „Vrácení" admin page.
 *
 * `status` filters: `pending` (default — what needs her decision), `approved`,
 * `rejected`, `decided` (both decisions, for the page's muted history section)
 * or `all`.
 */

const STATUSES = ["pending", "approved", "rejected"] as const

const asPositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service = req.scope.resolve<ReturnRequestModuleService>(
    RETURN_REQUEST_MODULE
  )

  const limit = Math.min(asPositiveInt(req.query.limit, 50), 200)
  const offset = asPositiveInt(req.query.offset, 0)
  const status = typeof req.query.status === "string" ? req.query.status : ""

  const filters =
    status === "all"
      ? {}
      : status === "decided"
        ? { status: ["approved", "rejected"] }
        : {
            status: (STATUSES as readonly string[]).includes(status)
              ? status
              : "pending",
          }

  const [requests, count] = await service.listAndCountReturnRequests(
    filters as never,
    {
      take: limit,
      skip: offset,
      order: { created_at: "DESC" },
    }
  )

  res.status(200).json({
    return_requests: requests,
    count,
    limit,
    offset,
  })
}
