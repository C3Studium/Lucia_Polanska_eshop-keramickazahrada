import { formatMoney } from "./customer-email"
import { lineQuantityOf, toNumber } from "./order-quantity"
import {
  isPackagingLine,
  isServiceLine,
  PACKAGING_TITLE,
  packagingTitleFor,
  packagingVariantOf,
  withPackagingUnderProducts,
} from "./packaging-lines"
import { localizedLineTitle, pick, type EmailLocale } from "./email-locale"

/**
 * Servisní řádky jsou v objednávce česky („Balné", „Doběrečné"); do
 * cizojazyčného e-mailu se přeloží podle známých názvů. Neznámý název
 * (ruční služba) zůstane, jak je.
 */
const SERVICE_TITLES: Record<string, Record<EmailLocale, string>> = {
  [PACKAGING_TITLE]: { cs: "Balné", sk: "Balné", pl: "Opakowanie", de: "Verpackung", en: "Packaging fee" },
  "Doběrečné": { cs: "Doběrečné", sk: "Poplatok za dobierku", pl: "Opłata za pobranie", de: "Nachnahmegebühr", en: "Cash on delivery fee" },
  "Poštovné": { cs: "Poštovné", sk: "Poštovné", pl: "Wysyłka", de: "Versand", en: "Postage" },
  "Doprava": { cs: "Doprava", sk: "Doprava", pl: "Wysyłka", de: "Versand", en: "Shipping" },
  "Záloha": { cs: "Záloha", sk: "Záloha", pl: "Zaliczka", de: "Anzahlung", en: "Deposit" },
  "Služba": { cs: "Služba", sk: "Služba", pl: "Usługa", de: "Leistung", en: "Service" },
  "Položka": { cs: "Položka", sk: "Položka", pl: "Pozycja", de: "Position", en: "Item" },
}

const serviceTitle = (title: string, locale: EmailLocale | null | undefined): string => {
  if (!locale || locale === "cs") return title
  const known = SERVICE_TITLES[title.trim()]
  if (known) return pick(locale, known)
  // „Balné — Keramické pítko" z řádku refundace: přeloží se aspoň „Balné".
  const prefix = `${PACKAGING_TITLE} — `
  return title.startsWith(prefix)
    ? `${pick(locale, SERVICE_TITLES[PACKAGING_TITLE])} — ${title.slice(prefix.length)}`
    : title
}

/** „Balné — Keramické pítko" v jazyce e-mailu. */
const packagingTitleIn = (productTitle: string | null, locale: EmailLocale | null | undefined) =>
  !locale || locale === "cs"
    ? packagingTitleFor(productTitle)
    : productTitle
      ? `${serviceTitle(PACKAGING_TITLE, locale)} — ${productTitle}`
      : serviceTitle(PACKAGING_TITLE, locale)

/** Výchozí české provedení — v cizojazyčném e-mailu nic neříká, vynechá se. */
const CESKE_VYCHOZI_PROVEDENI = /^(standardní|standard|výchozí)$/i

/**
 * „Za co ta platba byla" — položky objednávky nebo košíku do e-mailu.
 *
 * ## Proč to existuje
 *
 * E-maily o penězích (platba přijata, platba neprošla, výzva k doplacení,
 * vracíme peníze) uváděly číslo objednávky, způsob platby a částku — ale ne
 * to, co si zákazník koupil. Kdo u nás koupil dvakrát za týden, nepoznal,
 * které objednávky se peníze týkají. Faktura to říká, jenže ta je příloha,
 * kterou si nikdo neotvírá, aby zjistil, za co platil.
 *
 * Výpis se proto skládá tady, jednou, a šablony ho jen vykreslí
 * (`PaidFor` v `modules/resend/components/email-ui`). Objednávka i košík
 * mají stejné řádky, takže stejná funkce obslouží i „platba neprošla" z
 * pokladny, kde objednávka ještě neexistuje.
 *
 * ## Co se do výpisu dostane
 *
 * Zboží s fotkou, provedením a množstvím; balné a doběrečné jako servisní
 * řádky (drobným, bez fotky) — nejsou to výrobky, ale zákazník je zaplatil,
 * takže v „za co platíte" patří. Pořadí je stejné jako v potvrzení
 * objednávky: balné hned pod svým výrobkem.
 */

export type EmailLineItem = {
  title: string
  /** Provedení (varianta) u výrobku, termín u kurzu. */
  subtitle?: string | null
  quantity?: number | null
  /** Už naformátovaná částka („1 200 Kč"); prázdná se nevypíše. */
  amount?: string | null
  thumbnail?: string | null
  /** Balné, doběrečné — drobný řádek bez fotky a bez pořadového čísla. */
  service?: boolean
}

type LineLike = {
  title?: string | null
  product_title?: string | null
  variant_title?: string | null
  thumbnail?: string | null
  total?: unknown
  metadata?: Record<string, unknown> | null
  variant_id?: string | null
  product_id?: string | null
  /** Pro překlad názvu (`items.product.metadata` v dotazu). */
  product?: { metadata?: Record<string, unknown> | null } | null
}

/** Provedení se nevypisuje, když je to jen Medusí výchozí „Default variant". */
const VYCHOZI_PROVEDENI = /^(default\s+variant|default)$/i

/**
 * Položky objednávky nebo košíku jako řádky do e-mailu. Prázdné pole
 * znamená „nevykresluj nic" — prázdná sekce „za co platíte" je horší než
 * žádná.
 */
