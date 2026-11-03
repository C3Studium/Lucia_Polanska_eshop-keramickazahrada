"use client"

import type { ReactNode } from "react"

import type { ContactEmails } from "@lib/constants/contact"
import { useContactEmails } from "@lib/context/contact-emails"

/**
 * Odkaz `mailto:` na kontaktní e-mail ze Studia (`global.kontakty`).
 *
 * Vlastní klientská komponenta, ne hook v místě: vykresluje se i z modulů bez
 * `"use client"` (vstup do odstoupení, který si berou klientské stránky
 * i serverové šablony), kde hook zavolat nejde. Komponenta z klientského
 * modulu jde vložit do obojího.
 *
 * `role` — `objednavky` u všeho, co se týká konkrétní objednávky nebo
 * zakázky; `dotazy` u obecných otázek. Bez `children` vypíše adresu samu.
 */
export default function ContactEmailLink({
  role,
  className,
  children,
}: {
  role: keyof ContactEmails
  className?: string
  children?: ReactNode
}) {
  const email = useContactEmails()[role]
  return (
    <a className={className} href={`mailto:${email}`}>
      {children ?? email}
    </a>
  )
}
