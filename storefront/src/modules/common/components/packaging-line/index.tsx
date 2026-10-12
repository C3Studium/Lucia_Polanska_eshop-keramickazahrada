import { convertToLocale } from "@lib/util/money"
import { PACKAGING_TITLE } from "@lib/util/packaging"
import s from "./style.module.scss"

type PackagingLineProps = {
  item: {
    id?: string
    quantity?: number | null
    total?: number | null
    unit_price?: number | null
  }
  currencyCode?: string | null
  /** Hustší řádek (souhrn pokladny, rozbalovací košík). */
  compact?: boolean
}

/**
 * Balné pod výrobkem (lib/util/packaging.ts) — tenký podřízený řádek bez
 * fotky a bez ovládání: počet kusů jde s výrobkem, zákazník ho sám nemění.
 * Barvu dědí, takže sedí na tmavém košíku i na světlé stránce objednávky.
 */
const PackagingLine = ({ item, currencyCode, compact = false }: PackagingLineProps) => {
  const quantity = Number(item.quantity ?? 0)
  const amount =
    typeof item.total === "number" ? item.total : Number(item.unit_price ?? 0) * quantity
  return (
    <div
      className={compact ? `${s.root} ${s.compact}` : s.root}
      data-testid="packaging-row"
    >
      <span className={s.label}>
        {PACKAGING_TITLE}
        {quantity > 1 ? <span className={s.quantity}> · {quantity} ks</span> : null}
      </span>
      <span className={s.price}>
        {convertToLocale({ amount, currency_code: currencyCode ?? "czk" })}
      </span>
    </div>
  )
}

export default PackagingLine
