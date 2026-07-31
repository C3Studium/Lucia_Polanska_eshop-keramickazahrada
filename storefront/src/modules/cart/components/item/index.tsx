"use client"

import { Divider, clx } from "@medusajs/ui"
import { updateLineItem } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import CartQuantityStepper from "@modules/cart/components/cart-quantity-stepper"
import ErrorMessage from "@modules/checkout/components/error-message"
import DeleteButton from "@modules/common/components/delete-button"
import LineItemOptions from "@modules/common/components/line-item-options"
import LineItemPrice from "@modules/common/components/line-item-price"
import LineItemUnitPrice from "@modules/common/components/line-item-unit-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Spinner from "@modules/common/icons/spinner"
import Thumbnail from "@modules/products/components/thumbnail"
import { useState } from "react"
import s from "./style.module.scss"

type ItemProps = {
  item: HttpTypes.StoreCartLineItem
  type?: "full" | "preview"
  currencyCode: string
  isMobile?: boolean
}

const Item = ({ item, type = "full", currencyCode }: ItemProps) => {
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const changeQuantity = async (quantity: number) => {
    setError(null)
    setUpdating(true)
    await updateLineItem({ lineId: item.id, quantity })
      .catch((err) => setError(err.message))
      .finally(() => setUpdating(false))
  }

  const maxQtyFromInventory = 10
  const maxQuantity = item.variant?.manage_inventory ? 10 : maxQtyFromInventory
  const quantityLimit = Math.min(maxQuantity, 10)

  return (
    <article
      className={clx(s.row, type === "preview" && s.previewRow)}
      data-testid="product-row"
    >
      <div className={s.cellThumb}>
        <LocalizedClientLink
          href={`/products/${item.product_handle}`}
          className={s.thumbLink}
        >
          <Thumbnail
            thumbnail={item.thumbnail}
            images={item.variant?.product?.images}
            size="square"
          />
          {type === "full" && <span className={s.imageIndex}>Objekt · 01</span>}
        </LocalizedClientLink>
      </div>

      <div className={s.cellTitle}>
        <p className={s.kicker}>Ateliérový objekt</p>
        <LocalizedClientLink href={`/products/${item.product_handle}`}>
          <h3 className={s.title} data-testid="product-title">
            {item.product_title}
          </h3>
        </LocalizedClientLink>
        <div className={s.options}>
          <LineItemOptions variant={item.variant} data-testid="product-variant" />
        </div>
        <div className={s.dimensions}>
          {!!item.metadata?.width && <span>Šířka · {item.metadata.width as number} cm</span>}
          {!!item.metadata?.height && <span>Výška · {item.metadata.height as number} cm</span>}
        </div>

        {type === "full" && (
          <div className={s.mobileControls}>
            <CartQuantityStepper
              value={item.quantity}
              max={quantityLimit}
              disabled={updating}
              onChange={changeQuantity}
              data-testid="product-select-button"
            />
            <LineItemPrice item={item} style="tight" currencyCode={currencyCode} />
            <DeleteButton
              id={item.id}
              data-testid="product-delete-button"
              bundle_id={item.metadata?.bundle_id as string}
            >
              Odebrat
            </DeleteButton>
            {updating && <Spinner />}
          </div>
        )}
      </div>

      {type === "full" && (
        <div className={s.cellActions}>
          <span className={s.controlLabel}>Množství</span>
          <div className={s.actionsRow}>
            <CartQuantityStepper
              value={item.quantity}
              max={quantityLimit}
              disabled={updating}
              onChange={changeQuantity}
              data-testid="product-select-button"
            />
            {updating && <Spinner />}
          </div>
          <DeleteButton
            id={item.id}
            data-testid="product-delete-button"
            bundle_id={item.metadata?.bundle_id as string}
          >
            {item.metadata?.bundle_id !== undefined ? "Odebrat balíček" : "Odebrat"}
          </DeleteButton>
          <ErrorMessage error={error} data-testid="product-error-message" />
        </div>
      )}

      {type === "full" && (
        <div className={s.cellUnit}>
          <span className={s.controlLabel}>Cena za kus</span>
          <LineItemUnitPrice item={item} style="tight" currencyCode={currencyCode} />
        </div>
      )}

      <div className={s.cellPrice}>
        <span className={s.priceWrap}>
          {type === "preview" && (
            <>
              <span className={s.previewQtyRow}>
                <span className={s.muted}>
                  <span data-testid="product-quantity">{item.quantity}</span>×
                </span>
                <LineItemUnitPrice item={item} style="tight" currencyCode={currencyCode} />
              </span>
              <Divider />
            </>
          )}
          {type === "full" && <span className={s.controlLabel}>Celkem</span>}
          <LineItemPrice item={item} style="tight" currencyCode={currencyCode} />
        </span>
      </div>
    </article>
  )
}

export { Item }
