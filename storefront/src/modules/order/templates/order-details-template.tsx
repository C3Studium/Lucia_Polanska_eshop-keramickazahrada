"use client"

import { HttpTypes } from "@medusajs/types"
import React from "react"

import PremiumActionLink from "@modules/common/components/premium-action-link"
import Help from "@modules/order/components/help"
import CarrierDamageNotice from "@modules/order/components/carrier-damage"
import { isCarrierShippingMethod } from "@lib/util/carrier"
import ReturnRequest from "@modules/order/components/return-request"
import Items from "@modules/order/components/items"
import OrderDetails from "@modules/order/components/order-details"
import OrderSummary from "@modules/order/components/order-summary"
import PaymentDetails from "@modules/order/components/payment-details"
import ShippingDetails from "@modules/order/components/shipping-details"
import {
  AccountPageReveal,
  AccountSectionReveal,
} from "@modules/account/components/account-page-reveal"
import s from "./styles/order-details.module.scss"

type OrderDetailsTemplateProps = {
  order: HttpTypes.StoreOrder
}

const OrderDetailsTemplate: React.FC<OrderDetailsTemplateProps> = ({
  order,
}) => {
  return (
    <AccountPageReveal
      className={s.accountOrderDetailsRoot}
      data-testid="order-details-page-wrapper"
    >
      <AccountSectionReveal className={s.accountOrderDetailsHeader}>
        <p>Objednávka #{order.display_id}</p>
        <div className={s.accountOrderDetailsHeading}>
          <h1>
            Detail
            <em>objednávky.</em>
          </h1>
          <PremiumActionLink
            href="/account/orders"
            text="Zpět na objednávky"
            className={s.accountOrderBackLink}
          />
        </div>
      </AccountSectionReveal>

      <AccountSectionReveal
        className={s.accountOrderDetailsIntro}
      >
        <OrderDetails order={order} showStatus />
      </AccountSectionReveal>

      <AccountSectionReveal
        className={s.accountOrderDetailsLayout}
      >
        <div className={s.accountOrderDetailsMain}>
          <section className={s.accountOrderDetailsSection}>
            <span>01 · výrobky</span>
            <h2>Co jste objednali</h2>
            <Items order={order} />
          </section>

          <section className={s.accountOrderDetailsSection}>
            <span>02 · cesta</span>
            <ShippingDetails order={order} />
          </section>

          <section className={s.accountOrderDetailsSection}>
            <span>03 · úhrada</span>
            <PaymentDetails order={order} />
          </section>
        </div>

        <aside className={s.accountOrderDetailsAside}>
          <span>04 · souhrn</span>
          <OrderSummary order={order} />
        </aside>
      </AccountSectionReveal>

      <AccountSectionReveal>
        {/* The backend has a complete returns flow that had no storefront surface at all —
            a customer had no way to start one. */}
        <section className={s.accountOrderDetailsSection}>
          <span>05 · vrácení</span>
          <ReturnRequest
            orderId={order.id}
            email={order.email ?? ""}
            customerName={
              [order.shipping_address?.first_name, order.shipping_address?.last_name]
                .filter(Boolean)
                .join(" ") || undefined
            }
          />
        </section>
      </AccountSectionReveal>

      <AccountSectionReveal>
        <CarrierDamageNotice
          orderNumber={order.display_id}
          isCarrierDelivery={isCarrierShippingMethod(order as any)}
          stage="delivered"
        />

        <Help />
      </AccountSectionReveal>
    </AccountPageReveal>
  )
}

export default OrderDetailsTemplate
