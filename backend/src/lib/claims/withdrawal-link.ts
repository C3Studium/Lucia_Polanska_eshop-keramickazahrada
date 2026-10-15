import type { MedusaContainer } from "@medusajs/framework/types"
import { orderWithdrawalUrl } from "../order-access-link"
import { allMadeToOrder, isOrderCancelled, loadClaimOrder } from "./context"

/**
 * Odkaz „Odstoupit od smlouvy" do e-mailů o odeslání a převzetí (§ 1830a OZ).
 *
 * Prázdný řetězec (šablona pak odstavec nevykreslí), když odstoupit nejde
 * z povahy objednávky: čistá zakázka na míru (§ 1837 písm. d) — odkaz by
 * sliboval právo, které zákazník nemá — nebo zrušená objednávka. Lhůtu
 * neřeší: e-mail o odeslání i o převzetí chodí na jejím začátku a stránka
 * po lhůtě sama vysvětlí, proč už to nejde.
 *
 * Chyba načtení e-mail nezastaví — pošle se bez odkazu.
 */
export const withdrawalUrlFor = async (
  container: MedusaContainer,
  orderId: string
): Promise<string> => {
  try {
    const order = await loadClaimOrder(container, orderId)
    if (!order || allMadeToOrder(order) || isOrderCancelled(order)) {
      return ""
    }
    return orderWithdrawalUrl(orderId)
  } catch {
    return ""
  }
}
