"use client"

import { motion } from "framer-motion"

import OrderCard from "../order-card"
import { HttpTypes } from "@medusajs/types"
import s from "./style.module.scss"
import PremiumActionLink from "@modules/common/components/premium-action-link"
import { accountListVariants } from "../../motion"

const OrderOverview = ({ orders }: { orders: HttpTypes.StoreOrder[] }) => {
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
        <h2 className={s.title}>Nic tu nemáte...</h2>
        <p className={s.desc}>
          Zatím nemáte žádné objednávky, pojďme to změnit {":)"}
        </p>
      </div>
      <div className={s.ctaWrap}>
        <PremiumActionLink
          text="Pokračovat v nakupování"
          href="/store"
          className={s.emptyAction}
        />
      </div>
    </div>
  )
}

export default OrderOverview
