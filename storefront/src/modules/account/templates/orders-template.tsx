import s from "./styles/orders-template.module.scss"

import { HttpTypes } from "@medusajs/types"
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
}

export const OrdersTemplate = ({ orders }: ProfileTemplateProps) => {
  return (
    <AccountPageReveal className={s.content} data-testid="orders-page-wrapper">
      <AccountSectionReveal className={s.header}>
        <p className={s.eyebrow}>Soukromý archiv · objednávky</p>
        <div className={s.titleRow}>
          <h1 className={s.title}>
            Vaše <em>objednávky.</em>
          </h1>
          <span>{String(orders.length).padStart(2, "0")} záznamů</span>
        </div>
        <p className={s.desc}>
          Objekty, které si k vám našly cestu, seřazené jako klidný archiv — s
          částkou, datem i aktuálními detaily na jednom místě.
        </p>
      </AccountSectionReveal>
      <AccountSectionReveal className={s.body}>
        <OrderOverview orders={orders} />
        {/* Order transfer is intentionally disabled for now.
        <Divider />
        <TransferRequestForm />
        */}
      </AccountSectionReveal>
    </AccountPageReveal>
  )
}

export default OrdersTemplate
