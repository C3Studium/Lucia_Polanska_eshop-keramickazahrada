"use client"

import { motion } from "framer-motion"
import type { Variants } from "framer-motion"
import styles from "./style.module.scss"

const errorVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 8,
    clipPath: "inset(0 100% 0 0)",
  },
  visible: {
    opacity: 1,
    y: 0,
    clipPath: "inset(0 0% 0 0)",
  },
}

const ErrorMessage = ({ error, 'data-testid': dataTestid }: { error?: string | null, 'data-testid'?: string }) => {
  if (!error) {
    return null
  }

  return (
    <motion.div
      key={error}
      className={styles.root}
      data-testid={dataTestid}
      role="alert"
      aria-live="polite"
      variants={errorVariants}
      initial="hidden"
      animate="visible"
      transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.i
        className={styles.marker}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.58, ease: [0.76, 0, 0.24, 1] }}
        aria-hidden="true"
      />
      <span>{error}</span>
    </motion.div>
  )
}

export default ErrorMessage
