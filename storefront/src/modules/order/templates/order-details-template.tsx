"use client"

import { HttpTypes } from "@medusajs/types"
import React from "react"

import PremiumActionLink from "@modules/common/components/premium-action-link"
import Help from "@modules/order/components/help"
import CarrierDamageNotice from "@modules/order/components/carrier-damage"
import { isCarrierShippingMethod } from "@lib/util/carrier"
import RefundRequest from "@modules/order/components/refund-request"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import type { OrderClaims } from "@lib/util/claims"
import type { OrderEditMode } from "@lib/data/order-edit"
import Items from "@modules/order/components/items"
import OrderDetails from "@modules/order/components/order-details"
import OrderSummary from "@modules/order/components/order-summary"
import PaymentDetails from "@modules/order/components/payment-details"
import ShippingDetails from "@modules/order/components/shipping-details"
import CommissionConversation from "@modules/order/components/commission-conversation"
import BalancePayPanel from "@modules/order/components/balance-pay"
import type { CommissionNote } from "@lib/util/made-to-order"
import type { CommissionBalance } from "@lib/data/made-to-order"
import {
  AccountPageReveal,
  AccountSectionReveal,
} from "@modules/account/components/account-page-reveal"
import s from "./styles/order-details.module.scss"

type OrderDetailsTemplateProps = {
  order: HttpTypes.StoreOrder
  /* Načítá ho stránka, ne tahle šablona: je klientská a datová vrstva je
     `server-only`. Viz komentář v `carrier-damage`. */
  claimForm?: { title: string; url: string } | null
  /** Vlákno zakázky. `null` = není zakázka → konverzace se nevykreslí. */
  commissionNotes?: CommissionNote[] | null
  /** Stav doplatku zakázky → panel „Doplatit", když něco zbývá. */
  commissionBalance?: CommissionBalance | null
  /**
   * Podepsaný token pro reklamaci / vrácení (stejný formulář jako z e-mailu
   * a z potvrzení — druh + „co požadujete" + fotky). `null` → formulář se
   * nenabídne, jen odkaz na e-mail.
   */
  selfServiceToken?: string | null
  /** Stav žádostí + zda jde odstoupit (ze serveru, tímtéž tokenem). */
  claims?: OrderClaims | null
  /**
   * Odkaz na úpravu objednávky (`/order/:id/edit`) — jen když jde něco
   * upravit (`mode`) nebo dokončit čekající změnu (`pending`). `null` = nic.
   */
  edit?: { mode: OrderEditMode; pending: boolean } | null
}

const OrderDetailsTemplate: React.FC<OrderDetailsTemplateProps> = ({
  order,
  claimForm = null,
  commissionNotes = null,
  commissionBalance = null,
  selfServiceToken = null,
  claims = null,
  edit = null,
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
        {/* Údaje (doručení + platba) nahoře, teprve pak seznam kusů — stejné
            pořadí jako na potvrzení objednávky: co si zákazník kontroluje, je
            hned nahoře, seznam kusů je až pod tím k prohlédnutí. */}
        <div className={s.accountOrderDetailsMain}>
          <section className={s.accountOrderDetailsSection}>
            <span>01 · cesta</span>
            <ShippingDetails order={order} />
          </section>

          <section className={s.accountOrderDetailsSection}>
            <span>02 · úhrada</span>
            <PaymentDetails order={order} />
          </section>

          <section className={s.accountOrderDetailsSection}>
            <span>03 · výrobky</span>
            <h2>Co jste objednali</h2>
            <Items order={order} />
          </section>
        </div>

        <aside className={s.accountOrderDetailsAside}>
          <span>04 · souhrn</span>
          <OrderSummary order={order} />
          {/* Úprava objednávky — vlastní stránka (stejná jako z e-mailu); tady
              jen věta, co jde, a vstup. */}
          {edit && (
            <div className={s.accountOrderEdit}>
              <p>
                {edit.pending
                  ? "Úprava objednávky čeká na zaplacení rozdílu — dokončete ji, nebo ji zrušte."
                  : edit.mode === "swap_only"
                    ? "Objednávka je zabalená — vyměnit jde ještě provedení za stejnou cenu."
                    : "Objednávku můžete ještě upravit — počet kusů, provedení, přidat něco z obchodu."}
              </p>
              <LocalizedClientLink
                className={s.accountOrderEditLink}
                href={`/order/${order.id}/edit`}
              >
                <span>{edit.pending ? "Dokončit úpravu" : "Upravit objednávku"}</span>
                <i aria-hidden="true">↗</i>
              </LocalizedClientLink>
            </div>
          )}
          {/* Doplatek zakázky — „Doplatit", když ještě něco zbývá. */}
          <BalancePayPanel balance={commissionBalance} />
          {/* Konverzace s ateliérem — jen u zakázky; stejný popup komponent jako
              na potvrzení i na stránkách úpravy/reklamace. */}
          {commissionNotes && (
            <CommissionConversation
              orderId={order.id}
              notes={commissionNotes}
            />
          )}
        </aside>
      </AccountSectionReveal>

      <AccountSectionReveal>
        {/* Reklamace / vrácení / odstoupení — TÝŽ formulář jako z e-mailu a z
            potvrzení (druh, u reklamace „co požadujete", popis, fotky), gating
            ze serveru. Když už žádost běží, komponenta místo formuláře ukáže
            její stav. Bez tokenu (nepovedlo se získat) jen odkážeme na e-mail. */}
        <section
          className={`${s.accountOrderDetailsSection} ${s.accountOrderDetailsClaims}`}
        >
          <span>05 · reklamace a vrácení</span>
          {selfServiceToken && claims ? (
            <>
              <RefundRequest
                orderId={order.id}
                token={selfServiceToken}
                claims={claims}
                currencyCode={order.currency_code}
                claimForm={claimForm}
              />
              {claims.requests.length > 0 && (
                <LocalizedClientLink
                  className={s.accountOrderClaimsLink}
                  href={`/order/${order.id}/claims?token=${encodeURIComponent(selfServiceToken)}`}
                >
                  Všechny žádosti k objednávce
                </LocalizedClientLink>
              )}
            </>
          ) : (
            <p className={s.accountOrderClaimsFallback}>
              Reklamaci nebo vrácení podáte z odkazu v e-mailu s potvrzením
              objednávky, nebo nám napište na{" "}
              <a href="mailto:info@keramickazahrada.cz">
                info@keramickazahrada.cz
              </a>
              .
            </p>
          )}
        </section>
      </AccountSectionReveal>

      <AccountSectionReveal>
        <CarrierDamageNotice
          orderNumber={order.display_id}
          isCarrierDelivery={isCarrierShippingMethod(order as any)}
          claimForm={claimForm}
          stage="delivered"
        />

        <Help />
      </AccountSectionReveal>
    </AccountPageReveal>
  )
}

export default OrderDetailsTemplate
