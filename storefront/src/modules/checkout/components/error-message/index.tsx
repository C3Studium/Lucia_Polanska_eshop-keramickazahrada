"use client"

import { motion } from "framer-motion"
import type { Variants } from "framer-motion"
import styles from "./style.module.scss"

/*
 * 8px je 0.74vh referenční obrazovky 1080; souřadnice patří na vh, ať si gesto
 * drží svůj podíl okna. Oba konce nesou jednotku ("0vh", ne holá 0) — framer
 * interpoluje spolehlivě jen při stejném tvaru výrazu na obou stranách.
 * Že vh v této verzi (12.23) doběhne, měří .rdshots/zz-lead-vh-motion.cjs.
 * clip-path je v procentech vlastního prvku, tedy bezrozměrný vůči viewportu.
 */
const errorVariants: Variants = {
  hidden: {
    opacity: 0,
    y: "0.74vh",
    clipPath: "inset(0 100% 0 0)",
  },
  visible: {
    opacity: 1,
    y: "0vh",
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
      transition={transition}
    >
      <motion.i
        className={styles.marker}
        initial={initial}
        animate={animate}
        transition={transition2}
        aria-hidden="true"
      />
      <span>{error}</span>
    </motion.div>
  )
}

export default ErrorMessage


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const transition = { duration: 0.52, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }
const initial = { scaleX: 0 }
const animate = { scaleX: 1 }
const transition2 = { duration: 0.58, ease: [0.76, 0, 0.24, 1] as [number, number, number, number] }
