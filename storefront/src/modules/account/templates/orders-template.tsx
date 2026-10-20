import s from "./styles/orders-template.module.scss"

import { HttpTypes } from "@medusajs/types"
import type { Commission } from "@lib/util/made-to-order"
import { itemFieldPath, itemText } from "@lib/util/site-copy"
import type { CopyBlock } from "@lib/util/site-copy"
import CmsText from "@modules/common/components/cms-text"
import OrderOverview from "../components/order-overview"
// TransferRequestForm is intentionally disabled until order transfers are part
// of the customer-account product flow again.
// import TransferRequestForm from "../components/transfer-request-form"
import {
  AccountPageReveal,
  AccountSectionReveal,
} from "../components/account-page-reveal"

type ProfileTemplateProps = {
  orders: HttpTypes.StoreOrder[]
  /**
   * Blok `ucet.objednavky` — hlavička seznamu (`oboci`, `nadpis` se
   * zvýrazněným koncem v `note`, `text`) a prázdný stav (`prazdne.*`, ten
   * čte OrderOverview). Počet objednávek je údaj, zůstává v kódu.
   */
  copy?: CopyBlock
  /** Zakázky objednávek (id objednávky → zakázky) pro stručný stav v kartě (Z-A). */
  commissionsByOrder?: Record<string, Commission[]>
}

export const OrdersTemplate = ({
  orders,
  copy,
  commissionsByOrder,
}: ProfileTemplateProps) => {
  const doc = copy?.id ?? null
  const lead = itemText(copy, "nadpis", "Vaše")
  return (
    <AccountPageReveal className={s.content} data-testid="orders-page-wrapper">
      <AccountSectionReveal className={s.header}>
        <CmsText as="p" className={s.eyebrow} doc={doc} field={itemFieldPath(copy, "oboci")}>
          {itemText(copy, "oboci", "Váš účet · objednávky")}
        </CmsText>
        <div className={s.titleRow}>
          {/* Začátek nadpisu ve vlastním spanu jen v náhledu Studia — mimo něj
              je DOM stejný jako dřív (holý text a `em`). */}
          <h1 className={s.title}>
            {doc ? (
              <CmsText doc={doc} field={itemFieldPath(copy, "nadpis")}>{lead}</CmsText>
            ) : (
              lead
            )}{" "}
            <CmsText as="em" doc={doc} field={itemFieldPath(copy, "nadpis", "note")}>
              {itemText(copy, "nadpis", "objednávky.", "note")}
            </CmsText>
          </h1>
          <span>{String(orders.length).padStart(2, "0")} objednávek</span>
        </div>
        <CmsText as="p" className={s.desc} doc={doc} field={itemFieldPath(copy, "text")}>
          {itemText(
            copy,
            "text",
            "Všechno, co jste si u nás objednali — od nejnovějšího. U každé objednávky najdete datum, částku i aktuální stav."
          )}
        </CmsText>
      </AccountSectionReveal>
      <AccountSectionReveal className={s.body}>
        <OrderOverview
          orders={orders}
          copy={copy}
          commissionsByOrder={commissionsByOrder}
        />
        {/* Order transfer is intentionally disabled for now.
        <Divider />
        <TransferRequestForm />
        */}
      </AccountSectionReveal>
    </AccountPageReveal>
  )
}

export default OrdersTemplate
