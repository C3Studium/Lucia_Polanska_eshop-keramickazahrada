import { paymentMethodTitle } from "@lib/constants"
import { translateStatus } from "@lib/i18n/statuses"
import { convertToLocale } from "@lib/util/money"
import OrderProgressPanel from "@modules/order/components/order-progress"
import type { OrderProgress } from "@lib/data/order-progress"
import { HttpTypes } from "@medusajs/types"
import LineItemOptions from "@modules/common/components/line-item-options"
import type { CommissionNote } from "@lib/util/made-to-order"
import { addOrderCommissionNote } from "@lib/data/commission-actions"
import { isCarrierShippingMethod } from "@lib/util/carrier"
import CarrierDamageNotice from "@modules/order/components/carrier-damage"
import CommissionBrief from "@modules/checkout/components/commission-brief"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import PremiumActionLink from "@modules/common/components/premium-action-link"
import Thumbnail from "@modules/products/components/thumbnail"
import s from "./styles/oder-complete.module.scss"
import { pickupPointLabel } from "@lib/util/pickup-point"

type OrderCompletedTemplateProps = {
  order: HttpTypes.StoreOrder
  progress?: OrderProgress | null
  /** Used when the merchant workflow has no stage for this order yet. */
  progressFallback?: string
  /** The zakázka's diary, when this order has one. Absent for ordinary orders. */
  commissionNotes?: CommissionNote[] | null
}

const formatDate = (date: string | Date) =>
  new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))

