import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getInventoryAlerts } from "../../../lib/inventory-alerts"

/**
 * What is running low and what has run out (WorkflowPlan.md §10, §22, P7-1).
 *
 * The rules live in `src/lib/inventory-alerts.ts` and are shared with the
 * Přehled tiles and the daily stock job, so this endpoint and the dashboard
 * can never disagree about what „low" means — which they did until now: the
 * tile counted correctly while the page said everything was fine.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const alerts = await getInventoryAlerts(req.scope)

  const type =
    req.query.type === "out" ? "out" : req.query.type === "ok" ? "ok" : "low"

  res.status(200).json({
    type,
    items:
      type === "out" ? alerts.out : type === "ok" ? alerts.ok : alerts.low,
    low_count: alerts.low.length,
    out_count: alerts.out.length,
    ok_count: alerts.ok.length,
    default_threshold: alerts.default_threshold,
  })
}
