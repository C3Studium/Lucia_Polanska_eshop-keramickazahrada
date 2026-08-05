import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { transitionMerchantOrderWorkflow } from "../../../../../workflows/transition-merchant-order"
import { isMerchantOrderStage } from "../../../../../modules/merchant-order/stages"

/**
 * Batch stage moves — Objednávky+ (admin-advanced-plan.md, write layer).
 *
 * A firing day ends with eight orders packed at once; clicking through eight
 * detail pages to say so is the kind of friction that gets skipped, and a
 * skipped stage move means the queue lies tomorrow morning.
 *
 * ## Per-order results, not one verdict
 *
 * Each order runs the same `transition-merchant-order` workflow the single
 * move uses — same transition table, same lock, same event — and each result
 * is reported separately. All-or-nothing would be wrong twice over: seven
 * legal moves should not be held hostage by one illegal one, and a silent
 * partial success would leave her believing eight moved when seven did. The
 * response says exactly which failed and why, in her language, because the
 * failure message *is* the feature.
 */
export const PostWorkbenchBatchStageSchema = z.object({
  order_ids: z.array(z.string().min(1)).min(1).max(50),
  stage: z.string().refine(isMerchantOrderStage, {
    message: "Neznámý stav objednávky.",
  }),
  note: z.string().max(500).optional(),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostWorkbenchBatchStageSchema>
  >,
  res: MedusaResponse
) => {
  const { order_ids, stage, note } = req.validatedBody
  const actor = req.auth_context?.actor_id || null

  const results: {
    order_id: string
    ok: boolean
    error: string | null
  }[] = []

  // Sequential on purpose: each transition takes the per-order lock, and a
  // batch of fifty parallel lock acquisitions against the same table is a
  // stampede with no upside — the whole batch still completes in well under
  // a second, and the results arrive in the order she selected.
  for (const orderId of order_ids) {
    try {
      await transitionMerchantOrderWorkflow(req.scope).run({
        input: {
          order_id: orderId,
          stage: stage as never,
          changed_by: actor,
          internal_note: note ?? null,
        },
      })
      results.push({ order_id: orderId, ok: true, error: null })
    } catch (error) {
      results.push({
        order_id: orderId,
        ok: false,
        error:
          error instanceof Error ? error.message : "Neznámá chyba.",
      })
    }
  }

  const failed = results.filter((result) => !result.ok)

  res.status(failed.length === results.length ? 422 : 200).json({
    moved: results.length - failed.length,
    failed: failed.length,
    results,
  })
}
