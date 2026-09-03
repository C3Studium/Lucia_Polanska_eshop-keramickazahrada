import { Metadata } from "next"

import { getPageCopy } from "@lib/data/site-copy"
import RequestResetPassword from "@modules/account/templates/forgot-password-page"

export const metadata: Metadata = {
  title: "Zapomenuté heslo",
  description: "Obnovte si heslo ke svému účtu v Keramické zahradě.",
}

export default async function ForgotPassword() {
  const copy = await getPageCopy("global")
  return <RequestResetPassword block={copy["global.prihlaseni"]} />
}
