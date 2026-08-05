"use client"

import { AnimatePresence } from "framer-motion"
import { usePathname } from "next/navigation"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"

import type { MerchantIdentity } from "@lib/data/merchant"
import ContactDialogPanel, { type Inquiry } from "./panel"

type ContactDialogContextValue = {
  /** Opens the dialog, optionally pre-selecting the topic the customer came in on. */
  open: (topic?: Inquiry) => void
  close: () => void
  isOpen: boolean
}

const ContactDialogContext = createContext<ContactDialogContextValue | null>(null)

/**
 * Contact is a site-wide surface (D-S5): one dialog instance lives at the layout level and
 * anything on the page — navbar, footer, a page CTA — asks it to open. Previously the dialog
 * was bundled with its button inside the Kurzy module and re-mounted per trigger.
 */
export function ContactDialogProvider({
  merchant,
  children,
}: {
  merchant: MerchantIdentity
  children: ReactNode
}) {
  const [topic, setTopic] = useState<Inquiry | null>(null)
  const pathname = usePathname()
  // Whatever the customer was on when they opened the dialog gets focus back on close.
  const triggerRef = useRef<HTMLElement | null>(null)

  const open = useCallback((next: Inquiry = "Obecný dotaz") => {
    triggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    setTopic(next)
  }, [])

  const close = useCallback(() => {
    setTopic(null)
    triggerRef.current?.focus()
  }, [])

  // Following a link inside the dialog (FAQ, terms) navigates the page behind it; the dialog
  // must not stay open over the new route.
  useEffect(() => {
    setTopic(null)
  }, [pathname])

  const value = useMemo(
    () => ({ open, close, isOpen: topic !== null }),
    [open, close, topic]
  )

  return (
    <ContactDialogContext.Provider value={value}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {topic !== null && (
              <ContactDialogPanel
                merchant={merchant}
                initialTopic={topic}
                onClose={close}
              />
            )}
          </AnimatePresence>,
          document.body
        )}
    </ContactDialogContext.Provider>
  )
}

export function useContactDialog() {
  const context = useContext(ContactDialogContext)

  if (!context) {
    throw new Error(
      "useContactDialog must be used inside <ContactDialogProvider> (mounted in the route layouts)."
    )
  }

  return context
}
