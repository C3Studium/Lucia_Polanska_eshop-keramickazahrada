import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MADE_TO_ORDER_MODULE } from "../modules/made-to-order"
import type MadeToOrderModuleService from "../modules/made-to-order/service"
import { notifyMerchant } from "../lib/notify"

/**
 * Warns about production deadlines before and after they pass (P6-4,
 * notifications #5 and #6), and about balances that have gone quiet (#8).
 *
 * ## Why these are notifications and never actions
 *
 * A commission that is running late needs a decision only she can make: work
 * through the evening, or write to the customer and move the date. D4 and D6
 * are explicit that the system notifies and she acts — so nothing here changes
 * a stage, sends a customer anything, or cancels a thing.
 *
 * The overdue nudge is the one that earns its place. A missed deadline is
 * invisible until somebody looks at the right screen, and „I forgot" is the
 * failure that costs a customer.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** Stages where a deadline still means something. */
const ACTIVE_STAGES = ["confirmed", "in_production"]

const day = (value: Date) => value.toISOString().slice(0, 10)

export default async function watchProductionDeadlines(
  container: MedusaContainer
) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const madeToOrder = container.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )

  const productionOrders = (await madeToOrder.listProductionOrders(
    {} as never,
    { relations: ["payment_requests"] }
  )) as any[]

  const now = new Date()
  const today = day(now)

  for (const production of productionOrders) {
    // ── Deadlines ────────────────────────────────────────────────────────
    if (
      ACTIVE_STAGES.includes(production.stage) &&
      production.estimated_completion_at
    ) {
      const deadline = new Date(production.estimated_completion_at).getTime()
      const daysLeft = Math.ceil((deadline - now.getTime()) / DAY_MS)

      if (daysLeft < 0) {
        // #6 — repeated daily on purpose: an overdue commission stays a
        // problem until she does something about it, and a single warning on
        // the day it slipped is one she can miss.
        await notifyMerchant(container, {
          key: `mn:mto-over:${production.id}:${today}`,
          title: "Termín výroby už uplynul",
          description: `Zakázka měla být hotová ${new Intl.DateTimeFormat(
            "cs-CZ"
          ).format(new Date(production.estimated_completion_at))}. Dejte prosím zákazníkovi vědět, nebo termín posuňte.`,
          audience: "owner",
          urgent: true,
        })
      } else if (daysLeft <= 3) {
        // #5 — once per day per commission, not once per run.
        await notifyMerchant(container, {
          key: `mn:mto-due:${production.id}:${today}`,
          title:
            daysLeft === 0
              ? "Zakázka má být hotová dnes"
              : `Zakázka má být hotová za ${daysLeft} dní`,
          description: "Blíží se slíbený termín dokončení.",
          audience: "owner",
        })
      }
    }

    // ── Balances that have gone quiet ────────────────────────────────────
    // #8. D4 forbids an automatic reminder to the customer, so this nudges
    // *her* — the „Připomenout" button stays her decision.
    if (production.stage === "awaiting_balance" && production.balance_requested_at) {
      const waitingDays = Math.floor(
        (now.getTime() - new Date(production.balance_requested_at).getTime()) /
          DAY_MS
      )

      if (waitingDays >= 7) {
        const week = Math.floor(waitingDays / 7)
        await notifyMerchant(container, {
          key: `mn:baldue:${production.id}:${week}`,
          title: `Doplatek čeká už ${waitingDays} dní`,
          description:
            "Zákazník zatím nedoplatil. Připomenout mu to můžete tlačítkem v Zakázkách — samo se nic neodešle.",
          audience: "owner",
        })
      }
    }
  }

  logger.info(
    `[production] Zkontrolováno ${productionOrders.length} zakázek na termíny a doplatky.`
  )
}

export const config = {
  name: "watch-production-deadlines",
  // 07:10 — after the stock job and the digest, so the morning notifications
  // arrive in a sensible order.
  schedule: "10 7 * * *",
}
