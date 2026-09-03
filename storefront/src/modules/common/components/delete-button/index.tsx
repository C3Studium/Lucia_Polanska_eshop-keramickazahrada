import { deleteLineItem, removeBundleFromCart } from "@lib/data/cart"
import { Spinner, Trash } from "@medusajs/icons"
import { clx } from "@medusajs/ui"
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import styles from "./style.module.scss"
import { palette } from "styles/palette.generated"

const buttonVariants = {
  rest: { color: "var(--delete-button-ink, currentColor)" },
  hover: { color: `var(--delete-button-active-ink, ${palette.ink05})` },
  pending: { color: `var(--delete-button-active-ink, ${palette.ink05})` },
}

const fillVariants = {
  rest: { scaleX: 0 },
  hover: { scaleX: 1 },
  pending: { scaleX: 1 },
}


const DeleteButton = ({
  id,
  children,
  className,
  bundle_id,
}: {
  id: string
  children?: React.ReactNode
  className?: string
  bundle_id?: string
}) => {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    if (bundle_id) {
      await removeBundleFromCart(bundle_id).catch(() => {
        setIsDeleting(false)
      })
    } else {
      await deleteLineItem(id).catch(() => {
        setIsDeleting(false)
      })
    }
  }

  return (
    <div
      className={clx(styles.root, className)}
    >
      <motion.button
        type="button"
        className={styles.button}
        onClick={() => handleDelete(id)}
        disabled={isDeleting}
        aria-busy={isDeleting || undefined}
        initial="rest"
        animate={isDeleting ? "pending" : "rest"}
        whileHover={isDeleting ? "pending" : "hover"}
        whileFocus={isDeleting ? "pending" : "hover"}
        whileTap={isDeleting ? undefined : { scale: .975 }}
        variants={buttonVariants}
      >
        <motion.span
          className={styles.fill}
          variants={fillVariants}
          transition={transition}
          style={styleObj}
          aria-hidden="true"
        />
        <span className={styles.icon} aria-hidden="true">
          <AnimatePresence mode="wait" initial={false}>
            {isDeleting ? (
              <motion.span
                key="pending"
                initial={initial}
                animate={animate}
                exit={initial}
                transition={transition2}
              >
                <Spinner />
              </motion.span>
            ) : (
              <motion.span
                key="idle"
                initial={initial}
                animate={animate2}
                exit={initial}
                transition={transition3}
              >
                <Trash />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
        <span className={styles.label}>{isDeleting ? "Odebírám…" : children}</span>
      </motion.button>
    </div>
  )
}

export default DeleteButton


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const transition = { duration: .48, ease: [0.76, 0, 0.24, 1] as [number, number, number, number] }
const styleObj = { originX: 0 }
const initial = { opacity: 0, scale: .75 }
const animate = { opacity: 1, scale: 1, rotate: 360 }
const transition2 = {
                  opacity: { duration: .2 },
                  scale: { duration: .3, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
                  rotate: { duration: .9, repeat: Infinity, ease: "linear" as const },
                }
const animate2 = { opacity: 1, scale: 1 }
const transition3 = { duration: .28, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }
