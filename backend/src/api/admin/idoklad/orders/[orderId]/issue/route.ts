import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import {
  ensureInvoiceForOrder,
  ensureMadeToOrderInvoices,
  invoiceStateOf,
  loadInvoiceOrder,
} from "../../../../../../lib/idoklad-invoice"
import { MADE_TO_ORDER_MODULE } from "../../../../../../modules/made-to-order"
import type MadeToOrderModuleService from "../../../../../../modules/made-to-order/service"

/**
 * „Vystavit fakturu" / „Vystavit znovu" on the order-detail widget.
 *
 * Issues the invoice for this order unless one already exists — the same
 * never-twice rule the subscribers follow; re-issuing is only possible after
 * a *failed* attempt, which never stamped an invoice id. The admin button
 * does not gate on payment: clicking it is the merchant's explicit decision.
 *
 * Zakázka fakturuje JINAK — záloha i doplatek zvlášť (dvě povinné faktury),
 * nikdy ne jednu plnou fakturu na celek. Proto se u zakázky jede dvoufakturovou
 * cestou, která vystaví doklad jen na to, co je opravdu zaplacené.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const orderId = req.params.orderId

  // Je to zakázka? (produkční objednávka → ano)
  let isMadeToOrder = false
  try {
    const mto = req.scope.resolve<MadeToOrderModuleService>(MADE_TO_ORDER_MODULE)
    const [productionOrder] = await mto.listProductionOrders({
      order_id: orderId,
    } as never)
    isMadeToOrder = Boolean(productionOrder)
  } catch {
    // Modul zakázek nedostupný → ber to jako běžnou objednávku.
  }

  if (isMadeToOrder) {
    const result = await ensureMadeToOrderInvoices(req.scope, orderId)

    if (result.status === "skipped") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        result.reason ?? "Fakturu teď nelze vystavit."
      )
    }
    if (result.status === "failed") {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        result.reason ?? "Vystavení faktury v iDokladu selhalo."
      )
    }

    // created i exists: vrať aktuální stav zálohové faktury pro refresh widgetu.
    // „exists" bez vystavené faktury znamená, že ještě není co fakturovat.
    const order = await loadInvoiceOrder(req.scope, orderId)
    const state = order ? invoiceStateOf(order) : null
    if (result.status === "exists" && !state?.invoice_id) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Zatím není zaplacená žádná platba — fakturu nelze vystavit."
      )
    }
    res.json({ invoice: state })
    return
  }

  const result = await ensureInvoiceForOrder(req.scope, orderId, {
    source: "admin",
  })

  if (result.status === "exists") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Faktura ${result.state?.invoice_number ?? ""} už byla vystavena — dvakrát ji nevystavíme.`.trim()
    )
  }
  if (result.status === "skipped") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      result.reason ?? "Fakturu teď nelze vystavit."
    )
  }
  if (result.status === "failed") {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      result.reason ?? "Vystavení faktury v iDokladu selhalo."
    )
  }

  res.json({ invoice: result.state })
}
