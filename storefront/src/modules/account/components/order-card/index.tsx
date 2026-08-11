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

type OrderCardProps = {
  order: HttpTypes.StoreOrder
}

const OrderCard = ({ order }: OrderCardProps) => {
  const numberOfItems = useMemo(() => {
    return (
      order.items?.reduce((acc, item) => {
        return acc + item.quantity
      }, 0) ?? 0
    )
  }, [order])

  const visibleItems = order.items?.slice(0, 5) ?? []
  const hiddenItemsCount = Math.max(
    (order.items?.length ?? 0) - visibleItems.length,
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
        </dl>

        <div
          className={s.products}
          aria-label={`${numberOfItems} kusů v objednávce`}
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
