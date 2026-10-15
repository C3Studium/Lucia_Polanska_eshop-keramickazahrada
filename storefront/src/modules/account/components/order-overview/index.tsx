"use client"

import { motion } from "framer-motion"

import OrderCard from "../order-card"
import { HttpTypes } from "@medusajs/types"
import s from "./style.module.scss"
import PremiumActionLink from "@modules/common/components/premium-action-link"
import { useEditRerender } from "@lib/hooks/use-edit-rerender"
import { itemText } from "@lib/util/site-copy"
import type { CopyBlock } from "@lib/util/site-copy"
import { editableItem } from "@modules/common/components/cms-text"
import { accountListVariants } from "../../motion"

const OrderOverview = ({
  orders,
  copy,
}: {
  orders: HttpTypes.StoreOrder[]
  /** Blok `ucet.objednavky` — odsud jen prázdný stav (`prazdne.nadpis`, `prazdne.text`). */
  copy?: CopyBlock
}) => {
  useEditRerender()

  if (orders?.length) {
    return (
      <motion.div
        className={s.root}
        variants={accountListVariants}
        initial="hidden"
        animate="visible"
      >
        {orders.map((o) => (
          <div key={o.id} className={s.itemWrap}>
            <OrderCard order={o} />
          </div>
        ))}
      </motion.div>
    )
  }

  return (
    <div className={s.empty} data-testid="no-orders-container">
      <div className={s.emptyContent}>
        <h2 className={s.title} {...editableItem(copy, "prazdne.nadpis")}>
          {itemText(copy, "prazdne.nadpis", "Zatím tu nic není")}
        </h2>
        <p className={s.desc} {...editableItem(copy, "prazdne.text")}>
          {itemText(
            copy,
            "prazdne.text",
            "Ještě jste u nás nic neobjednali. Třeba vás něco zaujme."
          )}
        </p>
      </div>
      <div className={s.ctaWrap}>
        <PremiumActionLink
          text="Prohlédnout výrobky"
          href="/store"
          className={s.emptyAction}
        />
      </div>
    </div>
  )
}

export default OrderOverview
