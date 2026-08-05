"use client"

import { Radio as RadioGroupOption } from "@headlessui/react"
import { Text } from "@medusajs/ui"
import { AnimatePresence, motion, type Variants } from "framer-motion"
import React, { Fragment, useContext, useMemo, type JSX } from "react"

import { isManual } from "@lib/constants"
import SkeletonCardDetails from "@modules/skeletons/components/skeleton-card-details"
import PaymentTest from "../payment-test"
import styles from "./style.module.scss"

const ease = [0.22, 1, 0.36, 1] as const

const optionVariants: Variants = {
  rest: { color: "#20211c" },
  hover: { color: "#20211c" },
  selected: { color: "#20211c" },
  disabled: { color: "rgba(32, 33, 28, .38)" },
}

const surfaceVariants: Variants = {
  rest: { scaleX: 0, opacity: 0 },
  hover: { scaleX: 1, opacity: 0.72 },
  selected: { scaleX: 1, opacity: 1 },
  disabled: { scaleX: 0, opacity: 0 },
}

const getPaymentMeta = (providerId: string) => {
  if (providerId.includes("applepay")) {
    return {
      category: "Mobilní peněženka",
      detail: "Potvrzení přes Face ID nebo Touch ID",
    }
  }

  if (providerId.includes("googlepay")) {
    return {
      category: "Mobilní peněženka",
      detail: "Rychlé potvrzení přes váš Google účet",
    }
  }

  if (providerId.includes("bank")) {
    return {
      category: "Online převod",
      detail: "Bezpečné přesměrování do internetového bankovnictví",
    }
  }

  if (isManual(providerId)) {
    return {
      category: "Testovací metoda",
      detail: "Pouze pro kontrolu objednávkového procesu",
    }
  }

  return {
    category: "Platební karta",
    detail: "Visa, Mastercard a další podporované karty",
  }
}

type PaymentContainerProps = {
  paymentProviderId: string
  selectedPaymentOptionId: string | null
  disabled?: boolean
  paymentInfoMap: Record<string, { title: string; icon: JSX.Element }>
  paymentMethodInfo?: {
    title: string
    category?: string
    detail?: string
    logo?: string
  }
  onSelectedAction?: () => void
  children?: React.ReactNode
}

const PaymentContainer: React.FC<PaymentContainerProps> = ({
  paymentProviderId,
  selectedPaymentOptionId,
  paymentInfoMap,
  paymentMethodInfo,
  onSelectedAction,
  disabled = false,
  children,
}) => {
  const isDevelopment = process.env.NODE_ENV === "development"
  const selected = selectedPaymentOptionId === paymentProviderId
  const fallbackMeta = getPaymentMeta(paymentProviderId)
  const meta = {
    category: paymentMethodInfo?.category || fallbackMeta.category,
    detail: paymentMethodInfo?.detail || fallbackMeta.detail,
  }
  const visualState = disabled ? "disabled" : selected ? "selected" : "rest"

  return (
    <div className={styles.root}>
      <RadioGroupOption
        as={Fragment}
        key={paymentProviderId}
        value={paymentProviderId}
        disabled={disabled}
      >
        <motion.div
          className={styles.option}
          onClick={selected && !disabled ? onSelectedAction : undefined}
          variants={optionVariants}
          initial={false}
          animate={visualState}
          whileHover={disabled ? "disabled" : selected ? "selected" : "hover"}
          transition={transition}
        >
          <motion.span
            className={styles.optionSurface}
            variants={surfaceVariants}
            style={styleObj}
            transition={transition2}
            aria-hidden="true"
          />
          <div className={styles.row}>
            <div className={styles.left}>
              <motion.span
                className={styles.selectionMark}
                initial={false}
                animate={selected ? "selected" : "rest"}
                variants={{
                  rest: {
                    borderColor: "rgba(32, 33, 28, .5)",
                    backgroundColor: "rgba(255, 232, 214, 0)",
                  },
                  selected: {
                    borderColor: "#20211c",
                    backgroundColor: "rgba(187, 183, 136, .2)",
                  },
                }}
                transition={transition3}
                aria-hidden="true"
              >
                <motion.span
                  initial={false}
                  animate={
                    selected
                      ? { scale: 1, opacity: 1 }
                      : { scale: 0, opacity: 0 }
                  }
                  transition={transition3}
                />
              </motion.span>
              <div className={styles.copy}>
                <Text className={styles.category}>{meta.category}</Text>
                <Text className={styles.titleText}>
                  {paymentMethodInfo?.title ||
                    paymentInfoMap[paymentProviderId]?.title ||
                    paymentProviderId}
                </Text>
                <Text className={styles.detail}>{meta.detail}</Text>
                {isManual(paymentProviderId) && isDevelopment && (
                  <PaymentTest className={styles.testNote} />
                )}
              </div>
            </div>
            <div className={styles.aside}>
              <motion.span
                className={styles.iconRight}
                initial={false}
                animate={
                  selected
                    ? {
                        borderColor: "rgba(32, 33, 28, .58)",
                        backgroundColor: "rgba(255, 232, 214, .5)",
                      }
                    : {
                        borderColor: "rgba(32, 33, 28, .18)",
                        backgroundColor: "rgba(255, 232, 214, 0)",
                      }
                }
                transition={transition4}
              >
                {paymentMethodInfo?.logo ? (
                  <img
                    className={styles.methodLogo}
                    src={paymentMethodInfo.logo}
                    alt=""
                    loading="lazy"
                  />
                ) : (
                  paymentInfoMap[paymentProviderId]?.icon
                )}
              </motion.span>
              <motion.span
                className={styles.direction}
                initial={false}
                animate={{ rotate: selected ? 45 : 0 }}
                variants={variants}
                transition={transition4}
                aria-hidden="true"
              >
                ↗
              </motion.span>
            </div>
          </div>
          {children}
        </motion.div>
      </RadioGroupOption>
    </div>
  )
}

export default PaymentContainer


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const transition = { duration: 0.4, ease }
const styleObj = { originX: 1 }
const transition2 = { duration: 0.62, ease: [0.76, 0, 0.24, 1] as [number, number, number, number] }
const transition3 = { duration: 0.38, ease }
const transition4 = { duration: 0.42, ease }
const variants = { hover: { rotate: 45 } }
