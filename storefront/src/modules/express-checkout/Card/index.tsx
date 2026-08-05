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
      transition={transition}
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
            initial={initial}
            animate={animate}
            exit={initial}
            transition={transition2}
          >
            <motion.div
              initial={initial2}
              animate={animate2}
              exit={exit}
              transition={transition3}
            >
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const transition = { layout: { duration: .55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } }
const initial = { height: 0, opacity: 0 }
const animate = { height: "auto" as const, opacity: 1 }
const transition2 = { duration: .58, ease: [0.76, 0, 0.24, 1] as [number, number, number, number] }
const initial2 = { y: 18 }
const animate2 = { y: 0 }
const exit = { y: 10 }
const transition3 = { duration: .55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }
