import { Metadata } from "next"
import s from "../styles/orders.module.scss"
import { redirect } from "next/navigation"
import { listOrders } from "@lib/data/orders"
import { getCommissionBalance } from "@lib/data/made-to-order"
import { getPageCopy } from "@lib/data/site-copy"
import { isMadeToOrderLine } from "@lib/util/commission"
import { commissionsOf, type Commission } from "@lib/util/made-to-order"
import OrdersTemplate from "@modules/account/templates/orders-template"


export const metadata: Metadata = {
  title: "Moje objednávky",
  description: "Přehled předchozích objednávek a jejich stavu.",
}

export default async function Orders() {
  // Texty seznamu z CMS (blok `ucet.objednavky`); výpadek CMS = texty z kódu.
  const [orders, copy] = await Promise.all([listOrders(), getPageCopy("ucet")])

  /*
   * `listOrders` returns null for an unauthenticated request now — it used to throw, which is
   * what put „[medusa] request setup failed: Unauthorized" in the console and took the page with
   * it. A signed-out visitor belongs at the login form, not on a 404.
   *
   * An empty account still renders: `listOrders` gives back `[]`, not null, when there is nobody
   * to show orders for but a session exists.
   */
  if (!orders) {
    redirect("/account")
  }

  /*
   * Z-A „zakázka = položka": u objednávek se zakázkou stručný stav každé
   * zakázky („Zakázka: Domovní číslo — ve výrobě od 20. 10. 2026"). Stav zná
   * jen `/balance`, tak se ptáme — ale jen u objednávek, které zakázkový řádek
   * mají (seznam je stránkovaný po 10, běžná objednávka se nedotazuje).
   * Výpadek = bez řádku, seznam se nerozbije.
   */
  const commissionEntries = await Promise.all(
    orders
      .filter((order) => ((order.items ?? []) as any[]).some(isMadeToOrderLine))
      .map(async (order) => {
        const balance = await getCommissionBalance(order.id).catch(() => null)
        return [order.id, commissionsOf(balance)] as const
      })
  )
  const commissionsByOrder: Record<string, Commission[]> = Object.fromEntries(
    commissionEntries.filter(([, commissions]) => commissions.length > 0)
  )

  return (
    <main className={s.root}>
      <OrdersTemplate
        orders={orders}
        copy={copy["ucet.objednavky"]}
        commissionsByOrder={commissionsByOrder}
      />
    </main>
  )
}
