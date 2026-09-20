import { retrieveCustomer } from "@lib/data/customer"
import VerifyEmailReminderPage from "@modules/account/templates/send-email-verification-again-page"

/*
 * Záměrně BEZ exportu metadata: tohle je paralelní slot, jehož metadata
 * v Nextu přebíjejí titulek celé /account stránky — i přihlašovací
 * obrazovka se pak jmenovala „Potvrzení e-mailu". Titulek patří hlavní
 * stránce účtu, slot žádný nepotřebuje.
 */

export default async function VerifyEmail() {
  const customer = await retrieveCustomer().catch(() => null)

  if (!customer) {
    // Optionally render a fallback or redirect
    return <div>Takový účet jsme nenašli.</div>
  }

  return <VerifyEmailReminderPage customer={{ email: customer.email }} />
}