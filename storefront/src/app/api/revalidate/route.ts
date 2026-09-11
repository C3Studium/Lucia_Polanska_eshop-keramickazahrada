import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

/**
 * „Něco se v obchodě změnilo, zahoď uloženou podobu stránek."
 *
 * ## Proč to existuje
 *
 * Data obchodu se cachují na serveru. Když se v administraci založí výrobek,
 * balíček nebo sleva, návštěvník to neuvidí, dokud cache sama nevyprší —
 * naměřeno na vlastní kůži: po zapnutí prodeje bez skladu vracelo API u všech
 * variant `allow_backorder: true`, ale obchod ještě dlouho ukazoval „Prodáno".
 *
 * Backend proto po každé takové změně zaklepe sem (`subscribers/
 * revalidate-storefront.ts`) a tahle routa cache zahodí.
 *
 * ## Proč cesty, a ne značky
 *
 * Nabízelo by se `revalidateTag("products")`, jenže značky téhle aplikace
 * nesou navíc `_medusa_cache_id` z cookie NÁVŠTĚVNÍKA (`lib/data/cookies.ts`),
 * takže se jmenují `products-<id>` a je jich tolik, kolik je lidí. Server je
 * zvenčí nemá jak vyjmenovat. Cesta žádnou cookie nezná, a proto funguje.
 *
 * ## Bezpečnost
 *
 * Sdílené tajemství v hlavičce. Bez něj by kdokoli mohl opakovaným voláním
 * shodit cache a tím i výkon.
 */

/** Co se zahazuje, když volající neřekne jinak. */
const VYCHOZI_CESTY = ["/[countryCode]/store", "/[countryCode]"]

export async function POST(request: Request) {
  const tajemstvi = process.env.REVALIDATE_SECRET

  if (!tajemstvi) {
    /* Bez nastaveného tajemství se routa neotevírá — tichý souhlas by z ní
       udělal veřejné tlačítko na zahazování cache. */
    return NextResponse.json(
      { revalidated: false, message: "REVALIDATE_SECRET není nastavené." },
      { status: 503 }
    )
  }

  if (request.headers.get("x-revalidate-secret") !== tajemstvi) {
    return NextResponse.json(
      { revalidated: false, message: "Neplatné tajemství." },
      { status: 401 }
    )
  }

  let telo: { paths?: unknown } = {}
  try {
    telo = await request.json()
  } catch {
    /* Prázdné tělo je v pořádku — zahodí se výchozí cesty. */
  }

  const cesty = Array.isArray(telo.paths)
    ? telo.paths.filter((c): c is string => typeof c === "string" && c.startsWith("/"))
    : VYCHOZI_CESTY

  for (const cesta of cesty) {
    /* `page` i pro dynamické segmenty: `/[countryCode]/store` je jedna stránka
       ve všech zemích a Next si podle typu poradí sám. */
    revalidatePath(cesta, "page")
  }

  return NextResponse.json({ revalidated: true, paths: cesty })
}
