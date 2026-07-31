import repeat from "@lib/util/repeat"
import { HttpTypes } from "@medusajs/types"
import { Table } from "@medusajs/ui"
import styles from "../styles/items.module.scss"

import Item from "@modules/order/components/item"
import SkeletonLineItem from "@modules/skeletons/components/skeleton-line-item"

type ItemsProps = {
  order: HttpTypes.StoreOrder
}

const Items = ({ order }: ItemsProps) => {
  const items = order.items

  if (!items?.length) {
    return (
      <div className={styles.root} data-testid="products-table">
        {repeat(5).map((i) => (
          <SkeletonLineItem key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <Table>
        <Table.Body data-testid="products-table">
          {items
            .sort((a, b) => {
              return (a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1
            })
            .map((item) => {
              return (
                <Item
                  key={item.id}
                  item={item}
                  currencyCode={order.currency_code}
                />
              )
            })}
        </Table.Body>
      </Table>
    </div>
  )
}

export default Items
