import type { HttpTypes } from "@medusajs/types"
import { hasEmptyShelf, productAvailability, variantAvailability, type Availability } from "../util/availability"

/**
 * Strukturovaná data výrobku (schema.org Product + Offer) pro vyhledávače.
 *
 * Z nich Google i Seznam berou cenu, „Skladem" a obrázky do hledání obrázků,
 * nákupních výsledků a Google Lens (21. 11. 2026 — starý WooCommerce je
 * vydával, nový obchod ne). Dostupnost se odvozuje stejným slovníkem jako
 * karta výrobku (`lib/util/availability`), aby vyhledávač neříkal něco jiného
 * než stránka. Cena je ta, kterou zákazník zaplatí (po slevě / ve výprodeji).
 */

const SCHEMA = "https://schema.org/"
const SHOP_NAME = "Keramická zahrada"

type Rating = { average: number; count: number }

export type ProductJsonLdInput = {
  product: HttpTypes.StoreProduct
  countryCode: string
  /** Měna regionu („czk"), ve které jsou `calculated_price`. */
  currencyCode: string
  /** Veřejná adresa obchodu bez lomítka na konci. */
  baseUrl: string
  /** Hlavní kategorie pro drobečkovou navigaci. */
  category?: { name: string; handle: string } | null
  rating?: Rating | null
}

const AVAILABILITY: Record<Availability, string> = {
  "in-stock": "InStock",
  "last-one": "InStock",
  "made-to-order": "MadeToOrder",
  "sold-out": "OutOfStock",
}

function schemaAvailability(state: Availability, emptyShelf: boolean) {
  // Vyprodaný kus, který se dorobí, je pro vyhledávač „na objednávku zpět
  // na skladě"; kus, u kterého se sklad nevede, se dělá na objednávku.
  if (state === "made-to-order" && emptyShelf) return `${SCHEMA}BackOrder`
  return `${SCHEMA}${AVAILABILITY[state]}`
}

/** HTML a entity z popisu pryč — vyhledávač chce prostý text. */
function plainText(html: string | null | undefined) {
  return (html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5000)
}

const money = (amount: number) => amount.toFixed(2)

const priceOf = (variant: HttpTypes.StoreProductVariant) => {
  const amount = Number(variant.calculated_price?.calculated_amount ?? 0)
  return Number.isFinite(amount) ? amount : 0
}

function returnPolicy(madeToOrder: boolean, country: string) {
  const applicableCountry = country.toUpperCase()
  if (madeToOrder) {
    // Zakázka podle zadání zákazníka se podle § 1837 OZ vrátit nedá.
    return {
      "@type": "MerchantReturnPolicy",
      applicableCountry,
      returnPolicyCategory: `${SCHEMA}MerchantReturnNotPermitted`,
    }
  }
  // Obchodní podmínky (2026-11-03): 14 dní od převzetí, poštou, přímé
  // náklady na vrácení nese zákazník.
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry,
    returnPolicyCategory: `${SCHEMA}MerchantReturnFiniteReturnWindow`,
    merchantReturnDays: 14,
    returnMethod: `${SCHEMA}ReturnByMail`,
    returnFees: `${SCHEMA}ReturnFeesCustomerResponsibility`,
  }
}

/**
 * „Fotka pro vyhledávače" z adminu (Produkty+ „…", `metadata.seo_image`,
 * 21. 11. 2026) — jen dokud ta fotka u výrobku pořád je. Smazaná fotka by
 * jinak dál visela v náhledu odkazu, i když ji obchod už neukazuje.
 */
function chosenSeoImage(product: HttpTypes.StoreProduct): string | null {
  const chosen = (product.metadata as Record<string, unknown> | null)?.seo_image
  if (typeof chosen !== "string" || !chosen) return null
  const own = [...(product.images ?? []).map((image) => image.url), product.thumbnail]
  return own.includes(chosen) ? chosen : null
}

