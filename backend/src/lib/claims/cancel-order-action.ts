import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { cancelOrderWorkflow } from "@medusajs/medusa/core-flows"
import { transitionMerchantOrderWorkflow } from "../../workflows/transition-merchant-order"
import { formatMoney } from "../customer-email"
import { retrieveClaim } from "./admin"
import { loadOrderMoney } from "./money"
import { MONEY_EPSILON } from "./refund-rules"

/**
 * Zrušit objednávku a uvolnit sklad po odstoupení / vrácení
 * (docs/reklamace-a-zruseni.md §3) — JEDNA cesta pro tlačítko „Zrušit
 * objednávku a uvolnit sklad" i pro „Schválit, vrátit peníze a zrušit" u
 * odstoupení (route `decide` s `cancel_order`).
 *
 * Dostupné AŽ když je žádost `resolved`, nebo na objednávce nezbývá nic
 * zachyceného. Teprve pak nativní `cancelOrderWorkflow` — jeho vlastní
 * refundace zachycených plateb je díky tomu no-op a peníze se nikdy nevrátí
 * „samy" mimo protokol a dobropis. Zrušení nativní objednávky uvolní rezervace
 * a pošle `order.canceled` (e-mail zákazníkovi, s vlajkou, že refundace je
 * zapsaná). Pak merchantská fáze `cancelled` (reconcile — je to důsledek, ne
 * klik ve frontě).
 *
 * Když nativní zrušení selže (např. doručená zásilka se zrušit nedá), fáze
 * `cancelled` se nastaví i tak a výsledek řekne proč — majitelka ve frontě
 * vidí výsledek, ne tichou chybu.
 */
export type CancelOrderForClaimResult = { cancelled: boolean; message: string }

export const cancelOrderForClaim = async (
  scope: MedusaContainer,
  requestId: string,
  actor: string | null = null
): Promise<CancelOrderForClaimResult> => {
  const request = await retrieveClaim(scope, requestId)

  if (request.kind !== "odstoupeni" && request.kind !== "vraceni") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Objednávku lze zrušit jen u odstoupení od smlouvy nebo vrácení zboží — u reklamace objednávka zůstává."
    )
  }
  if (request.status === "rejected" || request.status === "cancelled") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Žádost byla zamítnuta nebo stornována — objednávka se neruší."
    )
  }

  const money = await loadOrderMoney(scope, request.order_id)
  if (!money) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Objednávka k této žádosti nebyla nalezena."
    )
  }
  if (request.status !== "resolved" && money.state.remaining > MONEY_EPSILON) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Nejdřív vraťte peníze — na objednávce zbývá ${formatMoney(
        money.state.remaining,
        money.order.currency_code
      )}. Zrušit ji půjde, až bude žádost vyřízená nebo nezbude nic zachyceného.`
    )
  }

  let cancelled = true
  let message = `Objednávka #${money.order.display_id} zrušena, sklad uvolněn.`
  try {
    await cancelOrderWorkflow(scope).run({
      input: { order_id: request.order_id } as never,
    })
  } catch (error) {
    cancelled = false
    const detail = error instanceof Error ? error.message : String(error)
    message = `Objednávku se nepodařilo zrušit nativně (${detail}). Fáze ve frontě je nastavená na „Zrušeno" — sklad případně upravte ručně.`
  }

  await transitionMerchantOrderWorkflow(scope)
    .run({
      input: {
        order_id: request.order_id,
        stage: "cancelled",
        changed_by: actor,
        reconcile: true,
      },
    })
    .catch(() => {
      // Fáze je zrcadlo; když se nepovede, nativní zrušení platí dál a
      // reconcile subscriber ji dotáhne.
    })

  return { cancelled, message }
}
