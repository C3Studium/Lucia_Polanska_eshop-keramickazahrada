"use client"
import repeat from "@lib/util/repeat"
import { HttpTypes } from "@medusajs/types"

import { Item } from "@modules/cart/components/item"
import SkeletonLineItem from "@modules/skeletons/components/skeleton-line-item"
import s from "./items.module.scss"

type ItemsTemplateProps = {
  cart?: HttpTypes.StoreCart
}

const ItemsTemplate = ({ cart }: ItemsTemplateProps) => {
  const items = cart?.items

  return (
    <div className={s.root}>
      <div className={s.headerRow}>
        <h2 className={s.title}>Vybrané kusy</h2>
        <p className={s.sectionMeta}>
          <span>{String(items?.length ?? 0).padStart(2, "0")}</span>
          Objekt z ateliéru
        </p>
      </div>
      <div className={s.tableBody} data-testid="items-table">
          {items
            ? items
                .sort((a, b) => {
                  return (a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1
                })
                .map((item) => {
                  return (
                    <Item
                      key={item.id}
                      item={item}
                      currencyCode={cart?.currency_code}
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