export const emailLineItems = (
  source:
    | {
        items?: LineLike[] | null
        currency_code?: string | null
      }
    | null
    | undefined,
  /** Jazyk e-mailu — názvy z `product.metadata.title_xx`, částky podle jazyka. */
  locale?: EmailLocale | null
): EmailLineItem[] => {
  const currency = source?.currency_code ?? null
  const items = ((source?.items ?? []) as LineLike[]).filter(Boolean)
  if (!items.length) {
    return []
  }

  /* Balné se jmenuje po výrobku, ke kterému patří (stejně jako na faktuře);
     vlastní `title` řádku je jen „Balné" a u objednávky s víc kusy by
     neřeklo, ke kterému. Pojí je varianta. */
  const nazevVarianty = new Map<string, string>()
  for (const item of items) {
    if (item.variant_id) {
      const nazev = localizedLineTitle(item, locale)
      if (nazev) nazevVarianty.set(item.variant_id, nazev)
    }
  }

  return withPackagingUnderProducts(items).map((item) => {
    const service = isServiceLine(item)
    const quantity = lineQuantityOf(item as never)
    const total = toNumber(item.total)
    /* Doběrečné a jiné servisní řádky mají jen vlastní `title`. */
    const title = service
      ? isPackagingLine(item)
        ? packagingTitleIn(nazevVarianty.get(packagingVariantOf(item) ?? "") ?? null, locale)
        : serviceTitle((item.title ?? "").trim() || "Služba", locale)
      : localizedLineTitle(item, locale) || serviceTitle("Položka", locale)
    const variantRaw = (item.variant_title ?? "").trim()
    const variant =
      locale && locale !== "cs" && CESKE_VYCHOZI_PROVEDENI.test(variantRaw) ? "" : variantRaw

    return {
      title,
      subtitle:
        !service && variant && !VYCHOZI_PROVEDENI.test(variant) ? variant : null,
      quantity: quantity > 0 ? quantity : null,
      amount: Number.isFinite(total) ? formatMoney(total, currency, locale) : null,
      thumbnail: service ? null : (item.thumbnail ?? null),
      ...(service ? { service: true } : {}),
    }
  })
}

/**
 * Řádky refundace („za co vracíme peníze") — košík vrácení z modulu
 * reklamací doplněný o fotky z objednávky.
 *
 * Řádky jsou tu autoritou: vrací se jen to, co opravdu schválila
 * (§13.2), takže se neopisuje celá objednávka. Fotka se dohledá podle
 * `line_item_id`; poštovné, záloha a ruční částka fotku nemají a jdou
 * drobným řádkem.
 */
export const refundEmailLineItems = (
  order: { items?: LineLike[] | null } | null | undefined,
  lines:
    | Array<{
        line_item_id?: string | null
        title?: string | null
        quantity?: number | null
        amount?: unknown
        type?: string | null
      }>
    | null
    | undefined,
  currency: string | null | undefined,
  /** Jazyk e-mailu — viz `emailLineItems`. */
  locale?: EmailLocale | null
): EmailLineItem[] => {
  const items = ((order?.items ?? []) as (LineLike & { id?: string })[]).filter(Boolean)
  const podleId = new Map(items.filter((item) => item.id).map((item) => [item.id, item]))

  return (lines ?? [])
    .filter((line) => line && (line.title || line.line_item_id))
    .map((line) => {
      const zbozi = line.type === "item" || line.type === "component"
      const item = line.line_item_id ? podleId.get(line.line_item_id) : undefined
      const amount = toNumber(line.amount)
      /* Řádek refundace nese český název z objednávky; u zboží se v jiném
         jazyce vezme překlad produktu, servisní řádky přes známé názvy. */
      const czech =
        (line.title ?? "").trim() || (item?.product_title ?? item?.title ?? "").trim()
      const title =
        locale && locale !== "cs"
          ? zbozi && item
            ? localizedLineTitle(item, locale) || czech
            : serviceTitle(czech || "Položka", locale)
          : czech || "Položka"
      const variant = (item?.variant_title ?? "").trim()
      return {
        title,
        subtitle: zbozi
          ? (locale && locale !== "cs" && CESKE_VYCHOZI_PROVEDENI.test(variant) ? null : variant || null)
          : null,
        quantity: line.quantity && line.quantity > 0 ? line.quantity : null,
        amount: Number.isFinite(amount) && amount !== 0 ? formatMoney(amount, currency, locale) : null,
        thumbnail: zbozi ? (item?.thumbnail ?? null) : null,
        ...(zbozi ? {} : { service: true }),
      }
    })
}

/**
 * Jeden textový řádek („Kurz točení · sobota 12. 9. · 2 místa") pro to, co
 * fotku nemá. Kurzy a poukazy mají vlastní šablony s vlastními řádky; tahle
 * funkce je pro případy, kde je potřeba výpis ve stejném tvaru jako u zboží.
 */
export const textEmailLineItem = (input: {
  title: string
  subtitle?: string | null
  quantity?: number | null
  amount?: string | null
}): EmailLineItem[] =>
  input.title?.trim()
    ? [
        {
          title: input.title.trim(),
          subtitle: input.subtitle ?? null,
          quantity: input.quantity ?? null,
          amount: input.amount ?? null,
        },
      ]
    : []
