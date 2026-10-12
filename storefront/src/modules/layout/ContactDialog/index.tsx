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
import ContactDialogPanel, {
  type Inquiry,
  type OrderChangeRequest,
} from "./panel"

export type { OrderChangeRequest } from "./panel"

type ContactDialogContextValue = {
  /** Opens the dialog, optionally pre-selecting the topic the customer came in on. */
  open: (topic?: Inquiry) => void
  /**
   * Otevře dialog v režimu „Změna objednávky" (12. 10. 2026, Matěj) — bez
   * výběru tématu, jména a e-mailu, jen zpráva a povinný telefon; objednávku
   * nese `request` (číslo, id, token stránky úpravy).
   */
  openOrderChange: (request: OrderChangeRequest) => void
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
  /** Režim „Změna objednávky" — `null` = běžný kontaktní formulář. */
  const [orderChange, setOrderChange] = useState<OrderChangeRequest | null>(null)
  const pathname = usePathname()
  // Whatever the customer was on when they opened the dialog gets focus back on close.
  const triggerRef = useRef<HTMLElement | null>(null)

  const open = useCallback((next: Inquiry = "Obecný dotaz") => {
    triggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    setOrderChange(null)
    setTopic(next)
  }, [])

  const openOrderChange = useCallback((request: OrderChangeRequest) => {
    triggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    setOrderChange(request)
    // Téma jen kvůli `isOpen` a zpětné kompatibilitě panelu — v režimu změny
    // objednávky se výběr témat nevykresluje.
    setTopic("Objednávka")
  }, [])

  const close = useCallback(() => {
    setTopic(null)
    setOrderChange(null)
    triggerRef.current?.focus()
  }, [])

  // Following a link inside the dialog (FAQ, terms) navigates the page behind it; the dialog
  // must not stay open over the new route.
  useEffect(() => {
    setTopic(null)
    setOrderChange(null)
  }, [pathname])

  const value = useMemo(
    () => ({ open, openOrderChange, close, isOpen: topic !== null }),
    [open, openOrderChange, close, topic]
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
                orderChange={orderChange}
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
