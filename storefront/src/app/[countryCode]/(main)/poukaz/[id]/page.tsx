import { Metadata } from "next"

import { getGiftVoucher } from "@lib/data/gift-vouchers"
import PoukazDetail from "@modules/poukaz/PoukazDetail"
import PoukazNenalezen from "@modules/poukaz/PoukazNenalezen"

/* Soukromá stránka z odkazu v e-mailu — do vyhledávačů nepatří
   (a do sitemap.ts se nepřidává). */
export const metadata: Metadata = {
  title: "Dárkový poukaz",
  description: "Dárkový poukaz do Keramické zahrady.",
  robots: { index: false, follow: false },
}

/**
 * Stránka dárkového poukazu — sem vede odkaz z e-mailu a sem vrací ComGate
 * (`?vysledek=paid|cancelled|pending`). Kupující tu zaplatí, obdarovaný vidí
 * kód, hodnotu, zůstatek a platnost a může si poukaz vytisknout.
 *
 * Přístup dokazuje podepsaný `token`. Bez něj nebo se špatným se ukáže vlídná
 * stránka „poukaz se nepodařilo najít" — stejná pro neexistující id i špatný
 * token, ať se z ní nedá nic vyčíst.
 */
export default async function PoukazPage(props: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string; vysledek?: string }>
}) {
  const [{ id }, { token, vysledek }] = await Promise.all([
    props.params,
    props.searchParams,
  ])

  const voucher = token ? await getGiftVoucher(id, token) : null
  if (!voucher || !token) {
    return <PoukazNenalezen />
  }

  return <PoukazDetail initialVoucher={voucher} token={token} outcome={vysledek} />
}
