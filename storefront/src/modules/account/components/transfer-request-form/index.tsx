"use client"

import { useActionState } from "react"
import { createTransferRequest } from "@lib/data/orders"
import { IconButton } from "@medusajs/ui"
import { CheckCircleMiniSolid, XCircleSolid } from "@medusajs/icons"
import { useEffect, useState } from "react"
import s from "./style.module.scss"
import { AnimatePresence, motion } from "framer-motion"
import Input from "@modules/common/components/input"
import PremiumActionButton from "@modules/common/components/premium-action-button"
import { accountDisclosureVariants } from "../../motion"

export default function TransferRequestForm() {
  const [showSuccess, setShowSuccess] = useState(false)

  const [state, formAction] = useActionState(createTransferRequest, {
    success: false,
    error: null,
    order: null,
  })

  useEffect(() => {
    if (state.success && state.order) {
      setShowSuccess(true)
    }
  }, [state.success, state.order])

  return (
    <div className={s.root}>
      <div className={s.headerRow}>
        <div className={s.intro}>
          <h3 className={s.title}>Převod objednávek</h3>
          <p className={s.desc}>
            Nevidíte tu objednávku, kterou hledáte?
            <br /> Napište její číslo a připojíme ji k vašemu účtu.
          </p>
        </div>
        <form action={formAction} className={s.form}>
          <div className={s.formInner}>
            <Input
              variant="contact"
              className={s.input}
              name="order_id"
              label="ID objednávky"
            />
            <PremiumActionButton
              text="Požádat o převod"
              type="submit"
              className={s.transferBtn}
            />
          </div>
        </form>
      </div>
      <AnimatePresence initial={false}>
        {!state.success && state.error && (
          <motion.p
            className={s.error}
            variants={accountDisclosureVariants}
            initial="closed"
            animate="open"
            exit="closed"
          >
            {state.error}
          </motion.p>
        )}
        {showSuccess && (
          <motion.div
            className={s.success}
            variants={accountDisclosureVariants}
            initial="closed"
            animate="open"
            exit="closed"
          >
            <div className={s.successLeft}>
              <CheckCircleMiniSolid className={s.iconSuccess} />
              <div className={s.successTextWrap}>
                <p className={s.successTitle}>
                  Požadavek na převod pro objednávku {state.order?.id} byl odeslán
                </p>
                <p className={s.successDesc}>
                  E-mail s žádostí o převod byl odeslán na {state.order?.email}
                </p>
              </div>
            </div>
            <IconButton variant="transparent" className={s.closeBtn} onClick={() => setShowSuccess(false)}>
              <XCircleSolid className={s.iconClose} />
            </IconButton>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
