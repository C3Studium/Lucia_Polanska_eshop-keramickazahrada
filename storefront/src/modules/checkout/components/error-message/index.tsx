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

/**
 * `druh` rozlišuje „něco se nepovedlo" od „stalo se tohle".
 *
 * Sdělení jako „váš kód s větší slevou jsme nechali" je dobrá zpráva; v tomtéž
 * červeném rámečku s vykřičníkem a s `role="alert"` by ji člověk četl jako
 * selhání a hledal, co udělal špatně. Tvar zůstává stejný, mění se barva,
 * značka a naléhavost, se kterou to ohlásí odečítač obrazovky.
 */
const ErrorMessage = ({
  error,
  druh = "chyba",
  'data-testid': dataTestid,
}: {
  error?: string | null
  druh?: "chyba" | "info"
  'data-testid'?: string
}) => {
  if (!error) {
    return null
  }

  const jeInfo = druh === "info"

  return (
    <motion.div
      key={error}
      className={jeInfo ? `${styles.root} ${styles.info}` : styles.root}
      data-testid={dataTestid}
      role={jeInfo ? "status" : "alert"}
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
