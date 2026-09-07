import ResetPasswordForm from "@modules/account/templates/reset-password-page"
import { Metadata } from "next"


export const metadata: Metadata = {
  title: "Resetovat heslo",
  description: "Nastavte si nové heslo ke svému účtu v Keramické zahradě.",
  /* Token na obnovu hesla přichází v adrese, a adresa odchází v hlavičce
     `Referer` každému, na koho stránka odkáže nebo od koho načte skript či
     písmo. Cizí server by tím dostal do logu živý klíč k účtu. `no-referrer`
     tu hlavičku zruší. Ze samotné adresy ji stránka po načtení ještě smaže
     (viz šablona), tohle je pojistka pro tu chvíli předtím. */
  referrer: "no-referrer",
  /* Stránka existuje jen pro jedno kliknutí z e-mailu. Ve vyhledávači nemá
     co dělat a indexovaná adresa s tokenem už vůbec ne. */
  robots: { index: false, follow: false },
}

export default function ResetPassword() {
  return <ResetPasswordForm />
}