/** Fotka pro náhled odkazu (og:image): vybraná v adminu, jinak náhled kusu. */
export function seoImageOf(product: HttpTypes.StoreProduct): string | null {
  return chosenSeoImage(product) ?? product.thumbnail ?? product.images?.[0]?.url ?? null
}

/** Graf pro `<script type="application/ld+json">`, nebo `null`, když není co říct. */
export function productJsonLd(input: ProductJsonLdInput): Record<string, unknown> | null {
  const { product, countryCode, currencyCode, category, rating } = input
  const base = input.baseUrl.replace(/\/$/, "")
  const url = encodeURI(`${base}/${countryCode}/products/${product.handle}`)

  const variants = (product.variants ?? []).filter((variant) => priceOf(variant) > 0)
  const madeToOrder = Boolean((product.metadata as Record<string, unknown> | null)?.made_to_order)
  const hasRating = Boolean(rating && rating.count > 0 && rating.average > 0)

  // Bez ceny (cena po domluvě) i bez hodnocení by vyhledávač Product odmítl.
  if (!variants.length && !hasRating) {
    return null
  }

  const images = (product.images ?? []).map((image) => image.url).filter(Boolean)
  if (!images.length && product.thumbnail) images.push(product.thumbnail)
  // Fotka pro vyhledávače z adminu jde první — tu vyhledávač bere nejspíš.
  const chosen = chosenSeoImage(product)
  if (chosen) {
    const at = images.indexOf(chosen)
    if (at >= 0) images.splice(at, 1)
    images.unshift(chosen)
  }
  // Vyhledávač chce absolutní adresy; relativní cesta (např. /assets/…) se doplní o doménu.
  const absoluteImages = images.map((src) => new URL(src, `${base}/`).href)

  const seller = { "@type": "Organization", name: SHOP_NAME, url: base }
  const currency = currencyCode.toUpperCase()
  const emptyShelf = hasEmptyShelf(product)

  let offers: Record<string, unknown> | undefined
  if (variants.length) {
    const prices = variants.map(priceOf)
    const low = Math.min(...prices)
    const high = Math.max(...prices)
    const common = {
      priceCurrency: currency,
      availability: schemaAvailability(
        variants.length === 1 ? variantAvailability(variants[0]) : productAvailability({ variants }),
        emptyShelf
      ),
      itemCondition: `${SCHEMA}NewCondition`,
      url,
      seller,
      hasMerchantReturnPolicy: returnPolicy(madeToOrder, countryCode),
    }
    offers =
      low === high
        ? { "@type": "Offer", price: money(low), ...common }
        : { "@type": "AggregateOffer", lowPrice: money(low), highPrice: money(high), offerCount: variants.length, ...common }
  }

  const description = plainText(product.description || product.subtitle)
  const sku = product.variants?.find((variant) => variant.sku)?.sku

  const productNode: Record<string, unknown> = {
    "@type": "Product",
    "@id": `${url}#product`,
    name: product.title,
    url,
    ...(description ? { description } : {}),
    ...(absoluteImages.length ? { image: absoluteImages.slice(0, 10) } : {}),
    ...(sku ? { sku } : {}),
    brand: { "@type": "Brand", name: SHOP_NAME },
    ...(category ? { category: category.name } : {}),
    ...(offers ? { offers } : {}),
    ...(hasRating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Math.round(rating!.average * 100) / 100,
            reviewCount: rating!.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  }

  const crumbs = [
    { name: SHOP_NAME, item: `${base}/${countryCode}` },
    { name: "Obchod", item: `${base}/${countryCode}/store` },
    ...(category ? [{ name: category.name, item: encodeURI(`${base}/${countryCode}/categories/${category.handle}`) }] : []),
    { name: product.title, item: url },
  ]

  return {
    "@context": "https://schema.org",
    "@graph": [
      productNode,
      {
        "@type": "BreadcrumbList",
        itemListElement: crumbs.map((crumb, index) => ({ "@type": "ListItem", position: index + 1, ...crumb })),
      },
    ],
  }
}

/** JSON pro vložení do `<script>` — „<" escapované, aby text z adminu skript neukončil. */
export function jsonLdScript(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c")
}
