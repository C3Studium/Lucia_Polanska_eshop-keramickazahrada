"use client"

import { useMemo, useState } from "react"

import Thumbnail from "@modules/products/components/thumbnail"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import s from "./style.module.scss"
import { motion } from 'framer-motion';

type OrderCardProps = {
  order: HttpTypes.StoreOrder
}

const OrderCard = ({ order }: OrderCardProps) => {
  const numberOfLines = useMemo(() => {
    return (
      order.items?.reduce((acc, item) => {
        return acc + item.quantity
      }, 0) ?? 0
    )
  }, [order])

  const numberOfProducts = useMemo(() => {
    return order.items?.length ?? 0
  }, [order])

  const formattedDate = useMemo(() => {
    const date = new Date(order.created_at)
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${day}.${month}.${year} ${hours}:${minutes}`
  }, [order.created_at])

  return (
    <div className={s.root} data-testid="order-card">
      <div className={s.header}>
        <span className={s.headerText}>
          Objednávka: {" "}
        </span>
        <span className={s.headerNumber} data-testid="order-display-id">#{order.display_id}</span>
      </div>
      <div className={s.meta}>
        <span className={s.metaLabel}>Detaily: {" "}</span>
        <ul className={s.metaList}>
          <li className={s.metaItem}>
            <span>Vytvořeno: {" "}</span>
            <span className={s.metaDate} data-testid="order-created-at">
              {formattedDate}
            </span>
          </li>
          <li className={s.metaItem}>
            <span>Celková částka: {" "}</span>
            <span className={s.metaAmount} data-testid="order-amount">
              {convertToLocale({
                amount: order.total,
                currency_code: order.currency_code,
              })}
            </span>
          </li>
          <li className={s.metaItem}>
            <span>Počet produktů: {" "}</span>
            <span className={s.metaLines}>{`${numberOfLines} ${
              numberOfLines > 1 ? "produkty" : "produkt"
            }`}</span>
          </li>
        </ul>
      </div>
      <div className={s.productsContainer}>
        <div className={s.grid}>
          {order.items?.map((i) => {
            return (
              <div
                key={i.id}
                className={s.item}
                data-testid="order-item"
              >
                <Thumbnail thumbnail={i.thumbnail} images={[]} size="full" />
                <div className={s.itemInfo}>
                  <span className={s.itemTitle} data-testid="item-title">
                    {i.title}
                  </span>
                  <span className={s.multiply}>x</span>
                  <span data-testid="item-quantity">{i.quantity}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className={s.actions}>
        <LinkButton 
          text="Zobrazit detaily"
          href={`/account/orders/details/${order.id}`}
        />
      </div>
    </div>
  )
}

export default OrderCard

type LinkButtonProps = {
    text: string;
    href: string; 
}

// This is base button for every button animation inside the website.

function LinkButton({ text, href } : LinkButtonProps) {
    const [ isActive , setIsActive ] = useState<boolean>(false);
    return (
        <LocalizedClientLink href={href} className={s.LinkButtonS}>
            <button 
                className={s.button}
                onMouseEnter={() => setIsActive(true)}
                onMouseLeave={() => setIsActive(false)}
            >
                <motion.div 
                    className={s.slider}
                    animate={{top: isActive ? "-100%" : "0%"}}
                    transition={{ duration: 0.5, type: "tween", ease: [0.76, 0, 0.24, 1]}}
                >
                    <div 
                        className={s.el}
                        style={{ backgroundColor: "var(--darkOlive)" }}
                    >
                        <PerspectiveText label={text}/>
                    </div>
                    <div 
                        className={s.el}
                        style={{ backgroundColor: "var(--bgPrimary)" }}
                    >
                        <PerspectiveText label={text}/>
                    </div>
                </motion.div>
            </button>
        </LocalizedClientLink>
    )
}

function PerspectiveText({label}: {label: string}) {
    return (    
        <div className={s.perspectiveText}>
            <p>{label}</p>
            <p>{label}</p>
        </div>
    )
}
