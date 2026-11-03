"use client"

import { createContext, useContext, type ReactNode } from "react"

import { CONTACT_EMAILS, type ContactEmails } from "@lib/constants/contact"

/**
 * Kontaktní e-maily ze Studia pro KLIENTSKÉ komponenty (úprava objednávky,
 * odstoupení, platba, patička…).
 *
 * Načte je na serveru layout skupiny (`getContactEmails()` — blok
 * `global.kontakty`) a podá sem; komponenta si je vezme `useContactEmails()`.
 * Layouty jsou tři — hlavní web, pokladna a rychlý nákup —, ne kořenový:
 * ten CMS nečte a nemá začít (čtení s `draftMode()` by se pak dělalo pod
 * každou routou, i pod Studiem a tiskem dokumentů). Ty tři blok `global`
 * načítají tak jako tak, nebo jsou dynamické kvůli košíku.
 *
 * Mimo poskytovatele vrací zálohy z kódu — stejně jako při výpadku CMS.
 */
const ContactEmailsContext = createContext<ContactEmails | null>(null)

export function ContactEmailsProvider({
  emails,
  children,
}: {
  emails: ContactEmails
  children: ReactNode
}) {
  return (
    <ContactEmailsContext.Provider value={emails}>{children}</ContactEmailsContext.Provider>
  )
}

export const useContactEmails = (): ContactEmails =>
  useContext(ContactEmailsContext) ?? CONTACT_EMAILS
