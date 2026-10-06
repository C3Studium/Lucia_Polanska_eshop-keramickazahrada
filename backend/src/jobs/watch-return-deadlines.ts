import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { RETURN_REQUEST_MODULE } from "../modules/return-request"
import type ReturnRequestModuleService from "../modules/return-request/service"
import { notifyMerchant } from "../lib/notify"

/**
 * Hlídá zákonné lhůty reklamací / vrácení / odstoupení (modul reklamací, fáze 2).
 *
 * Reklamace se musí vyřídit do 30 dnů (§19 ZOS), u odstoupení/vrácení se peníze
 * vrací do 14 dnů (§1832) — `resolve_by` na žádosti nese tu lhůtu. Tahle úloha
 * upozorní majitelku, než lhůta vyprší, a opakovaně, když už po ní je, ať nic
 * nepropadne. Nic nemění — jen notifikuje (D4: systém upozorní, ona jedná).
 *
 * Jen `pending` žádosti: rozhodnutá/zamítnutá/vrácená už lhůtu neřeší.
 */

const DAY_MS = 24 * 60 * 60 * 1000

const KIND_LABEL: Record<string, string> = {
  reklamace: "Reklamace",
  vraceni: "Vrácení",
  odstoupeni: "Odstoupení",
}

const day = (value: Date) => value.toISOString().slice(0, 10)

export default async function watchReturnDeadlines(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const service = container.resolve<ReturnRequestModuleService>(
    RETURN_REQUEST_MODULE
  )

  const pending = (await service.listReturnRequests({
    status: "pending",
  } as never)) as any[]

  const now = new Date()
  const today = day(now)
  let warned = 0

  for (const request of pending) {
    if (!request.resolve_by) continue

    const daysLeft = Math.ceil(
      (new Date(request.resolve_by).getTime() - now.getTime()) / DAY_MS
    )
    const label = KIND_LABEL[request.kind] ?? "Žádost o vrácení"
    const order = `#${request.order_display_id}`

    if (daysLeft < 0) {
      // Po lhůtě — opakovaně denně, dokud se to nevyřídí (jeden klíč na den).
      warned++
      await notifyMerchant(container, {
        key: `mn:ret-over:${request.id}:${today}`,
        title: `${label} ${order} je po zákonné lhůtě`,
        description: `Lhůta uplynula před ${Math.abs(daysLeft)} ${
          Math.abs(daysLeft) === 1 ? "dnem" : "dny"
        }. Vyřiďte prosím co nejdřív — schválit, zamítnout, nebo vrátit peníze.`,
        audience: "owner",
        urgent: true,
        resource: { id: request.order_id, type: "order" },
      })
    } else if (daysLeft <= 3) {
      warned++
      await notifyMerchant(container, {
        key: `mn:ret-due:${request.id}:${today}`,
        title:
          daysLeft === 0
            ? `${label} ${order} má být vyřízená dnes`
            : `${label} ${order}: zbývá ${daysLeft} ${
                daysLeft === 1 ? "den" : "dny"
              }`,
        description: "Blíží se zákonná lhůta na vyřízení.",
        audience: "owner",
        resource: { id: request.order_id, type: "order" },
      })
    }
  }

  logger.info(
    `[reklamace] Zkontrolováno ${pending.length} nevyřízených žádostí, upozornění: ${warned}.`
  )
}

export const config = {
  name: "watch-return-deadlines",
  // 07:15 — po skladu, souhrnu a výrobních termínech, ať ranní notifikace
  // chodí v rozumném pořadí.
  schedule: "15 7 * * *",
}
