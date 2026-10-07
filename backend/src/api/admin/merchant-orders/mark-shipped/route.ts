import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { evaluateShipGate } from "../../../../lib/ship-gate"
import { loadShipGateInput } from "../../../../lib/require-ship-gate"
import { transitionMerchantOrderWorkflow } from "../../../../workflows/transition-merchant-order"

/**
 * Hromadné „Označit jako odeslané" — posune vybrané objednávky na „Odesláno"
 * a zákazníkům pošle e-mail „odesláno" (přes změnu fáze, viz customer-emails).
 *
 * Lehká akce jako jednotlivé označení v detailu: NEgeneruje štítek ani Medusa
 * zásilku, jen stav + e-mail. Pojistka A2 (ship gate) platí per objednávka —
 * nezaplacenou (zakázka s nedoplaceným doplatkem) přeskočí s důvodem, zbytek
 * označí. Přechod jede přes transition table (povolené `shipping → shipped`),
 * takže objednávka, co ještě není „K odeslání", se přeskočí s důvodem.
 */

type Body = { order_ids?: unknown }

type Result = { order_id: string; shipped: boolean; reason?: string }

export const POST = async (req: MedusaRequest<Body>, res: MedusaResponse) => {
  const raw = (req.body as Body)?.order_ids
  const ids = Array.isArray(raw)
    ? [...new Set(raw.filter((id): id is string => typeof id === "string" && Boolean(id)))]
    : []

  if (!ids.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Vyberte aspoň jednu objednávku k označení za odeslanou."
    )
  }
  if (ids.length > 100) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Najednou lze označit nejvýš 100 objednávek."
    )
  }

  const changedBy = (req as any).auth_context?.actor_id || null
  const results: Result[] = []

  for (const orderId of ids) {
    try {
      const gateInput = await loadShipGateInput(req.scope, orderId)
      const verdict = gateInput
        ? evaluateShipGate(gateInput)
        : { allowed: true, reason: null }
      if (!verdict.allowed) {
        results.push({
          order_id: orderId,
          shipped: false,
          reason: verdict.reason ?? "Objednávku zatím nelze označit za odeslanou.",
        })
        continue
      }

      await transitionMerchantOrderWorkflow(req.scope).run({
        input: { order_id: orderId, stage: "shipped", changed_by: changedBy },
      })
      results.push({ order_id: orderId, shipped: true })
    } catch (error) {
      results.push({
        order_id: orderId,
        shipped: false,
        reason: error instanceof Error ? error.message : "Označení se nepodařilo.",
      })
    }
  }

  const shipped = results.filter((result) => result.shipped).length
  res.status(200).json({ shipped, total: ids.length, results })
}
