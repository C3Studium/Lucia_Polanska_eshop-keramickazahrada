import { Metadata } from "next"
import { retrieveCustomer } from "@lib/data/customer"
import VerifyEmailReminderPage from "@modules/account/templates/send-email-verification-again-page"

export const metadata: Metadata = {
  title: "Potvrzení e-mailu",
  description: "Ověřte svou e-mailovou adresu pro svůj účet v Keramické zahradě.",
}

export default async function VerifyEmail() {
  const customer = await retrieveCustomer().catch(() => null)

  if (!customer) {
    // Optionally render a fallback or redirect
    return <div>Takový účet jsme nenašli.</div>
  }

  return <VerifyEmailReminderPage customer={{ email: customer.email }} />
}