import { Metadata } from "next"

import { listProducts } from "@lib/data/products"
import { getPageContentFull, getPageSeo } from "@lib/data/site-copy"
import VyrobaCta from "@modules/vyroba/cta"
import VyrobaInquiry from "@modules/vyroba/InquiryForm"
import VyrobaJourney from "@modules/vyroba/journey"

// Titulek a popis z bloku `vyroba.seo`; tohle je záloha pro prázdné CMS.
export async function generateMetadata(): Promise<Metadata> {
  return getPageSeo("vyroba", {
    title: "Jak vzniká keramika",
    description:
      "Sedm kroků ruční výroby keramiky — od prvního návrhu přes modelování a výpal až po hotový kus.",
  })
}

type Props = {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ produkt?: string | string[] }>
}

/**
 * `?produkt=<handle>` — zákazník přišel z výrobku s cenou po domluvě
 * (lib/util/price-on-request); poptávka se předvyplní jeho názvem. Neznámý
 * handle se tiše ignoruje, formulář je i tak celý.
 */
const inquiryProduct = async (countryCode: string, raw: string | string[] | undefined) => {
  const handle = Array.isArray(raw) ? raw[0] : raw
  if (!handle || !/^[\w-]{1,200}$/.test(handle)) return null
  try {
    const { response } = await listProducts({
      countryCode,
      queryParams: { handle, limit: 1, fields: "id,handle,title" },
    })
    const product = response.products[0]
    return product?.handle && product.title
      ? { handle: product.handle, title: product.title }
      : null
  } catch {
    return null
  }
}

export default async function Home({ params, searchParams }: Props) {
  const [{ countryCode }, query] = await Promise.all([params, searchParams])
  const product = await inquiryProduct(countryCode, query.produkt)
  /*
   * Redakční obsah stránky „Výroba" — dnes z něj sekce berou jen název
   * tlačítka, ale trasa je tím postavená: mapa jde dolů jako `copy` a další
   * blok se do ní přidá bez sahání do stránky.
   *
   * Výpadek CMS tuhle stránku nepoloží — vrátí se prázdno a sekce se
   * vykreslí s texty, které mají zabudované.
   */
  const copy = await getPageContentFull("vyroba")

  return (
    <>
      <VyrobaJourney
        block={copy["vyroba.galerie"]}
        texts={copy["vyroba.kroky"]}
        hero={copy["vyroba.hero"]}
      />
      <VyrobaCta copy={copy} />
      {/* Poptávka zakázky (LEGAL_AUDIT.md §6, §9) — kotva `#poptavka`. Texty
          z kódu, ne z CMS: jsou to předsmluvní informace k zakázce. */}
      <VyrobaInquiry product={product} />
    </>
  )
}
