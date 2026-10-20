"use client"

import { transferCart } from "@lib/data/customer"
import { StoreCart, StoreCustomer } from "@medusajs/types"
import { AnimatePresence, motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { itemText } from "@lib/util/site-copy"
import { editableItem } from "@modules/common/components/cms-text"
import { useCopyBlock } from "@modules/common/components/cms-text/copy-context"
import styles from "./style.module.scss"

type BannerState = "idle" | "pending" | "error"

/**
 * Texty výzvy — položky `propojeni.*` bloku `global.kosik` (poskytuje hlavní
 * layout). Hláška o nepovedeném propojení je chyba, ta zůstává v kódu.
 */
const BANNER_DEFAULTS = {
  "propojeni.stitek": "Košík ještě není propojený",
  "propojeni.text":
    "Přihlásili jste se v pořádku, ale košík ještě není připojený k vašemu účtu.",
  "propojeni.tlacitko": "Propojit košík",
} as const

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
  const copy = useCopyBlock("global.kosik")
  const text = (label: keyof typeof BANNER_DEFAULTS) =>
    itemText(copy, label, BANNER_DEFAULTS[label])

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
      initial={{ opacity: 0, y: "-1.8vh", clipPath: "inset(0 0 100% 0)" }}
      animate={{ opacity: 1, y: "0vh", clipPath: "inset(0 0 0% 0)" }}
      exit={{ opacity: 0, y: "-1.2vh", clipPath: "inset(0 0 100% 0)" }}
      transition={transition}
      aria-live="polite"
    >
      <div className={styles.content}>
        <div className={styles.index} aria-hidden="true">
          01
        </div>
        <div className={styles.copy}>
          <span {...editableItem(copy, "propojeni.stitek")}>{text("propojeni.stitek")}</span>
          <p {...editableItem(copy, "propojeni.text")}>{text("propojeni.text")}</p>
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
          <span>{state === "pending" ? "Propojujeme…" : text("propojeni.tlacitko")}</span>
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
const initial = { opacity: 0, y: "0.6vh" }
const animate = { opacity: 1, y: "0vh" }
const exit = { opacity: 0, y: "-0.4vh" }
const transition2 = { duration: 0.35, ease }
const variants = {
              rest: { scaleX: 0 },
              hover: { scaleX: 1 },
              pending: { scaleX: 1 },
            }
const transition3 = { duration: 0.58, ease: [0.76, 0, 0.24, 1] as [number, number, number, number] }
