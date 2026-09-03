
import { Dialog } from "@headlessui/react"
import { clx } from "@medusajs/ui"
import { AnimatePresence, motion, type Variants } from "framer-motion"
import React from "react"
import { ModalProvider, useModal } from "@lib/context/modal-context"
import X from "@modules/common/icons/x"

import styles from "../../../account/components/address-card/styles.module.scss"

type ModalProps = {
  isOpen: boolean
  close: () => void
  size?: "small" | "medium" | "large"
  search?: boolean
  children: React.ReactNode
  'data-testid'?: string
}
const modalBackdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: .3, ease: "easeOut" } },
  exit: { opacity: 0, transition: { duration: .22, ease: "easeIn" } },
}

/* Offsets in vh, not px: the panel is height-bound (max-height is a share of
   100svh), so its entrance has to be a share of the same axis or it reads as a
   long slide on a 660px laptop and a twitch on a 1351px monitor. 34px and 18px
   at 1080 = 3.15vh and 1.7vh. Same form the rest of the account and checkout
   motion already uses (auth-portal, delete-account, address-select). */
const modalPanelVariants: Variants = {
  hidden: { opacity: 0, y: "3.15vh", scale: .985 },
  visible: {
    opacity: 1,
    y: "0vh",
    scale: 1,
    transition: { duration: .58, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: "1.7vh",
    scale: .99,
    transition: { duration: .28, ease: "easeIn" },
  },
}

const Modal = ({
  isOpen,
  close,
  size = "medium",
  search = false,
  children,
  'data-testid': dataTestId
}: ModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog
          static
          open={isOpen}
          as="div"
          className={styles.modal}
          onClose={close}
        >
          <motion.div
            className={styles.backdrop}
            variants={modalBackdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          />

          <div
            className={clx(styles.container, {
              [styles.search]: search,
            })}
          >
            {/* data-lenis-prevent: the panel is the scroll container for the form
                inside it. Without this Lenis swallows the wheel and scrolls the page
                behind the modal, which left Save unreachable on a 1366x768 laptop. */}
            <Dialog.Panel
              as={motion.div}
              data-testid={dataTestId}
              data-lenis-prevent
              className={clx(
                styles.panel,
                {
                  [styles.small]: size === "small",
                  [styles.medium]: size === "medium",
                  [styles.large]: size === "large",
                  [styles.transparent]: search,
                }
              )}
              variants={modalPanelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <ModalProvider close={close}>{children}</ModalProvider>
            </Dialog.Panel>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  )
}

const Title: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { close } = useModal()
  return (
    <Dialog.Title className={styles.title}>
      <div className={styles.text}>{children}</div>
      <button
        onClick={close}
        aria-label="Zavřít"
        data-testid="close-modal-button"
        className={styles.closeBtn}
      >
        <X size={20} />
      </button>
    </Dialog.Title>
  )
}

const Description: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Dialog.Description className={styles.description}>
      {children}
    </Dialog.Description>
  )
}

const Body: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <div className={styles.body}>{children}</div>
}

const Footer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <div className={styles.footer}>{children}</div>
}

Modal.Title = Title
Modal.Description = Description
Modal.Body = Body
Modal.Footer = Footer

export default Modal
