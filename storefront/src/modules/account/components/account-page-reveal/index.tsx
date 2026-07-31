"use client"

import { motion } from "framer-motion"
import { type ReactNode } from "react"

import {
  accountPageVariants,
  accountSectionVariants,
} from "../../motion"

type AccountPageRevealProps = {
  children: ReactNode
  className?: string
  "data-testid"?: string
}

export const AccountPageReveal = ({
  children,
  className,
  "data-testid": dataTestId,
}: AccountPageRevealProps) => {
  return (
    <motion.div
      className={className}
      variants={accountPageVariants}
      initial="hidden"
      animate="visible"
      data-testid={dataTestId}
    >
      {children}
    </motion.div>
  )
}

export const AccountSectionReveal = ({
  children,
  className,
}: Omit<AccountPageRevealProps, "data-testid">) => {
  return (
    <motion.div className={className} variants={accountSectionVariants}>
      {children}
    </motion.div>
  )
}

