/**
 * Názvy produktů v cizojazyčných e-mailech — Google Translate.
 *
 * Názvy produktů ručně nepřekládáme (rozhodl Matěj 3. 11. 2026): web je česky
 * a přeloží ho prohlížeč, e-mail ale prohlížeč nepřeloží. Názvy položek
 * v e-mailu zákazníkovi ze Slovenska, Polska, Německa nebo odjinud proto
 * přeloží Google (Cloud Translation API v2, „Basic"). Texty e-mailů samotné
 * jsou přeložené ručně (`email-locale.ts`, šablony) — strojově jdou jen názvy.
 *
 * Klíč: `GOOGLE_TRANSLATE_API_KEY` (Google Cloud → Cloud Translation API →
 * API klíč omezený na tuhle API). Bez klíče, při výpadku nebo pomalé odpovědi
 * zůstane český název — e-mail kvůli překladu nikdy nečeká déle než pár
 * sekund a nikdy nespadne.
 *
 * Kde se překlad bere:
 * - objednávka — `ensureOrderTitleTranslations` při potvrzení objednávky
 *   přeloží názvy jednou a uloží je na řádek (`item.metadata.title_<jazyk>`),
 *   takže všechny další e-maily k objednávce (odeslání, reklamace, faktura…)
 *   mají stejný název bez dalšího volání,
 * - košík, hlídání ceny a naskladnění — `translateTitles` před odesláním,
 * - všechno čte synchronní `localizedLineTitle` (`email-locale.ts`): řádek →
 *   paměť překladů → český název.
 */
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  emailLocaleOf,
  rememberTitleTranslation,
  cachedTitleTranslation,
  lineTitleKey,
  type EmailLocale,
} from "./email-locale"

const ENDPOINT = "https://translation.googleapis.com/language/translate/v2"
const TIMEOUT_MS = 4_000
/** Google bere nejvýš 128 textů v jednom požadavku. */
const BATCH = 100

/** Kód jazyka pro Google („cs" → nic, překládá se z češtiny). */
const googleTarget = (locale: EmailLocale): string | null => (locale === "cs" ? null : locale)

const decodeEntities = (text: string): string =>
  text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")

export const isTranslationConfigured = (): boolean =>
  Boolean(process.env.GOOGLE_TRANSLATE_API_KEY?.trim())

/**
 * Přeloží české názvy do jazyka e-mailu. Vrací mapu český → přeložený
 * (jen to, co se povedlo); co v ní není, zůstane česky. Nikdy nevyhodí.
 */
export const translateTitles = async (
  titles: ReadonlyArray<string | null | undefined>,
  locale: EmailLocale,
  fetchImpl: typeof fetch = fetch
): Promise<Map<string, string>> => {
  const result = new Map<string, string>()
  const target = googleTarget(locale)
  const key = process.env.GOOGLE_TRANSLATE_API_KEY?.trim()
  const unique = [...new Set(titles.map((t) => (t ?? "").trim()).filter(Boolean))]
  if (!target || !unique.length) return result

  const missing: string[] = []
  for (const title of unique) {
    const cached = cachedTitleTranslation(title, locale)
    if (cached) result.set(title, cached)
    else missing.push(title)
  }
  if (!key || !missing.length) return result

  for (let i = 0; i < missing.length; i += BATCH) {
    const chunk = missing.slice(i, i + BATCH)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const response = await fetchImpl(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: chunk, source: "cs", target, format: "text" }),
        signal: controller.signal,
      })
      if (!response.ok) continue
      const body = (await response.json()) as {
        data?: { translations?: Array<{ translatedText?: string }> }
      }
      const translations = body?.data?.translations ?? []
      chunk.forEach((title, index) => {
        const translated = decodeEntities(String(translations[index]?.translatedText ?? "")).trim()
        if (!translated) return
        rememberTitleTranslation(title, locale, translated)
        result.set(title, translated)
      })
    } catch {
      // Bez překladu — český název.
    } finally {
      clearTimeout(timer)
    }
  }
  return result
}

/**
 * Přeloží názvy položek objednávky do jejího jazyka a uloží je na řádky
 * (`metadata.title_<jazyk>`). U české objednávky, bez klíče nebo když už
 * všechny řádky překlad mají, neudělá nic. Nikdy nevyhodí.
 */
export const ensureOrderTitleTranslations = async (
  container: MedusaContainer,
  orderId: string
): Promise<void> => {
  if (!isTranslationConfigured() || !orderId) return
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "metadata",
        "shipping_address.country_code",
        "billing_address.country_code",
        "items.id",
        "items.title",
        "items.product_title",
        "items.metadata",
      ],
      filters: { id: orderId },
    })
    const order = (data as any[])[0]
    if (!order) return
    const locale = emailLocaleOf(order)
    const key = lineTitleKey(locale)
    if (!key) return

    const items = ((order.items ?? []) as any[]).filter((item) => {
      const czech = String(item?.product_title ?? item?.title ?? "").trim()
      const existing = item?.metadata?.[key]
      return czech && !(typeof existing === "string" && existing.trim())
    })
    if (!items.length) return

    const translations = await translateTitles(
      items.map((item) => item.product_title ?? item.title),
      locale
    )
    if (!translations.size) return

    const orderModule = container.resolve(Modules.ORDER) as any
    for (const item of items) {
      const czech = String(item.product_title ?? item.title ?? "").trim()
      const translated = translations.get(czech)
      if (!translated) continue
      await orderModule
        .updateOrderLineItems(item.id, {
          metadata: { ...(item.metadata ?? {}), [key]: translated },
        })
        .catch(() => undefined)
    }
  } catch (error) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .warn(`[translate] Názvy položek objednávky ${orderId} se nepřeložily: ${(error as Error)?.message ?? error}`)
  }
}
