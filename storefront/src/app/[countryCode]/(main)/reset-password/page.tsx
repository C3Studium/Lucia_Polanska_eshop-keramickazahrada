import ResetPasswordForm from "@modules/account/templates/reset-password-page"
import { Metadata } from "next"


export const metadata: Metadata = {
  title: "Resetovat heslo",
  description: "Nastavte si nové heslo ke svému účtu v Keramické zahradě.",
}

export default function ResetPassword() {
  return <ResetPasswordForm />
}
