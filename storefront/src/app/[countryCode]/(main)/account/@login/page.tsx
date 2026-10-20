import { Metadata } from "next"
import { getPageCopy } from "@lib/data/site-copy"
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

  // Hero vedle formuláře je globální (`global.prihlaseni`), věty ve formuláři
  // patří stránce účtu (`ucet.formular`).
  const [global, ucet] = await Promise.all([getPageCopy("global"), getPageCopy("ucet")])
  return (
    <LoginTemplate
      redirectTo={redirectTo}
      block={global["global.prihlaseni"]}
      form={ucet["ucet.formular"]}
    />
  )
}
