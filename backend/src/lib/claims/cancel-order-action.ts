import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { cancelOrderWorkflow } from "@medusajs/medusa/core-flows"
import { transitionMerchantOrderWorkflow } from "../../workflows/transition-merchant-order"
import { formatMoney } from "../customer-email"
import { cancelProductionStage } from "../production-cancel"
import { retrieveClaim } from "./admin"
import { loadOrderMoney } from "./money"
import { loadClaimProduction } from "./production"
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
 *
 * Zrušená objednávka se zakázkou = zrušená zakázka: výrobní příkaz se uzavře
 * tou samou cestou jako „Zrušit zakázku" (lib/production-cancel), ať fronta
 * zakázek neukazuje „ve výrobě" u objednávky, která už neexistuje.
 */
export type CancelOrderForClaimResult = { cancelled: boolean; message: string }

/**
 * Jádro bez pravidel žádosti — volá ho i „Zrušit zakázku" (§12.4) u čisté
 * zakázky s vrácenou zálohou. Pravidla (druh, stav, peníze) hlídá volající.
 */
export const cancelOrderNatively = async (
  scope: MedusaContainer,
  order: { id: string; display_id?: number | string | null },
  actor: string | null = null
): Promise<CancelOrderForClaimResult> => {
  let cancelled = true
  let message = `Objednávka #${order.display_id ?? ""} zrušena, sklad uvolněn.`
  try {
    await cancelOrderWorkflow(scope).run({
      input: { order_id: order.id, canceled_by: actor ?? undefined } as never,
    })
  } catch (error) {
    cancelled = false
    const detail = error instanceof Error ? error.message : String(error)
    message = `Objednávku se nepodařilo zrušit nativně (${detail}). Fáze ve frontě je nastavená na „Zrušeno" — sklad případně upravte ručně.`
  }

  await transitionMerchantOrderWorkflow(scope)
    .run({
      input: {
        order_id: order.id,
        stage: "cancelled",
        changed_by: actor,
        reconcile: true,
      },
    })
    .catch(() => {
      // Fáze je zrcadlo; když se nepovede, nativní zrušení platí dál a
      // reconcile subscriber ji dotáhne.
    })

  // Zakázka k objednávce (je-li) — uzavřít výrobní příkaz. Best-effort: zrušená
  // objednávka platí i bez toho, fronta zakázek by jen ukazovala starou fázi.
  try {
    const production = await loadClaimProduction(scope, order.id)
    if (production && production.block.stage !== "cancelled") {
      await cancelProductionStage(scope, {
        productionOrder: production.productionOrder,
        orderId: order.id,
      })
      message += " Zakázka k objednávce je zrušená."
    }
  } catch (error) {
    message += ` Zakázku k objednávce se nepodařilo zrušit (${
      error instanceof Error ? error.message : String(error)
    }) — zrušte ji v modulu zakázek.`
  }

  return { cancelled, message }
}

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

  return cancelOrderNatively(scope, money.order, actor)
}
