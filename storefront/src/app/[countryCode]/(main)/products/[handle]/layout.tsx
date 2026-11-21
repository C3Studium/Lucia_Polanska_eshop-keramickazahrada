import { notFound, permanentRedirect } from "next/navigation"
import { listProducts } from "@lib/data/products"
import { asciiHandle, productHandle } from "@lib/util/product-handle"

type Props = {
  children: React.ReactNode
  params: Promise<{ countryCode: string; handle: string }>
}

/**
 * Existuje výrobek? Rozhoduje se TADY, ne ve stránce (21. 11. 2026).
 *
 * Stránka má vlastní `loading.tsx`, takže odpověď začne téct se stavem 200
 * dřív, než stránka zjistí, že výrobek není — vymyšlená adresa pak vracela
 * 200 s textem „Stránka nenalezena" (pro vyhledávače „měkká 404") a stará
 * adresa s diakritikou jen přesměrování v HTML. Layout se vykresluje nad
 * hranicí `loading`, takže 404 i trvalé přesměrování dostanou skutečný stav.
 */
export default async function ProductHandleLayout({ children, params }: Props) {
  const { countryCode, handle: raw } = await params
  const handle = productHandle(raw)

  const found = await listProducts({
    countryCode,
    queryParams: { handle, fields: "id,handle" },
  }).then(({ response }) => response.products[0])

  if (!found) {
    // Stará adresa s diakritikou (18. 11. 2026) → nová ASCII adresa.
    const ascii = asciiHandle(handle)
    if (ascii && ascii !== handle) {
      const moved = await listProducts({
        countryCode,
        queryParams: { handle: ascii, fields: "id,handle" },
      }).then(({ response }) => response.products[0])
      if (moved?.handle) {
        permanentRedirect(`/${countryCode}/products/${moved.handle}`)
      }
    }
    notFound()
  }

  return children
}
