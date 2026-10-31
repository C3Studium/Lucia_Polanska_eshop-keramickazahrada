"use client"
import repeat from "@lib/util/repeat"
import { HttpTypes } from "@medusajs/types"

import { Item } from "@modules/cart/components/item"
import PackagingLine, { packagingFor } from "@modules/common/components/packaging-line"
import { isPackagingLine, withPackagingUnderProducts } from "@lib/util/packaging"
import { giftVoucherLinesOf, voucherLineNeedsSetup } from "@lib/util/gift-voucher-setup"
import type { ProductionLeadTime } from "@lib/util/commission"
import SkeletonLineItem from "@modules/skeletons/components/skeleton-line-item"
import { useEditRerender } from "@lib/hooks/use-edit-rerender"
import { itemText } from "@lib/util/site-copy"
import type { CopyBlock } from "@lib/util/site-copy"
import { editableItem } from "@modules/common/components/cms-text"
import s from "./items.module.scss"

type ItemsTemplateProps = {
  cart?: HttpTypes.StoreCart
  /** Blok `kosik.vypis` — nadpis výpisu (`polozky.nadpis`) a popisek u počtu (`polozky.oboci`). */
  copy?: CopyBlock
  /** Záloha % a lhůta zakázkových položek z profilu výroby (pro štítek u položky). */
  madeToOrderTerms?: ProductionLeadTime[]
}

const ItemsTemplate = ({ cart, copy, madeToOrderTerms = [] }: ItemsTemplateProps) => {
  useEditRerender()
  const items = cart?.items

  /* Kotva `#nastaveni-poukazu` — zamčené tlačítko k pokladně i spodní lišta na
     ni odkazují. Dostane ji PRVNÍ nenastavený poukaz, protože právě k němu ten
     odkaz posílá; když je všechno nastavené, zůstane u prvního poukazu, ať
     odkaz (a návrat na starou adresu s `#`) někam vede. */
  const voucherLines = giftVoucherLinesOf(cart as never)
  const anchorLineId =
    (voucherLines.find((line) => voucherLineNeedsSetup(line, cart?.currency_code)) ??
      voucherLines[0])?.id ?? null

  return (
    <div className={s.root}>
      <div className={s.headerRow}>
        <h2 className={s.title} {...editableItem(copy, "polozky.nadpis")}>
          {itemText(copy, "polozky.nadpis", "Co máte v košíku")}
        </h2>
        {/* Popisek u počtu bez vlastního spanu (a tedy bez úpravy v místě):
            `.sectionMeta span` je kolečko s číslem. Mění se ve formuláři. */}
        <p className={s.sectionMeta}>
          <span>
            {String((items ?? []).filter((item) => !isPackagingLine(item)).length).padStart(2, "0")}
          </span>
          {itemText(copy, "polozky.oboci", "Z ateliéru")}
        </p>
      </div>
      <div className={s.tableBody} data-testid="items-table">
          {items
            ? withPackagingUnderProducts(
                items.sort((a, b) => {
                  return (a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1
                })
              )
                .map((item) => {
                  // Balné se ukazuje UVNITŘ karty výrobku (PackagingNote);
                  // samostatný řádek jen u balného bez výrobku v seznamu.
                  if (isPackagingLine(item)) {
                    if ((items ?? []).some((other) => !isPackagingLine(other) && packagingFor(items, other) === item)) {
                      return null
                    }
                    return (
                      <PackagingLine
                        key={item.id}
                        item={item}
                        currencyCode={cart?.currency_code}
                      />
                    )
                  }
                  return (
                    <Item
                      key={item.id}
                      item={item}
                      packaging={packagingFor(items, item)}
                      currencyCode={cart?.currency_code}
                      madeToOrderTerms={
                        madeToOrderTerms.find((lead) => lead.line_id === item.id) ?? null
                      }
                      voucherAnchor={Boolean(anchorLineId) && item.id === anchorLineId}
                    />
                  )
                })
            : repeat(5).map((i) => {
                return <SkeletonLineItem key={i} />
              })}
      </div>
    </div>
  )
}

export default ItemsTemplate
