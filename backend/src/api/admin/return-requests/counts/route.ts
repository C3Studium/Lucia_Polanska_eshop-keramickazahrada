import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CLAIM_STATUSES, isOpenStatus } from "../../../../lib/claims/constants"
import { RETURN_REQUEST_MODULE } from "../../../../modules/return-request"
import type ReturnRequestModuleService from "../../../../modules/return-request/service"

/**
 * GET /admin/return-requests/counts — počty do tabů modulu
 * (docs/reklamace-a-zruseni.md §4). `overdue` = nefinální žádosti po lhůtě
 * `resolve_by`, ať je červené číslo vidět bez otevření tabu.
 *
 * Jeden dotaz na tři sloupce a součet v paměti — žádostí jsou desítky, ne
 * tisíce, a šest COUNT dotazů by bylo víc práce než užitku.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service = req.scope.resolve<ReturnRequestModuleService>(
    RETURN_REQUEST_MODULE
  )
  const rows = (await service.listReturnRequests(
    {} as never,
    { select: ["id", "status", "resolve_by"] } as never
  )) as Array<{ status?: string; resolve_by?: string | Date | null }>

  const counts: Record<string, number> = Object.fromEntries(
    CLAIM_STATUSES.map((status) => [status, 0])
  )
  let overdue = 0
  const now = Date.now()

  for (const row of rows) {
    const status = row.status ?? ""
    if (status in counts) counts[status] += 1
    if (isOpenStatus(status) && row.resolve_by) {
      const due = new Date(row.resolve_by).getTime()
      if (Number.isFinite(due) && due < now) overdue += 1
    }
  }

  res.status(200).json({ ...counts, overdue })
}
