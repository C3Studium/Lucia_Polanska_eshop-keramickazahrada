"use client"

import styles from "./style.module.scss"

import { AnimatePresence, motion } from "framer-motion"
import PaymentButton from "../payment-button"
import { useSearchParams } from "next/navigation"

const ease = [0.22, 1, 0.36, 1] as const

const Review = ({ cart, countryCode }: { cart: any; countryCode: string }) => {
  const searchParams = useSearchParams()

  const isOpen = searchParams.get("step") === "review"

  const paidByGiftcard =
    cart?.gift_cards && cart?.gift_cards?.length > 0 && cart?.total === 0

  const previousStepsCompleted =
    cart.shipping_address &&
    cart.shipping_methods.length > 0 &&
    (cart.payment_collection || paidByGiftcard)

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <motion.h2
          className={styles.heading}
          initial={false}
          animate={{
            opacity: isOpen ? 1 : 0.42,
            x: isOpen ? 0 : -4,
          }}
          transition={{ duration: 0.46, ease }}
        >
          Přehled
        </motion.h2>
      </div>
      <AnimatePresence initial={false}>
        {isOpen && previousStepsCompleted && (
          <motion.div
            className={styles.content}
            key="review-content"
            initial={{
              opacity: 0,
              height: 0,
              y: 12,
              clipPath: "inset(0 0 100% 0)",
            }}
            animate={{
              opacity: 1,
              height: "auto",
              y: 0,
              clipPath: "inset(0 0 0% 0)",
            }}
            exit={{
              opacity: 0,
              height: 0,
              y: -8,
              clipPath: "inset(100% 0 0 0)",
            }}
            transition={{ duration: 0.58, ease }}
          >
            <motion.div
              className={styles.reviewRow}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.12, ease }}
            >
              <span className={styles.confirmationMark}>Souhlas</span>
              <p className={styles.reviewText}>
                Odesláním objednávky potvrzujete souhlas s obchodními
                podmínkami, reklamačním řádem a zpracováním osobních údajů
                obchodu Keramická zahrada.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.48, delay: 0.2, ease }}
            >
              <PaymentButton
                cart={cart}
                data-testid="submit-order-button"
                countryCode={countryCode}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Review
