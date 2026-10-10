import type { MedusaContainer } from "@medusajs/framework/types"
import { sendCustomerEmail } from "../customer-email"
import { notifyMerchant } from "../notify"
import { claimService, claimEmailBase, regenerateProtocol } from "./admin"
import {
  AUTO_CANCEL_DECISION_NOTE,
  AUTO_CANCEL_RESOLUTION_NOTE,
} from "./auto-cancel"
import { cancelOrderNatively } from "./cancel-order-action"
import { kindLabel, resolutionLabel } from "./constants"

/**
 * Auto-zrušení (docs/reklamace-a-zruseni.md §13.1) — orchestrace po
 * rozhodnutí `shouldAutoCancel` (čisté, `auto-cancel.ts`); volá ji intake.
 *
 * Pořadí a proč:
 * 1. Žádost → `approved` + `resolved` najednou (resolution `refund`,
 *    `decision_note` „Automaticky — …", `decided_at`, `resolved_at`,
 *    `resolution_note`). Zapisuje se PŘED zrušením objednávky: subscriber
 *    `order.canceled` podle `decision_note` pozná, že nemá posílat
 *    „Objednávka zrušena" (zákazník dostane jeden e-mail, viz bod 3).
 * 2. Protokol jako potvrzení o vyřízení (jedno číslo, PDF roste o vyřízení).
 * 3. Nativní zrušení (`cancelOrderNatively`: workflow + fáze `cancelled`;
 *    zakázka tu nikdy není — `shouldAutoCancel` ji vylučuje).
 * 4. JEDEN e-mail zákazníkovi: `return-approved` s `nothingToReturn` („Objednávka
 *    zrušena" — nic neposílat, nic nebylo zaplaceno). Potvrzení o přijetí
 *    (`refund-request`) se NEposílá: psát „posoudíme do 14 dnů" o žádosti,
 *    která je o vteřinu později vyřízená, by zákazníka jen zmátlo.
 * 5. Zvonek majitelce BEZ e-mailu — nic po ní nechceme, jen ať to ví.
 */
export type AutoCancelResult = {
  request: any
  protocolUrl: string | null
  orderCancelled: boolean
  message: string
}

export const autoCancelClaim = async (
  container: MedusaContainer,
  params: {
    request: any
    order: { id: string; display_id?: number | string | null; email?: string | null }
  }
): Promise<AutoCancelResult> => {
  const { order } = params
  const service = claimService(container)
  const now = new Date()
  const kind = params.request.kind ?? null

  const updated = await service.updateReturnRequests({
    id: params.request.id,
    status: "resolved",
    resolution: "refund",
    decision_note: AUTO_CANCEL_DECISION_NOTE,
    decided_at: now,
    resolved_at: now,
    resolution_note: AUTO_CANCEL_RESOLUTION_NOTE,
  })

  const protocol = await regenerateProtocol(container, updated, {
    outcome: `Schváleno — ${resolutionLabel("refund")} (automaticky: nezaplaceno, neodesláno)`,
    note: AUTO_CANCEL_RESOLUTION_NOTE,
    decidedAt: now,
    confirmation: true,
  })

  const cancel = await cancelOrderNatively(container, order, null)

  await sendCustomerEmail(container, {
    template: "return-approved",
    to: order.email,
    key: `return-approved:req:${updated.id}`,
    orderId: order.id,
    data: {
      subject: "Objednávka zrušena",
      ...claimEmailBase(updated, protocol.url),
      returnReason: updated.reason,
      goodsReturnRequired: false,
      nothingToReturn: true,
      returnDeadline: "nebylo zaplaceno — není co vracet",
    },
  })

  await notifyMerchant(container, {
    key: `mn:return-req:${updated.id}`,
    title: `${kindLabel(kind)} k objednávce #${order.display_id} — zrušeno automaticky`,
    description: [
      "Nezaplaceno a neodesláno → žádost schválena a vyřízena, objednávka zrušena, sklad uvolněn.",
      `Důvod zákazníka: ${updated.reason}`,
      cancel.cancelled ? null : cancel.message,
    ]
      .filter(Boolean)
      .join("\n"),
    audience: "owner",
    urgent: false,
    email: false,
    resource: { id: order.id, type: "order" },
  }).catch(() => undefined)

  return {
    request: { ...updated, protocol_url: protocol.url ?? updated.protocol_url },
    protocolUrl: protocol.url,
    orderCancelled: cancel.cancelled,
    message: cancel.message,
  }
}
