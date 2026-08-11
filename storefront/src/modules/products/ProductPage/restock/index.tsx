"use client"

import { subscribeToRestock } from "@lib/data/products"
import { AnimatePresence, motion, type Variants } from "framer-motion"
import { FormEvent, useId, useState } from "react"
import s from "./style.module.scss"

type RestockFormProps = {
  variant: { id: string; title?: string }
  product: { title?: string }
}

type FormState = "idle" | "loading" | "success" | "error"

const ease = [0.22, 1, 0.36, 1] as const

const formVariants: Variants = {
  idle: { opacity: 1, y: 0 },
  loading: { opacity: 0.72, y: 0 },
  success: { opacity: 1, y: 0 },
  error: { opacity: 1, x: [0, -4, 4, -2, 0] },
}

const messageVariants: Variants = {
  initial: { opacity: 0, y: 9, clipPath: "inset(0 0 100% 0)" },
  animate: { opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)" },
  exit: { opacity: 0, y: -6, clipPath: "inset(100% 0 0 0)" },
}

const RestockForm = ({ variant, product }: RestockFormProps) => {
  const emailId = useId()
  const [email, setEmail] = useState("")
  const [state, setState] = useState<FormState>("idle")

  if (!variant) return null

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setState("loading")

    try {
      await subscribeToRestock({
        variant_id: variant.id,
        email,
      })
      setEmail("")
      setState("success")
    } catch {
      setState("error")
    }
  }

  const isLoading = state === "loading"
  const objectName = variant.title || product.title || "tenhle kousek"

  return (
    <motion.section
      className={s.root}
      variants={formVariants}
      initial="idle"
      animate={state}
      transition={transition}
      aria-labelledby={`${emailId}-title`}
    >
      <div className={s.heading}>
        <span>Právě vyprodáno</span>
        <strong id={`${emailId}-title`}>Dejte mi vědět, až bude znovu.</strong>
        <p>
          Jakmile budeme mít {objectName} znovu skladem, pošleme vám jeden
          krátký e-mail. Nic víc.
        </p>
      </div>

      <form className={s.form} onSubmit={handleSubmit}>
        <label htmlFor={emailId}>Váš e-mail</label>
        <div className={s.control}>
          <input
            id={emailId}
            type="email"
            required
            autoComplete="email"
            placeholder="vas@email.cz"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              if (state !== "idle") setState("idle")
            }}
            disabled={isLoading}
          />
          <motion.button
            type="submit"
            disabled={isLoading || !email}
            whileTap={isLoading ? undefined : { scale: 0.985 }}
            initial="rest"
            animate={isLoading ? "loading" : "rest"}
            whileHover={isLoading || !email ? "rest" : "hover"}
          >
            <motion.span
              className={s.buttonFill}
              variants={variants}
              transition={transition2}
              aria-hidden="true"
            />
            <span>{isLoading ? "Ukládáme…" : "Dejte mi vědět"}</span>
            <motion.i
              animate={isLoading ? { rotate: 360 } : { rotate: 0 }}
              transition={
                isLoading
                  ? { duration: 1, ease: "linear", repeat: Infinity }
                  : { duration: 0.35, ease }
              }
              aria-hidden="true"
            >
              ↗
            </motion.i>
          </motion.button>
        </div>
      </form>

      <AnimatePresence mode="wait" initial={false}>
        {state === "success" && (
          <motion.p
            className={s.success}
            key="success"
            variants={messageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transition3}
            role="status"
          >
            Hotovo. Jakmile to bude skladem, ozveme se.
          </motion.p>
        )}
        {state === "error" && (
          <motion.p
            className={s.error}
            key="error"
            variants={messageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transition3}
            role="alert"
          >
            Nepovedlo se to uložit. Zkontrolujte e-mail a zkuste to znovu.
          </motion.p>
        )}
      </AnimatePresence>
    </motion.section>
  )
}

export default RestockForm


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const transition = { duration: 0.55, ease }
const variants = {
                rest: { scaleX: 0 },
                hover: { scaleX: 1 },
                loading: { scaleX: 1 },
              }
const transition2 = { duration: 0.58, ease: [0.76, 0, 0.24, 1] as [number, number, number, number] }
const transition3 = { duration: 0.48, ease }
