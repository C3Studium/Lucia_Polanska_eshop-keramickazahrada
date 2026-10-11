import type { MedusaContainer } from "@medusajs/framework/types"
import { claimService } from "../claims/admin"
import { EDIT_REFUND_KIND } from "../claims/constants"
import { realCustomerName } from "../claims/intake"

/**
 * Úprava objednávky zlevnila objednávku placenou kartou (§3c.6) → rozdíl se
 * vrací přes modul Reklamace a zrušení, ne tlačítkem „Vrátit rozdíl": jen tak
 * vznikne refundace s potvrzením ComGate a dobropisem (§45 ZDPH), stejně
 * jako u každého jiného vracení peněz.
 *
 * Žádost druhu `uprava` vzniká rovnou SCHVÁLENÁ s rozhodnutím „vrácení
 * peněz" — zákazník o nic nežádal, rozdíl mu prostě patří. Peníze se ale
 * automaticky nevrací (zásada modulu): Lucie otevře žádost a v košíku
 * vrácení potvrdí částku. Výchozí částka (`suggested_amount`) = rozdíl,
 * proto jediný řádek `line_items` nese právě ten rozdíl.
 *
 * Bez zákaznických e-mailů o přijetí (to není reklamace). E-mail přijde až
 * s vrácením peněz (return-resolved), jako u ostatních žádostí.
 */
export const createEditRefundRequest = async (
  container: MedusaContainer,
  order: any,
  input: { amount: number; changeId: string }
): Promise<string> => {
  const now = new Date()
  const amount = Math.round(input.amount * 100) / 100
  const currency = String(order.currency_code ?? "czk").toLowerCase()
  const resolveBy = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

  const request = await claimService(container).createReturnRequests({
    order_id: order.id,
    order_display_id: String(order.display_id),
    email: order.email ?? "",
    customer_name: realCustomerName(order) ?? undefined,
    kind: EDIT_REFUND_KIND,
    reason: `Zákazník upravil objednávku a vyšla levněji — rozdíl ${amount} Kč patří zpátky na kartu.`,
    requested_resolution: "refund",
    resolution: "refund",
    status: "approved",
    decided_at: now,
    decision_note: "Založeno automaticky úpravou objednávky zákazníkem.",
    resolve_by: resolveBy,
    line_items: [
      {
        line_item_id: `uprava:${input.changeId}`,
        title: "Rozdíl z úpravy objednávky",
        variant_title: null,
        thumbnail: null,
        quantity: 1,
        unit_price: amount,
        total: amount,
        currency_code: currency,
      },
    ] as unknown as Record<string, unknown>,
  } as never)

  return (request as any).id as string
}
