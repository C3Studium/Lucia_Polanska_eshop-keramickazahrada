"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"

import Thumbnail from "@modules/products/components/thumbnail"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import s from "./style.module.scss"
import PremiumActionLink from "@modules/common/components/premium-action-link"
import { accountListItemVariants } from "../../motion"
import AccountInteractiveSurface from "../account-interactive-surface"
import { productLines } from "@lib/util/packaging"
import { commissionListLine, type Commission } from "@lib/util/made-to-order"

type OrderCardProps = {
  order: HttpTypes.StoreOrder
  /**
   * Zakázky objednávky (Z-A „zakázka = položka") — stručný stav každé pod
   * údaji: „Zakázka: Domovní číslo — ve výrobě od 20. 10. 2026". Bez nich
   * (běžná objednávka, nebo se stav nenačetl) jen odkaz do detailu jako dřív.
   */
  commissions?: Commission[]
}

const OrderCard = ({ order, commissions }: OrderCardProps) => {
  const numberOfItems = useMemo(() => {
    return (
      productLines(order.items).reduce((acc, item) => {
        return acc + item.quantity
      }, 0) ?? 0
    )
  }, [order])

  // Balné a doběrečné nejsou kusy zboží — miniatury i počty jen z výrobků.
  const visibleItems = productLines(order.items).slice(0, 5)
  const hiddenItemsCount = Math.max(
    productLines(order.items).length - visibleItems.length,
    0
  )

  const formattedDate = useMemo(() => {
    return new Intl.DateTimeFormat("cs-CZ", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
      .format(new Date(order.created_at))
      .replace(",", " ·")
  }, [order.created_at])

  return (
    <motion.article
      className={s.root}
      variants={accountListItemVariants}
      data-testid="order-card"
    >
      <AccountInteractiveSurface
        className={s.interactiveRow}
        contentClassName={s.rowContent}
      >
        <div className={s.identity}>
          <span className={s.label}>Objednávka</span>
          <strong className={s.orderNumber} data-testid="order-display-id">
            #{order.display_id}
          </strong>
        </div>

        <dl className={s.meta}>
          <div>
            <dt>Vytvořeno</dt>
            <dd>
              <time data-testid="order-created-at">{formattedDate}</time>
            </dd>
          </div>
          <div>
            <dt>Hodnota</dt>
            <dd className={s.metaAmount} data-testid="order-amount">
              {convertToLocale({
                amount: order.total,
                currency_code: order.currency_code,
              })}
            </dd>
          </div>
          <div>
            <dt>Počet kusů</dt>
            <dd>{numberOfItems} ks</dd>
          </div>
          {commissions && commissions.length > 0 && (
            <div className={s.commissions} data-testid="order-commissions">
              <dt>{commissions.length === 1 ? "Zakázka" : "Zakázky"}</dt>
              <dd>
                {commissions.map((commission, index) => (
                  <span
                    key={commission.production_order_id ?? commission.line_item_id ?? index}
                    className={s.commissionLine}
                  >
                    {commissionListLine(commission)}
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>

        <div
          className={s.products}
          aria-label={`${numberOfItems} ${numberOfItems === 1 ? "kus" : numberOfItems < 5 ? "kusy" : "kusů"} v objednávce`}
        >
          <span className={s.label}>Co jste objednali</span>
          <div className={s.productIcons} data-testid="order-items-preview">
            {visibleItems.map((item) => {
              return (
                <div
                  key={item.id}
                  className={s.productIcon}
                  data-testid="order-item"
                  aria-label={`${item.title}, ${item.quantity} ks`}
                  title={`${item.title} · ${item.quantity} ks`}
                >
                  <Thumbnail
                    thumbnail={item.thumbnail}
                    images={[]}
                    size="full"
                  />
                  <span className={s.visuallyHidden} data-testid="item-title">
                    {item.title}
                  </span>
                  <span className={s.quantityBadge} data-testid="item-quantity">
                    {item.quantity}
                  </span>
                </div>
              )
            })}
            {hiddenItemsCount > 0 && (
              <span
                className={s.moreItems}
                aria-label={`Dalších ${hiddenItemsCount} položek`}
              >
                +{hiddenItemsCount}
              </span>
            )}
          </div>
        </div>

        <div className={s.actions}>
          <PremiumActionLink
            href={`/account/orders/details/${order.id}`}
            text="Zobrazit objednávku"
            className={s.detailsLink}
          />
        </div>
      </AccountInteractiveSurface>
    </motion.article>
  )
}

export default OrderCard
