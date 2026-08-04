import VerifyEmailPage from "@modules/account/templates/verify-email-page"
import { Metadata } from "next"


export const metadata: Metadata = {
  title: "Potvrzení e-mailu",
  description: "Ověřte svou e-mailovou adresu pro svůj účet v Keramické zahradě.",
}

export default function VerifyEmail() {
  return <VerifyEmailPage />
}
