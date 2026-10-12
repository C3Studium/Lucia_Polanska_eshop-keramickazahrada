import repeat from "@lib/util/repeat"
import { HttpTypes } from "@medusajs/types"
import { Table } from "@medusajs/ui"
import styles from "../styles/items.module.scss"

import Item from "@modules/order/components/item"
import PackagingLine, { packagingFor } from "@modules/common/components/packaging-line"
import { isPackagingLine, withPackagingUnderProducts } from "@lib/util/packaging"
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
          {withPackagingUnderProducts(
            items.sort((a, b) => {
              return (a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1
            })
          )
            .map((item) => {
              // Balné je uvnitř řádku výrobku; samostatně jen bez výrobku.
              if (isPackagingLine(item)) {
                if (items.some((other: any) => !isPackagingLine(other) && packagingFor(items, other) === item)) return null
                return (
                  <Table.Row key={item.id}>
                    {/* Nativní td: Table.Cell z @medusajs/ui colSpan netypuje. */}
                    <td colSpan={3} style={{ padding: 0 }}>
                      <PackagingLine item={item} currencyCode={order.currency_code} />
                    </td>
                  </Table.Row>
                )
              }
              return (
                <Item
                  key={item.id}
                  item={item}
                  packaging={packagingFor(items, item)}
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
