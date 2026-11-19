/**
 * Jazyk zákaznických e-mailů (a všeho, co se zákazníkovi posílá mimo web).
 *
 * ## Proč podle země obchodu
 *
 * Storefront zůstává česky — web přeloží prohlížeč. E-mail, PDF nebo
 * platební bránu ale prohlížeč nepřeloží, a zákazník ze Slovenska, Polska
 * nebo Německa by dostal potvrzení objednávky, kterému nerozumí. Jazyk proto
 * jde se zemí, kterou si zákazník zvolil v přepínači zemí (`countryCode`
 * v URL): storefront ho zapíše do `cart.metadata.locale` a Medusa metadata
 * košíku zkopíruje do objednávky. E-maily, které chodí později (odeslání,
 * reklamace, doplatek…), tak jdou ve stejném jazyce jako objednávka.
 *
 * Země ≠ region: region „Europe" sdružuje Slovensko, Německo, Francii…
 * (všechny v eurech), takže jazyk z regionu poznat nejde — jen ze země.
 *
 * ## Jen čeština a angličtina (Matěj 19. 11. 2026)
 *
 * Česko a Slovensko dostávají ČEŠTINU, všechny ostatní země ANGLIČTINU.
 * Slovenština, polština a němčina se už neposílají — ani u starších
 * objednávek, které mají v `metadata.locale` uložené `sk`/`pl`/`de`:
 * čtení jazyka je sbalí (`collapseLocale`). Kde zemi neznáme vůbec
 * (prázdný kód), zůstává čeština. Texty v ostatních jazycích v šablonách
 * zůstávají (typ `Localized`), jen se nevybírají.
 *
 * Faktura iDoklad si dál bere jazyk ZEMĚ (`orderLanguageOf` — slovensky,
 * německy, jinak anglicky); Matěj měnil jen e-maily. Brána ComGate jde
 * s e-mailem (česky / anglicky).
 *
 * Soubor je čistý TypeScript bez frameworku, aby ho mohly importovat
 * i šablony (React Email) a storefront-like testy.
 */

export const EMAIL_LOCALES = ["cs", "sk", "pl", "de", "en"] as const
export type EmailLocale = (typeof EMAIL_LOCALES)[number]
export const DEFAULT_EMAIL_LOCALE: EmailLocale = "cs"

/** Texty ve všech jazycích — povinně všechny, ať žádný nechybí potichu. */
export type Localized<T> = Record<EmailLocale, T>

/** Země → jazyk země (pro fakturu). Jiná známá země dostane angličtinu. */
const COUNTRY_LANGUAGE: Record<string, EmailLocale> = {
  cz: "cs",
  sk: "sk",
  pl: "pl",
  de: "de",
  at: "de",
}

/**
 * Sbalí jakýkoli jazyk na ty dva, které se posílají: čeština/slovenština →
 * čeština, cokoli jiného → angličtina (19. 11. 2026).
 */
export const collapseLocale = (locale: EmailLocale): EmailLocale =>
  locale === "cs" || locale === "sk" ? "cs" : "en"

export const isEmailLocale = (value: unknown): value is EmailLocale =>
  typeof value === "string" && (EMAIL_LOCALES as readonly string[]).includes(value)

/** Jazyk ZEMĚ (`sk` → slovenština…) — jen pro fakturu; jiná země → angličtina, prázdná → čeština. */
export const languageForCountry = (countryCode: unknown): EmailLocale => {
  const code = typeof countryCode === "string" ? countryCode.trim().toLowerCase() : ""
  if (!/^[a-z]{2}$/.test(code)) return DEFAULT_EMAIL_LOCALE
  return COUNTRY_LANGUAGE[code] ?? "en"
}

/** Jazyk E-MAILU pro zemi: Česko a Slovensko česky, jiná země anglicky, prázdná česky. */
export const localeForCountry = (countryCode: unknown): EmailLocale =>
  collapseLocale(languageForCountry(countryCode))

/** Cokoli (i `"sk-SK"`, `"DE"`) na podporovaný jazyk; jinak čeština. */
export const normalizeEmailLocale = (value: unknown): EmailLocale => {
  if (typeof value !== "string") return DEFAULT_EMAIL_LOCALE
  const base = value.trim().toLowerCase().split(/[-_]/)[0]
  if (base === "cz") return "cs"
  return isEmailLocale(base) ? collapseLocale(base) : DEFAULT_EMAIL_LOCALE
}

/** Platný jazyk (bez sbalení), nebo `null`. */
const parseLanguage = (value: unknown): EmailLocale | null => {
  if (typeof value !== "string" || !value.trim()) return null
  const base = value.trim().toLowerCase().split(/[-_]/)[0]
  if (base === "cz") return "cs"
  return isEmailLocale(base) ? base : null
}

/** Platný jazyk e-mailu (sbalený na cs/en), nebo `null` — pro rozlišení „nevím" od „čeština". */
export const parseEmailLocale = (value: unknown): EmailLocale | null => {
  const language = parseLanguage(value)
  return language ? collapseLocale(language) : null
}

type LocaleSource = {
  metadata?: Record<string, unknown> | null
  shipping_address?: { country_code?: string | null } | null
  billing_address?: { country_code?: string | null } | null
} | null | undefined

