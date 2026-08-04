import { Metadata } from "next"
import LoginTemplate from "@modules/account/templates/login-template"

export const metadata: Metadata = {
  title: "Přihlášení",
  description: "Přihlaste se ke svému účtu v Keramické zahradě.",
}

type LoginPageProps = {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ redirectTo?: string | string[] }>
}

export default async function Login({ params, searchParams }: LoginPageProps) {
  const [{ countryCode }, query] = await Promise.all([params, searchParams])
  const redirectTo =
    query.redirectTo === "/cart" ? `/${countryCode}/cart` : undefined

  return <LoginTemplate redirectTo={redirectTo} />
}
