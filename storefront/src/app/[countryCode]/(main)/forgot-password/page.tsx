import { Metadata } from "next"

import RequestResetPassword from "@modules/account/templates/forgot-password-page"

export const metadata: Metadata = {
  title: "Zapomenuté heslo",
  description: "Obnovte si heslo ke svému účtu v Keramické zahradě.",
}

export default function ForgotPassword() {
  return <RequestResetPassword />
}
