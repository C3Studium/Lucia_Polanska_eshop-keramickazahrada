import { localizedLineTitle, type EmailLocale } from "../email-locale"
import {
  commissionLineOf,
  commissionTitleOf,
  commissionVariantSuffix,
  type CommissionLineOrderLike,
  type CommissionLineSource,
} from "./commission-line"

/**
 * Název zakázky v jazyce zákazníka (lib/email-locale) — do e-mailů a PDF.
 *
 * Česky je to `commissionTitleOf` beze změny (snímek `line_title`, jinak
 * název řádku). V jiném jazyce se překlad hledá u produktu řádku
 * (`items.product.metadata.title_xx` — dotaz si to pole musí vyžádat); snímek
 * `line_title` je český, takže se použije až jako záloha. Provedení se
 * připojí jako u snímku, kromě českého výchozího „Standardní" — v cizím
 * jazyce by nic neřeklo.
 */
export const localizedCommissionTitle = (
  order:
    | (CommissionLineOrderLike & {
        items?: Array<{ product?: { metadata?: Record<string, unknown> | null } | null } | null> | null
      })
    | null
    | undefined,
  productionOrder: CommissionLineSource | null | undefined,
  locale: EmailLocale | null | undefined
): string | null => {
  const czech = commissionTitleOf(order, productionOrder)
  if (!locale || locale === "cs") return czech
  const item = commissionLineOf(order, productionOrder) as any
  if (!item) return czech
  const translated = localizedLineTitle(item, locale)
  const czechProduct = String(item.product_title ?? item.title ?? "").trim()
  if (!translated || translated === czechProduct) return czech
  const variant = String(item.variant_title ?? "").trim()
  const suffix = /^(standardní|výchozí)$/i.test(variant) ? "" : commissionVariantSuffix(variant)
  return `${translated}${suffix}`
}
