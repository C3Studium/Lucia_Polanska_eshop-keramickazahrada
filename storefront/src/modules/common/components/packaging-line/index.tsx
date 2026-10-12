import { convertToLocale } from "@lib/util/money"
import { PACKAGING_TITLE } from "@lib/util/packaging"
import s from "./style.module.scss"

type PackagingLineItem = {
  id?: string
  quantity?: number | null
  total?: number | null
  unit_price?: number | null
}

const amountOf = (item: PackagingLineItem): number =>
  typeof item.total === "number"
    ? item.total
    : Number(item.unit_price ?? 0) * Number(item.quantity ?? 0)

/**
 * Balné výrobku (lib/util/packaging.ts) — PŘÍMO pod názvem a variantou
 * výrobku, uvnitř jeho karty: „Balné · 50,-". Matěj 12. 10.: samostatný
 * řádek pod kartou vypadal, jako by k výrobku nepatřil. Barvu dědí, takže
 * sedí na tmavém košíku i na světlé objednávce.
 */
export const PackagingNote = ({
  item,
  currencyCode,
  className,
  compact = false,
}: {
  item: PackagingLineItem | null | undefined
  currencyCode?: string | null
  className?: string
  /** Hustší — menší mezera a čára nad balným (rozbalovací košík). */
  compact?: boolean
}) => {
  if (!item) return null
  const quantity = Number(item.quantity ?? 0)
  const classes = [s.note, compact ? s.noteCompact : "", className ?? ""].filter(Boolean).join(" ")
  return (
    <p className={classes} data-testid="packaging-note">
      <span className={s.noteLabel}>
        {PACKAGING_TITLE}
        {quantity > 1 ? ` · ${quantity} ks` : ""}
      </span>
      <span className={s.notePrice}>
        {convertToLocale({ amount: amountOf(item), currency_code: currencyCode ?? "czk" })}
      </span>
    </p>
  )
}

/** Balné k řádku výrobku — podle varianty (`packaging_variant_id`). */
export const packagingFor = <T extends { metadata?: Record<string, unknown> | null; variant_id?: string | null; product_id?: string | null }>(
  items: T[] | null | undefined,
  item: { variant_id?: string | null }
): T | null =>
  (item.variant_id &&
    (items ?? []).find(
      (line) =>
        Boolean(line.metadata?.packaging_fee) &&
        !line.variant_id &&
        !line.product_id &&
        line.metadata?.packaging_variant_id === item.variant_id
    )) ||
  null

/**
 * Samostatný tenký řádek balného — jen záloha pro balné, které k žádnému
 * výrobku v seznamu nepatří (osiřelé). Běžně se balné ukazuje přes
 * `PackagingNote` uvnitř karty výrobku.
 */
const PackagingLine = ({
  item,
  currencyCode,
  compact = false,
}: {
  item: PackagingLineItem
  currencyCode?: string | null
  compact?: boolean
}) => {
  const quantity = Number(item.quantity ?? 0)
  return (
    <div className={compact ? `${s.root} ${s.compact}` : s.root} data-testid="packaging-row">
      <span className={s.label}>
        {PACKAGING_TITLE}
        {quantity > 1 ? <span className={s.quantity}> · {quantity} ks</span> : null}
      </span>
      <span className={s.price}>
        {convertToLocale({ amount: amountOf(item), currency_code: currencyCode ?? "czk" })}
      </span>
    </div>
  )
}

export default PackagingLine
