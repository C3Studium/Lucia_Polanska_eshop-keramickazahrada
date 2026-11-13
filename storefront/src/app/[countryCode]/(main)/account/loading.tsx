import { cookies } from "next/headers"

import SkeletonAccountPage from "@modules/skeletons/templates/skeleton-account-page"

/*
 * Kostra účtu jen pro přihlášeného (13. 11. 2026).
 *
 * Dřív se ukázala vždy — nepřihlášený viděl napřed nástěnku s objednávkami
 * a teprve pak naskočil přihlašovací formulář. Bez přihlašovací cookie se
 * nástěnka stejně neukáže, takže místo ní jen prázdná plocha stejné výšky
 * (bez poskočení stránky), dokud nedorazí formulář.
 */
export default async function Loading() {
  const prihlaseny = Boolean((await cookies()).get("_medusa_jwt")?.value)
  if (!prihlaseny) {
    return <div aria-busy="true" style={{ minHeight: "70vh" }} />
  }
  return <SkeletonAccountPage />
}
