"use client"

import repeat from "@lib/util/repeat"
import { HttpTypes } from "@medusajs/types"

import { Item }from "@modules/cart/components/item"
import PackagingLine from "@modules/common/components/packaging-line"
import { isPackagingLine, withPackagingUnderProducts } from "@lib/util/packaging"
import SkeletonLineItem from "@modules/skeletons/components/skeleton-line-item"
import s from "./preview.module.scss"

type ItemsTemplateProps = {
  cart: HttpTypes.StoreCart
}


const ItemsPreviewTemplate = ({ cart }: ItemsTemplateProps) => {
  const items = cart.items
  const hasOverflow = items && items.length > 4

  return (
  <div className={hasOverflow ? s.scroll : s.root}>
      <div data-testid="items-table">
          {items
            ? withPackagingUnderProducts(
                items.sort((a, b) => {
                  return (a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1
                })
              )
                .map((item) => {
                  if (isPackagingLine(item)) {
                    return (
                      <PackagingLine
                        key={item.id}
                        item={item}
                        currencyCode={cart.currency_code}
                        compact
                      />
                    )
                  }
                  return (
                    <Item
                      key={item.id}
                      item={item}
                      type="preview"
                      currencyCode={cart.currency_code}
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

export default ItemsPreviewTemplate
