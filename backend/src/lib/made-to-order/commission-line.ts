import { isServiceLine } from "../packaging-lines"

/**
 * Položka objednávky, kterou zakázka vyrábí (LEGAL_AUDIT.md § 0c, Z-A) —
 * čisté, bez kontejneru. Nové zakázky ji znají přes `line_item_id`; legacy
 * zakázka (celá objednávka) spadne na první zakázkový řádek objednávky, jako
 * to dělaly e-maily dřív.
 *
 * Název má přednost ze snímku `line_title` na zakázce: řádek objednávky se
 * může úpravou odebrat (zrušená zakázka ve smíšené objednávce) a e-mail
 * i admin ho musí umět pojmenovat i potom.
 */

export type CommissionLineOrderLike = {
  items?: Array<{
    id?: string | null
    title?: string | null
    product_title?: string | null
    variant_title?: string | null
    thumbnail?: string | null
    variant_id?: string | null
    product_id?: string | null
    metadata?: Record<string, unknown> | null
  } | null> | null
}

export type CommissionLineSource = {
  line_item_id?: string | null
  line_title?: string | null
}

type OrderItem = NonNullable<NonNullable<CommissionLineOrderLike["items"]>[number]>

export const commissionLineOf = (
  order: CommissionLineOrderLike | null | undefined,
  productionOrder: CommissionLineSource | null | undefined
): OrderItem | null => {
  const items = ((order?.items ?? []) as Array<OrderItem | null>).filter(
    (item): item is OrderItem => Boolean(item) && !isServiceLine(item)
  )
  if (productionOrder?.line_item_id) {
    return items.find((item) => item.id === productionOrder.line_item_id) ?? null
  }
  return (
    items.find((item) => Boolean((item.metadata as any)?.made_to_order)) ??
    items[0] ??
    null
  )
}

/** Název položky zakázky (bez balného) — do e-mailů, upozornění a PDF. */
export const commissionTitleOf = (
  order: CommissionLineOrderLike | null | undefined,
  productionOrder: CommissionLineSource | null | undefined
): string | null => {
  const snapshot = typeof productionOrder?.line_title === "string" ? productionOrder.line_title.trim() : ""
  if (snapshot) return snapshot
  const item = commissionLineOf(order, productionOrder)
  return (item?.product_title as string) || (item?.title as string) || null
}

/** Obrázek objednaného produktu zakázky (ne fotka od zákazníka). */
export const commissionImageOf = (
  order: CommissionLineOrderLike | null | undefined,
  productionOrder: CommissionLineSource | null | undefined
): string | null => {
  const item = commissionLineOf(order, productionOrder)
  return (item?.thumbnail as string) || null
}

/** „Domovní číslo — Modrá glazura", bez výchozího názvu varianty. */
export const commissionVariantSuffix = (variantTitle: unknown): string => {
  const title = typeof variantTitle === "string" ? variantTitle.trim() : ""
  return !title || /^default( variant| title)?$/i.test(title) ? "" : ` — ${title}`
}
