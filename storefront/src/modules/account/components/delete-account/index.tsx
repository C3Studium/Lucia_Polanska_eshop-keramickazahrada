"use client"

import { AnimatePresence, motion, type Variants } from "framer-motion"
import { useEffect, useId, useRef, useState, type MouseEvent } from "react"
import { createPortal } from "react-dom"

import { deleteAccount, signout } from "@lib/data/customer"
import PremiumActionButton from "@modules/common/components/premium-action-button"
import XIcon from "@modules/common/icons/x"

import { accountEase, accountSweepEase } from "../../motion"
import styles from "./style.module.scss"

type DeleteAccountModalProps = {
  countryCode: string
  customerEmail?: string | null
  open: boolean
  onClose: () => void
}

const backdropVariants: Variants = {
  closed: {
    opacity: 0,
    transition: { duration: 0.28, ease: "easeIn" },
  },
  open: {
    opacity: 1,
    transition: { duration: 0.36, ease: "easeOut" },
  },
}

const panelVariants: Variants = {
  closed: {
    opacity: 0,
    y: 38,
    scale: 0.975,
    transition: {
      duration: 0.3,
      ease: "easeIn",
      when: "afterChildren",
    },
  },
  open: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.62,
      ease: accountEase,
      delayChildren: 0.12,
      staggerChildren: 0.075,
    },
  },
}

const contentVariants: Variants = {
  closed: {
    opacity: 0,
    y: 16,
    transition: { duration: 0.18, ease: "easeIn" },
  },
  open: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.48, ease: accountEase },
  },
}

const lineVariants: Variants = {
  closed: { scaleX: 0 },
  open: {
    scaleX: 1,
    transition: {
      duration: 0.8,
      delay: 0.18,
      ease: accountSweepEase,
    },
  },
}

const closeIconVariants: Variants = {
  rest: {
    rotate: 0,
    transition: { duration: 0.32, ease: accountEase },
  },
  hover: {
    rotate: 90,
    transition: { duration: 0.42, ease: accountEase },
  },
}

const statusVariants: Variants = {
  hidden: { opacity: 0, height: 0, y: -6 },
  visible: {
    opacity: 1,
    height: "auto",
    y: 0,
    transition: {
      height: { duration: 0.42, ease: accountSweepEase },
      opacity: { duration: 0.24, delay: 0.12, ease: "easeOut" },
      y: { duration: 0.38, ease: accountEase },
    },
  },
  exit: {
    opacity: 0,
    height: 0,
    y: -4,
    transition: {
      height: { duration: 0.28, ease: accountSweepEase },
      opacity: { duration: 0.16, ease: "easeIn" },
    },
  },
}

const focusableSelector = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",")

const DeleteAccountModal = ({
  countryCode,
  customerEmail,
  open,
  onClose,
}: DeleteAccountModalProps) => {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const isDeletingRef = useRef(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const closeModal = () => {
    if (isDeletingRef.current) return
    setError(null)
    onClose()
  }

  useEffect(() => {
    if (!open) return

    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus()
    }, 80)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        if (!isDeletingRef.current) {
          setError(null)
          onClose()
        }
        return
      }

      if (event.key !== "Tab" || !panelRef.current) return

      const focusableElements = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(focusableSelector)
      )

      if (!focusableElements.length) {
        event.preventDefault()
        panelRef.current.focus()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = previousOverflow
      returnFocusRef.current?.focus()
    }
  }, [open, onClose])

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) closeModal()
  }

  const handleDelete = async () => {
    if (isDeletingRef.current) return

    setError(null)
    isDeletingRef.current = true
    setIsDeleting(true)

    try {
      const result = await deleteAccount()

      if (!result.success) {
        setError(
          "Účet se nepovedlo smazat. Zkuste to prosím znovu, nebo nám napište."
        )
        isDeletingRef.current = false
        setIsDeleting(false)
        return
      }

      await signout(countryCode)
    } catch {
      setError(
        "Účet se nepovedlo smazat. Zkuste to prosím znovu, nebo nám napište."
      )
      isDeletingRef.current = false
      setIsDeleting(false)
    }
  }

  if (typeof document === "undefined") return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.backdrop}
          variants={backdropVariants}
          initial="closed"
          animate="open"
          exit="closed"
          onMouseDown={handleBackdropClick}
          data-testid="delete-account-modal"
        >
          <motion.div
            ref={panelRef}
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            tabIndex={-1}
            variants={panelVariants}
            initial="closed"
            animate="open"
            exit="closed"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <motion.div
              className={styles.topline}
              variants={lineVariants}
              aria-hidden="true"
            />

            <motion.div className={styles.header} variants={contentVariants}>
              <span className={styles.index}>Pozor</span>
              <motion.button
                ref={closeButtonRef}
                type="button"
                className={styles.close}
                onClick={closeModal}
                disabled={isDeleting}
                aria-label="Zavřít potvrzení smazání účtu"
                initial="rest"
                animate="rest"
                whileHover={isDeleting ? undefined : "hover"}
                whileFocus={isDeleting ? undefined : "hover"}
                whileTap={isDeleting ? undefined : { scale: 0.94 }}
              >
                <motion.span variants={closeIconVariants} aria-hidden="true">
                  <XIcon size="18" />
                </motion.span>
              </motion.button>
            </motion.div>

            <motion.h2 id={titleId} variants={contentVariants}>
              Smazat <em>účet?</em>
            </motion.h2>

            <motion.p
              id={descriptionId}
              className={styles.description}
              variants={contentVariants}
            >
              Objednávky nám musí zůstat kvůli účetnictví, ale přijdete o svůj
              profil, adresy, recenze i uložené kousky. Zpátky to už nevrátíme.
            </motion.p>

            {customerEmail && (
              <motion.div className={styles.account} variants={contentVariants}>
                <span>Smažeme tenhle účet</span>
                <strong>{customerEmail}</strong>
              </motion.div>
            )}

            <AnimatePresence mode="wait" initial={false}>
              {error && (
                <motion.p
                  key="delete-error"
                  className={styles.error}
                  role="alert"
                  variants={statusVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.div className={styles.actions} variants={contentVariants}>
              <PremiumActionButton
                text="Ponechat účet"
                onClickAction={closeModal}
                disabled={isDeleting}
                className={styles.keepAction}
                data-testid="cancel-delete-account-button"
              />
              <PremiumActionButton
                text={isDeleting ? "Mažu účet…" : "Ano, smazat"}
                onClickAction={handleDelete}
                disabled={isDeleting}
                active={isDeleting}
                className={styles.deleteAction}
                data-testid="confirm-delete-account-button"
              />
            </motion.div>

            <motion.p className={styles.note} variants={contentVariants}>
              Nic se nestane, dokud to nepotvrdíte tímhle tlačítkem.
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

export default DeleteAccountModal
