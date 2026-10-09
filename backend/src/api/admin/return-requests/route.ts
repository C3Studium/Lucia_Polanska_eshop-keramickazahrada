import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { enrichWithMoney } from "../../../lib/claims/admin"
import {
  CLAIM_STATUSES,
  isClaimKind,
  OPEN_STATUSES,
} from "../../../lib/claims/constants"
import { RETURN_REQUEST_MODULE } from "../../../modules/return-request"
import type ReturnRequestModuleService from "../../../modules/return-request/service"

/**
 * Seznam žádostí pro modul „Reklamace a zrušení" (docs/reklamace-a-zruseni.md §4).
 *
 * `status`: `pending` (výchozí) | `approved` | `received` | `resolved` |
 * `rejected` | `cancelled` | `open` (nefinální) | `all`; `decided` zůstává pro
 * starý tab v Přehledu. `kind` filtruje druh, `q` hledá v čísle objednávky,
 * e-mailu a jménu, `order_id` je pro widget na detailu objednávky.
 *
 * Ke každému řádku se dopočítá `captured_total` / `refunded_total` /
 * `remaining` — tlačítko „Vrátit peníze" potřebuje vědět, co zbývá, ještě než
 * se klikne — a `suggested_amount` (§11.2: cena vybraných položek, bez
 * položek = zbývá). Řádek nese i `line_items` a `damage_cause` z modelu
 * (§11.1) pro badge „Poškozeno přepravou" a seznam položek v detailu.
 */

const asPositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback
}

const statusFilterFor = (status: string): Record<string, unknown> => {
  if (status === "all") return {}
  if (status === "open") return { status: [...OPEN_STATUSES] }
  if (status === "decided") return { status: ["approved", "rejected"] }
  return {
    status: (CLAIM_STATUSES as readonly string[]).includes(status)
      ? status
      : "pending",
  }
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service = req.scope.resolve<ReturnRequestModuleService>(
    RETURN_REQUEST_MODULE
  )

  const limit = Math.min(asPositiveInt(req.query.limit, 50), 200)
  const offset = asPositiveInt(req.query.offset, 0)
  const status = typeof req.query.status === "string" ? req.query.status : ""
  const kind =
    typeof req.query.kind === "string" && isClaimKind(req.query.kind)
      ? req.query.kind
      : null
  // „#1234" i „1234" je totéž číslo objednávky.
  const q =
    typeof req.query.q === "string"
      ? req.query.q.trim().replace(/^#/, "").slice(0, 120)
      : ""
  const orderId =
    typeof req.query.order_id === "string" && req.query.order_id.trim()
      ? req.query.order_id.trim()
      : null

  const filters: Record<string, unknown> = { ...statusFilterFor(status) }
  if (kind) filters.kind = kind
  if (orderId) filters.order_id = orderId
  if (q) {
    const needle = `%${q}%`
    filters.$or = [
      { order_display_id: { $ilike: needle } },
      { email: { $ilike: needle } },
      { customer_name: { $ilike: needle } },
    ]
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
    return_requests: await enrichWithMoney(req.scope, requests as any[]),
    count,
    limit,
    offset,
  })
}
