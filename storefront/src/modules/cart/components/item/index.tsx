"use client"

import { Divider, clx } from "@medusajs/ui"
import { updateLineItem } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import { maxPurchasableQuantity } from "@lib/util/availability"
import { isDobirkaFeeLine } from "@lib/util/dobirka"
import { isMadeToOrderLine, type ProductionLeadTime } from "@lib/util/commission"
import { madeToOrderBadgeText } from "@lib/util/made-to-order"
import { isPackagingLine } from "@lib/util/packaging"
import { LEGAL_LINKS } from "@modules/checkout/components/legal-consent/labels"
import PackagingLine, { PackagingNote } from "@modules/common/components/packaging-line"
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
import { convertToLocale } from "@lib/util/money"
import s from "./style.module.scss"

type ItemProps = {
  item: HttpTypes.StoreCartLineItem
  type?: "full" | "preview"
  currencyCode: string
  isMobile?: boolean
  /** Balné tohoto výrobku (lib/util/packaging.ts) — ukáže se pod variantou. */
  packaging?: HttpTypes.StoreCartLineItem | null
  /**
   * Záloha % a lhůta zakázky z profilu výroby (košík je načte serverem). Bez
   * nich — náhled v pokladně, zakázka jen kategorií — zůstane krátký štítek.
   */
  madeToOrderTerms?: ProductionLeadTime | null
}

const Item = ({
  item,
  type = "full",
  currencyCode,
  packaging = null,
  madeToOrderTerms = null,
}: ItemProps) => {
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const changeQuantity = async (quantity: number) => {
    setError(null)
    setUpdating(true)
    await updateLineItem({ lineId: item.id, quantity })
      .catch((err) => setError(err.message))
      .finally(() => setUpdating(false))
  }

  // Was a literal 10 on both branches, so a one-of-a-kind piece could be set to 10 and only
  // failed at the backend — the worst possible place to learn it (spec §4).
  const maxQuantity = maxPurchasableQuantity(item.variant, 10)
  const quantityLimit = Math.min(maxQuantity, 10)

  /* Zakázka (audit § 0): štítek „Na zakázku · záloha N % · výroba do N dnů ·
     nelze vrátit do 14 dnů" pod názvem — tatáž slova jako u ceny na stránce
     produktu; co profil nedá, se vynechá. Odkaz vede na článek OP. */
  const madeToOrder = isMadeToOrderLine(item as any)
  const madeToOrderLabel = madeToOrder
    ? madeToOrderBadgeText({
        depositPercentage: madeToOrderTerms?.deposit_percentage,
        maxDays: madeToOrderTerms?.production_time_max_days,
      })
    : null

  /*
   * Doběrečné — a fee, not a product. No photo, no product link, no quantity
   * stepper and no „Odebrat": it belongs to the dobírka payment choice and
   * the backend refuses to edit it directly. Choosing another payment removes
   * it, and the note says exactly that.
   */
  // Balné (lib/util/packaging.ts) jde s výrobkem — tenký řádek, bez ovládání.
  if (isPackagingLine(item)) {
    return <PackagingLine item={item} currencyCode={currencyCode} compact={type === "preview"} />
  }

  if (isDobirkaFeeLine(item)) {
    return (
      <article
        className={clx(s.row, type === "preview" && s.previewRow)}
        data-testid="dobirka-fee-row"
      >
        <div className={s.cellTitle}>
          <p className={s.kicker}>K platbě na dobírku</p>
          <h3 className={s.title}>{item.title}</h3>
          <div className={s.options}>
            <p>Poplatek za dobírku — zmizí, když zvolíte jiný způsob platby.</p>
          </div>
        </div>
        <div className={s.cellPrice}>
          <span className={s.priceWrap}>
            {type === "full" && <span className={s.controlLabel}>Celkem</span>}
            <LineItemPrice item={item} style="tight" currencyCode={currencyCode} />
          </span>
        </div>
      </article>
    )
  }

  return (
    <article
      className={clx(s.row, type === "preview" && s.previewRow)}
      data-testid="product-row"
    >
      <div className={s.cellThumb}>
        <LocalizedClientLink
          href={`/products/${item.product_handle}`}
          className={s.thumbLink}
          aria-label={item.product_title || item.title || "Detail produktu"}
        >
          <Thumbnail
            thumbnail={item.thumbnail}
            images={item.variant?.product?.images}
            size="square"
          />
          {type === "full" && <span className={s.imageIndex} aria-hidden="true">01</span>}
        </LocalizedClientLink>
      </div>

      <div className={s.cellTitle}>
        <p className={s.kicker}>{madeToOrder ? "Na zakázku" : "Z ateliéru"}</p>
        <LocalizedClientLink href={`/products/${item.product_handle}`}>
          <h3 className={s.title} data-testid="product-title">
            {item.product_title}
          </h3>
        </LocalizedClientLink>
        <div className={s.options}>
          <LineItemOptions variant={item.variant} data-testid="product-variant" />
        </div>
        {madeToOrderLabel && (
          <LocalizedClientLink
            href={LEGAL_LINKS.termsMadeToOrder}
            className={s.madeToOrder}
            target="_blank"
            rel="noopener"
            data-testid="cart-made-to-order-badge"
          >
            {madeToOrderLabel}
          </LocalizedClientLink>
        )}
        <div className={s.dimensions}>
          {!!item.metadata?.width && <span>Šířka · {item.metadata.width as number} cm</span>}
          {!!item.metadata?.height && <span>Výška · {item.metadata.height as number} cm</span>}
        </div>
        {/* Balné patří k výrobku — v košíku přímo pod názvem a variantou;
            v souhrnu pokladny (náhled) je v ceníku vpravo. */}
        {type === "full" && <PackagingNote item={packaging} currencyCode={currencyCode} />}

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
          {/* Ovladač a „Odebrat“ na jedné lince — do 150px sloupce se vejdou
              jen v menší velikosti a s tlačítkem bez popisku (`compact`). */}
          <div className={s.actionsLine}>
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
              className={s.removeCompact}
              data-testid="product-delete-button"
              bundle_id={item.metadata?.bundle_id as string}
            >
              {item.metadata?.bundle_id !== undefined
                ? "Odebrat balíček"
                : "Odebrat"}
            </DeleteButton>
          </div>
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
              {/* Balné hned pod cenou výrobku (Matěj 12. 10.): „Balné 1× 40,-". */}
              {packaging && (
                <span className={s.previewQtyRow} data-testid="packaging-note">
                  <span className={s.muted}>Balné {Number(packaging.quantity ?? 0)}×</span>
                  <span>
                    {convertToLocale({
                      amount: Number(packaging.unit_price ?? 0),
                      currency_code: currencyCode,
                    })}
                  </span>
                </span>
              )}
              <Divider />
            </>
          )}
          {type === "full" && <span className={s.controlLabel}>Celkem</span>}
          {type === "preview" && packaging ? (
            // Součet výrobku i jeho balného — to, co za řádek zákazník platí.
            <span className={s.previewTotal}>
              {convertToLocale({
                amount:
                  Number(item.total ?? 0) +
                  Number(packaging.unit_price ?? 0) * Number(packaging.quantity ?? 0),
                currency_code: currencyCode,
              })}
            </span>
          ) : (
            <LineItemPrice item={item} style="tight" currencyCode={currencyCode} />
          )}
        </span>
      </div>
    </article>
  )
}

export { Item }
