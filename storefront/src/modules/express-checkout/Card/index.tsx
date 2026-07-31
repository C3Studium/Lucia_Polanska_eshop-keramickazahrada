import { CheckCircle } from "@medusajs/icons"
import { AnimatePresence, motion } from "framer-motion"
import styles from "./style.module.scss"

type CardProps = {
  step: string
  title: string
  isActive: boolean
  isDone: boolean
  summary?: string
  onOpenAction: () => void
  children: React.ReactNode
}

export const Card = ({
  step,
  title,
  isActive,
  isDone,
  summary,
  onOpenAction,
  children,
}: CardProps) => {
  return (
    <motion.section
      className={`${styles.card} ${isActive ? styles.active : ""} ${
        !isActive ? styles.clickable : ""
      }`}
      layout="position"
      transition={{ layout: { duration: .55, ease: [0.22, 1, 0.36, 1] } }}
    >
      <button
        type="button"
        className={styles.heading}
        onClick={onOpenAction}
        aria-expanded={isActive}
      >
        <span className={styles.step}>{step}</span>
        <span className={styles.headingCopy}>
          <span className={styles.title}>{title}</span>
          {!isActive && summary && (
            <span className={styles.summary}>{summary}</span>
          )}
        </span>
        <span className={styles.status}>
          {isDone ? <CheckCircle className={styles.done} /> : isActive ? "—" : "↗"}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isActive && (
          <motion.div
            className={styles.content}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: .58, ease: [0.76, 0, 0.24, 1] }}
          >
            <motion.div
              initial={{ y: 18 }}
              animate={{ y: 0 }}
              exit={{ y: 10 }}
              transition={{ duration: .55, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}
