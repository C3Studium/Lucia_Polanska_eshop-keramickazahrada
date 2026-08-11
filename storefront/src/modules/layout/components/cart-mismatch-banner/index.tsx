"use client"

import { transferCart } from "@lib/data/customer"
import { StoreCart, StoreCustomer } from "@medusajs/types"
import { AnimatePresence, motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { useState } from "react"
import styles from "./style.module.scss"

type BannerState = "idle" | "pending" | "error"

const ease = [0.22, 1, 0.36, 1] as const

function CartMismatchBanner({
  customer,
  cart,
}: {
  customer: StoreCustomer
  cart: StoreCart
}) {
  const router = useRouter()
  const [state, setState] = useState<BannerState>("idle")

  if (!customer || cart.customer_id) return null

  const handleSubmit = async () => {
    setState("pending")

    try {
      await transferCart()
      router.refresh()
    } catch {
      setState("error")
    }
  }

  return (
    <motion.aside
      className={styles.root}
      initial={{ opacity: 0, y: -18, clipPath: "inset(0 0 100% 0)" }}
      animate={{ opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)" }}
      exit={{ opacity: 0, y: -12, clipPath: "inset(0 0 100% 0)" }}
      transition={transition}
      aria-live="polite"
    >
      <div className={styles.content}>
        <div className={styles.index} aria-hidden="true">
          01
        </div>
        <div className={styles.copy}>
          <span>Košík ještě není propojený</span>
          <p>
            Přihlásili jste se v pořádku, ale košík ještě není připojený
            k vašemu účtu.
          </p>
          <AnimatePresence mode="wait" initial={false}>
            {state === "error" && (
              <motion.small
                key="error"
                initial={initial}
                animate={animate}
                exit={exit}
                transition={transition2}
                role="alert"
              >
                Propojení se nepovedlo. Zkuste to prosím znovu.
              </motion.small>
            )}
          </AnimatePresence>
        </div>
        <motion.button
          type="button"
          className={styles.action}
          disabled={state === "pending"}
          onClick={handleSubmit}
          initial="rest"
          animate={state === "pending" ? "pending" : "rest"}
          whileHover={state === "pending" ? "pending" : "hover"}
          whileTap={state === "pending" ? undefined : { scale: 0.985 }}
        >
          <motion.span
            className={styles.actionFill}
            variants={variants}
            transition={transition3}
            aria-hidden="true"
          />
          <span>{state === "pending" ? "Propojujeme…" : "Propojit košík"}</span>
          <motion.i
            animate={state === "pending" ? { rotate: 360 } : { rotate: 0 }}
            transition={
              state === "pending"
                ? { duration: 1, repeat: Infinity, ease: "linear" }
                : { duration: 0.4, ease }
            }
            aria-hidden="true"
          >
            ↗
          </motion.i>
        </motion.button>
      </div>
    </motion.aside>
  )
}

export default CartMismatchBanner


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const transition = { duration: 0.62, ease }
const initial = { opacity: 0, y: 6 }
const animate = { opacity: 1, y: 0 }
const exit = { opacity: 0, y: -4 }
const transition2 = { duration: 0.35, ease }
const variants = {
              rest: { scaleX: 0 },
              hover: { scaleX: 1 },
              pending: { scaleX: 1 },
            }
const transition3 = { duration: 0.58, ease: [0.76, 0, 0.24, 1] as [number, number, number, number] }