/**
 * Jazyk objednávky nebo košíku: nejdřív to, co zapsal storefront
 * (`metadata.locale`), pak doručovací a fakturační země. Fakturační
 * je druhá schválně — u Balíkovny je doručovací adresa výdejna v Česku
 * a domácí adresa zákazníka leží ve fakturační.
 */
export const orderLanguageOf = (source: LocaleSource): EmailLocale => {
  const stored = parseLanguage(source?.metadata?.locale)
  if (stored) return stored
  const shipping = source?.shipping_address?.country_code
  if (shipping && languageForCountry(shipping) !== DEFAULT_EMAIL_LOCALE) {
    return languageForCountry(shipping)
  }
  return languageForCountry(source?.billing_address?.country_code ?? shipping)
}

/** Jazyk e-mailu k objednávce/košíku: česky (CZ, SK), jinak anglicky. */
export const emailLocaleOf = (source: LocaleSource): EmailLocale => collapseLocale(orderLanguageOf(source))

/** Text v daném jazyce; chybějící jazyk (nemělo by nastat) → čeština. */
export const pick = <T>(locale: EmailLocale | null | undefined, texts: Localized<T>): T =>
  texts[locale ?? DEFAULT_EMAIL_LOCALE] ?? texts[DEFAULT_EMAIL_LOCALE]

/** BCP 47 pro `Intl` — formát data a čísel podle jazyka e-mailu. */
export const intlLocale = (locale: EmailLocale | null | undefined): string =>
  ({ cs: "cs-CZ", sk: "sk-SK", pl: "pl-PL", de: "de-DE", en: "en-GB" })[locale ?? DEFAULT_EMAIL_LOCALE]

/** Jazyk platební brány ComGate (`lang`) — umí cs, sk, pl, de i en. */
export const comgateLang = (locale: EmailLocale | null | undefined): string =>
  locale ?? DEFAULT_EMAIL_LOCALE

/**
 * Názvy produktů v e-mailu — strojový překlad Googlem (`lib/google-translate`).
 *
 * Ručně se názvy nepřekládají (rozhodl Matěj 3. 11. 2026). Překlad k objednávce
 * leží na řádku (`item.metadata.title_<jazyk>`, zapíše ho
 * `ensureOrderTitleTranslations` při potvrzení objednávky); k košíku nebo
 * produktu ho `translateTitles` těsně před odesláním uloží sem do paměti.
 * Čtení je synchronní, aby šablony zůstaly čisté funkce.
 */
export const lineTitleKey = (locale: EmailLocale): string | null =>
  locale === "cs" ? null : `title_${locale}`

const titleCache = new Map<string, string>()
const TITLE_CACHE_LIMIT = 5_000

/** Zapamatuje překlad názvu (volá `lib/google-translate`). */
export const rememberTitleTranslation = (
  czech: string,
  locale: EmailLocale,
  translated: string
): void => {
  if (titleCache.size >= TITLE_CACHE_LIMIT) titleCache.clear()
  titleCache.set(`${locale}\u0000${czech.trim()}`, translated)
}

/** Překlad z paměti, nebo `null`. */
export const cachedTitleTranslation = (
  czech: string | null | undefined,
  locale: EmailLocale | null | undefined
): string | null => {
  if (!czech || !locale || locale === "cs") return null
  return titleCache.get(`${locale}\u0000${czech.trim()}`) ?? null
}

/** Název produktu v jazyce e-mailu (přeložený, nebo český). */
export const localizedProductName = (
  czech: string | null | undefined,
  locale: EmailLocale | null | undefined
): string => cachedTitleTranslation(czech, locale) ?? (czech ?? "").trim()

/**
 * Název položky objednávky/košíku v jazyce e-mailu: překlad uložený na řádku,
 * pak překlad z paměti, nakonec český snímek názvu (`product_title`).
 */
export const localizedLineTitle = (
  item: {
    product_title?: string | null
    title?: string | null
    metadata?: Record<string, unknown> | null
  } | null | undefined,
  locale: EmailLocale | null | undefined
): string => {
  const czech = (item?.product_title ?? item?.title ?? "").trim()
  if (!item || !locale || locale === "cs") return czech
  const key = lineTitleKey(locale)
  const stored = key ? item.metadata?.[key] : null
  if (typeof stored === "string" && stored.trim()) return stored.trim()
  return cachedTitleTranslation(czech, locale) ?? czech
}

/** Datum v e-mailu podle jazyka („2. 11. 2026" / „2.11.2026"). */
export const formatEmailDate = (
  value: unknown,
  locale: EmailLocale | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "numeric", year: "numeric" }
): string => {
  if (!value) return "—"
  const date = new Date(value as string)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: "Europe/Prague",
    ...options,
  }).format(date)
}

/** Částka podle jazyka e-mailu (měna je daná objednávkou, ne jazykem). */
export const formatEmailMoney = (
  amount: unknown,
  currencyCode: string | null | undefined,
  locale: EmailLocale | null | undefined
): string => {
  const numeric = Number(
    amount && typeof amount === "object"
      ? (amount as any).value ?? (amount as any).numeric_ ?? 0
      : amount
  )
  if (!Number.isFinite(numeric)) return "—"
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency: String(currencyCode || "CZK").toUpperCase(),
  }).format(numeric)
}

/** „ks" podle jazyka — počet kusů u položky. */
export const piecesLabel = (locale: EmailLocale | null | undefined): string =>
  pick(locale, { cs: "ks", sk: "ks", pl: "szt.", de: "Stk.", en: "pcs" })