export default async function OrderCompletedTemplate({
  order,
  progress = null,
  progressFallback = "Přijato",
  commissionNotes = null,
}: OrderCompletedTemplateProps) {
  const money = (amount?: number | null) =>
    convertToLocale({
      amount: amount ?? 0,
      currency_code: order.currency_code,
    })

  const items = [...(order.items ?? [])].sort((a, b) =>
    (a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1
  )
  const payment = order.payment_collections?.[0]?.payments?.[0]
  const shippingMethod = order.shipping_methods?.at(-1) as
    | (HttpTypes.StoreOrderShippingMethod & { amount?: number })
    | undefined
  const orderNumber = String(order.display_id).padStart(4, "0")
  // Persisted at checkout by the shipping step; the confirmation never showed it (spec §4).
  const pickupPoint = pickupPointLabel(
    order.metadata as Record<string, unknown> | undefined
  )
  const fulfillmentStatus = translateStatus(
    order.fulfillment_status,
    "fulfillment",
    "cs"
  )
  const paymentStatus = translateStatus(
    order.payment_status,
    "payment",
    "cs"
  )
  const paymentTitle = payment
    ? paymentMethodTitle(payment.provider_id)
    : "Čeká na přiřazení"

  return (
    <main className={s.root}>
      <div className={s.ambient} aria-hidden="true">
        <span />
        <i />
        <b />
      </div>

      <div className={s.container} data-testid="order-complete-container">
        <header className={s.masthead}>
          <span>Objednávka · {orderNumber}</span>
          {/* TODO(BACKEND): Derive this masthead label from fulfillment_status instead of using a fixed confirmation label. */}
          <span className={s.confirmed}>Máme ji</span>
        </header>

        <section className={s.hero}>
          <div className={s.heroCopy}>
            <p className={s.eyebrow}>Objednávka je uložená</p>
            <h1 className={s.title}>
              <span>Děkujeme!</span>
              <em>Teď se do toho pustím.</em>
            </h1>
          </div>

          <div className={s.heroAside}>
            <p>
              Potvrzení jsme poslali na <strong>{order.email}</strong>. Jakmile
              se něco pohne, ozveme se vám znovu.
            </p>
            <span>Reference · {orderNumber}</span>
          </div>
        </section>

        {/* A three-step progress rail that never moved was a trust liability: it implied
            tracking the shop cannot yet provide (spec §4). It returns when the backend exposes
            a real fulfillment timeline — until then the confirmation states only what is true. */}

        <OrderProgressPanel progress={progress} fallbackLabel={progressFallback} />

        {/* Carrier deliveries only — Osobní odběr has no courier to inspect in front
            of and no carrier to claim against. */}
        <section className={s.commission}>
          <CarrierDamageNotice
            orderNumber={order.display_id}
            isCarrierDelivery={isCarrierShippingMethod(order as any)}
            stage="pending"
          />
        </section>

        {/* The conversation about a commissioned piece does not end at checkout: it runs
            until the piece does. Only rendered when the backend says this order is a
            zakázka — an ordinary order has no diary and gets no box. */}
        {commissionNotes && (
          <section className={s.commission} aria-label="Zakázková výroba">
            <CommissionBrief
              variant="order"
              note=""
              photos={[]}
              notes={commissionNotes}
              onSubmitAction={async (input) =>
                addOrderCommissionNote(order.id, {
                  note: input.note,
                  newPhotos: input.newPhotos,
                })
              }
            />
          </section>
        )}

        {/* BACKEND-HOOKED: These values come from the retrieved StoreOrder response. */}
        <section className={s.orderMeta} aria-label="Údaje objednávky">
          {pickupPoint && (
            <div>
              <span>Výdejní místo</span>
              <strong data-testid="order-pickup-point">{pickupPoint}</strong>
            </div>
          )}
          <div>
            <span>Vytvořeno</span>
            <strong data-testid="order-date">
              {formatDate(order.created_at)}
            </strong>
          </div>
          <div>
            <span>Stav objednávky</span>
            <strong data-testid="order-status">{fulfillmentStatus}</strong>
          </div>
          <div>
            <span>Stav platby</span>
            <strong data-testid="order-payment-status">{paymentStatus}</strong>
          </div>
          <div>
            <span>Číslo objednávky</span>
            <strong data-testid="order-id">#{orderNumber}</strong>
          </div>
        </section>

        {/* BACKEND-HOOKED: Products, quantities, prices, discounts and totals come from StoreOrder. */}
        <div className={s.purchaseGrid}>
          <section className={s.objects}>
            <div className={s.sectionHead}>
              <div>
                <p>01 · Co jste objednali</p>
                <h2>Kolik to dělá</h2>
              </div>
              <span>
                {items.reduce((count, item) => count + item.quantity, 0)} ks
              </span>
            </div>

            <div className={s.itemList} data-testid="products-table">
              {items.map((item, index) => {
                const unitPrice = item.unit_price ?? 0
                const lineTotal =
                  (item as HttpTypes.StoreOrderLineItem & { total?: number })
                    .total ?? unitPrice * item.quantity

                return (
                  <article
                    className={s.item}
                    key={item.id}
                    data-testid="product-row"
                  >
                    <span className={s.itemIndex}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className={s.thumbnail}>
                      <Thumbnail thumbnail={item.thumbnail} size="square" />
                    </div>
                    <div className={s.itemCopy}>
                      <p>Z ateliéru</p>
                      <h3 data-testid="product-name">{item.product_title}</h3>
                      <div className={s.variant}>
                        <LineItemOptions
                          variant={item.variant}
                          data-testid="product-variant"
                        />
                      </div>
                    </div>
                    <div className={s.itemQuantity}>
                      <span>Množství</span>
                      <strong data-testid="product-quantity">
                        {item.quantity} × {money(unitPrice)}
                      </strong>
                    </div>
                    <div className={s.itemTotal}>
                      <span>Celkem</span>
                      <strong>{money(lineTotal)}</strong>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          <aside className={s.receipt}>
            <div className={s.receiptInner}>
              <p className={s.receiptNote}>
                Bezpečná platba · pečlivé balení
              </p>
              <span className={s.receiptEyebrow}>02 · Souhrn</span>
              <h2>Kolik to dělá</h2>

              <div className={s.totalRows}>
                <div>
                  <span>Mezisoučet</span>
                  <strong>{money(order.item_total)}</strong>
                </div>
                {order.discount_total > 0 && (
                  <div>
                    <span>Sleva</span>
                    <strong>− {money(order.discount_total)}</strong>
                  </div>
                )}
                {order.gift_card_total > 0 && (
                  <div>
                    <span>Dárkový poukaz</span>
                    <strong>− {money(order.gift_card_total)}</strong>
                  </div>
                )}
                <div>
                  <span>Doprava</span>
                  <strong>{money(order.shipping_total)}</strong>
                </div>
                <div>
                  <span>Daně</span>
                  <strong>{money(order.tax_total)}</strong>
                </div>
              </div>

              <div className={s.grandTotal}>
                <span>Celkem</span>
                <strong>{money(order.total)}</strong>
              </div>

              <div className={s.receiptStatus}>
                <span>Platba</span>
                <strong>{paymentStatus}</strong>
              </div>
            </div>
          </aside>
        </div>

        {/* BACKEND-HOOKED: Delivery, contact, shipping method and payment data come from StoreOrder. */}
        <section className={s.details}>
          <article className={s.detailCard}>
            <div className={s.detailHeading}>
              <span>03</span>
              <div>
                <p>Doručení</p>
                <h2>Kam to pošleme</h2>
              </div>
            </div>

            <div className={s.detailGrid}>
              <div data-testid="shipping-address-summary">
                <span>Adresa</span>
                <strong>
                  {order.shipping_address?.first_name}{" "}
                  {order.shipping_address?.last_name}
                </strong>
                <p>
                  {order.shipping_address?.address_1}
                  {order.shipping_address?.address_2
                    ? `, ${order.shipping_address.address_2}`
                    : ""}
                  <br />
                  {order.shipping_address?.postal_code}{" "}
                  {order.shipping_address?.city}
                  <br />
                  {order.shipping_address?.country_code?.toUpperCase()}
                </p>
              </div>
              <div data-testid="shipping-contact-summary">
                <span>Kontakt</span>
                <strong>{order.email}</strong>
                <p>{order.shipping_address?.phone || "Telefon neuveden"}</p>
              </div>
              <div data-testid="shipping-method-summary">
                <span>Způsob dopravy</span>
                <strong>{shippingMethod?.name || "Ještě upřesníme"}</strong>
                <p>
                  {shippingMethod
                    ? money(shippingMethod.total ?? shippingMethod.amount)
                    : "—"}
                </p>
              </div>
            </div>
          </article>

          <article className={s.detailCard}>
            <div className={s.detailHeading}>
              <span>04</span>
              <div>
                <p>Platba</p>
                <h2>Jak jste zaplatili</h2>
              </div>
            </div>

            <div className={s.paymentGrid}>
              <div>
                <span>Metoda</span>
                <strong data-testid="payment-method">{paymentTitle}</strong>
              </div>
              <div>
                <span>Stav</span>
                <strong>{paymentStatus}</strong>
              </div>
              <div>
                <span>Částka</span>
                <strong data-testid="payment-amount">
                  {money(payment?.amount ?? order.total)}
                </strong>
              </div>
            </div>
          </article>
        </section>

        <section className={s.support}>
          <div>
            <p>Potřebujete s něčím pomoct?</p>
            <h2>Ozvěte se.</h2>
          </div>
          <p>
            Napište na{" "}
            <a href="mailto:info@keramickazahrada.cz">
              info@keramickazahrada.cz
            </a>{" "}
            nebo zavolejte na{" "}
            <a href="tel:+420775211578">+420 775 211 578</a>.
          </p>
          <div className={s.actions}>
            <PremiumActionLink
              href="/store"
              text="Zpět do obchodu"
            />
            <LocalizedClientLink className={s.textAction} href="/dotazy">
              Časté dotazy
            </LocalizedClientLink>
          </div>
        </section>

        <footer className={s.footer}>
          <span>Zabalíme pečlivě</span>
          <span>Ručně vyrobeno</span>
          <span>Ateliér · Písek</span>
        </footer>
      </div>
    </main>
  )
}
