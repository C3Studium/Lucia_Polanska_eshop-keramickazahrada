import { HttpTypes } from "@medusajs/types"
import { Table } from "@medusajs/ui"
import styles from "../styles/item.module.scss"

import LineItemOptions from "@modules/common/components/line-item-options"
import LineItemPrice from "@modules/common/components/line-item-price"
import LineItemUnitPrice from "@modules/common/components/line-item-unit-price"
import Thumbnail from "@modules/products/components/thumbnail"

type ItemProps = {
  item: HttpTypes.StoreCartLineItem | HttpTypes.StoreOrderLineItem
  currencyCode: string
}

const Item = ({ item, currencyCode }: ItemProps) => {
  return (
    <Table.Row className={styles.row} data-testid="product-row">
      <Table.Cell className={styles.cellThumb}>
        <div className={styles.thumbWrap}>
          <Thumbnail thumbnail={item.thumbnail} size="square" />
        </div>
      </Table.Cell>

      <Table.Cell className={styles.cellInfo}>
        <p className={styles.name} data-testid="product-name">
          {item.product_title}
        </p>
        <LineItemOptions variant={item.variant} data-testid="product-variant" />
        <div className={styles.dimensions}>
          {!!item.metadata?.width && <div>Šířka: {item.metadata.width as number}cm</div>}
          {!!item.metadata?.height && <div>Výška: {item.metadata.height as number}cm</div>}
        </div>
      </Table.Cell>

      <Table.Cell className={styles.cellPrice}>
        <span className={styles.priceWrap}>
          <span className={styles.unitWrap}>
            <span className={styles.quantity}>
              <span data-testid="product-quantity">{item.quantity}</span> ×{" "}
            </span>
            <LineItemUnitPrice
              item={item}
              style="tight"
              currencyCode={currencyCode}
            />
          </span>
          <div className={styles.divider} />
          <span className={styles.totalWrap}>
            <span className={styles.totalLabel}>
              Celkem: 
            </span>
            <LineItemPrice
              item={item}
              style="tight"
              currencyCode={currencyCode}
            />
          </span>
        </span>
      </Table.Cell>
    </Table.Row>
  )
}

export default Item
