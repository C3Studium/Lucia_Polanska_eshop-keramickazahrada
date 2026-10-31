"use client"

import { Divider, clx } from "@medusajs/ui"
import { updateLineItem } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import { maxPurchasableQuantity } from "@lib/util/availability"
import { isDobirkaFeeLine } from "@lib/util/dobirka"
import { isMadeToOrderLine, type ProductionLeadTime } from "@lib/util/commission"
import { madeToOrderBadgeText } from "@lib/util/made-to-order"
import { isPriceOnRequestLine } from "@lib/util/price-on-request"
import { isPackagingLine } from "@lib/util/packaging"
import { GiftVoucherLineSetup } from "../gift-voucher-setup"
import { voucherLineSummary } from "@lib/util/gift-voucher-code"
import { isGiftVoucherProductLine } from "@lib/util/gift-voucher-setup"
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
  /*
   * Zakázka je VŽDY jeden kus na řádek (31. 10. 2026).
   *
   * Každý kus má vlastní zadání, vlastní domluvenou cenu i vlastní zálohu —
   * dva kusy na jednom řádku by sdílely jednu cenu pro oba, což u výroby na
   * míru nedává smysl. Košík proto u zakázky množství nezvedá; další kus se
   * přidává ze stránky výrobku a vznikne z něj samostatný řádek
   * (`workflows/custom-add-to-cart.ts`).
   */
  const quantityLimit = isMadeToOrderLine(item as any)
    ? 1
    : Math.min(maxQuantity, 10)

  /* Zakázka (audit § 0): štítek „Na zakázku · záloha N % · výroba do N dnů ·
     bez 14denní lhůty na vrácení" pod názvem — tatáž slova jako u ceny na
     stránce produktu; co profil nedá, se vynechá. Odkaz vede na článek OP.
     U ceny po domluvě se procento vynechá vždycky: záloha se počítá až
     z ceny, kterou Lucie pošle e-mailem. */
  const madeToOrder = isMadeToOrderLine(item as any)
  const voucherSummary = voucherLineSummary(
    item.metadata as Record<string, unknown> | null
  )
  /* Poukaz se nastavuje až v košíku, pod souhrnem — dokud to zákazník
     neudělá, řádek stojí 0 a nikam dál to nepustí. Ať je to vidět přímo
     u položky, ne až u zamčeného tlačítka. */
  const voucherTodo = !voucherSummary && isGiftVoucherProductLine(item as never)
  const madeToOrderLabel = madeToOrder
    ? madeToOrderBadgeText({
        depositPercentage: madeToOrderTerms?.deposit_percentage,
        maxDays: madeToOrderTerms?.production_time_max_days,
        priceOnRequest: isPriceOnRequestLine(item as never),
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
          {/* Dárkový poukaz: podoba a obdarovaný z formuláře na stránce
              produktu. U variant, ne v rozměrech — ty náhled v pokladně skrývá. */}
          {voucherSummary && (
            <span className={s.voucherSummary} data-testid="cart-gift-voucher-summary">
              {voucherSummary}
            </span>
          )}
          {voucherTodo && (
            <span className={s.voucherTodo} data-testid="cart-gift-voucher-todo">
              Zatím nenastavený — hodnotu a podobu zvolte níž
            </span>
          )}
        </div>

        {/* Nastavení poukazu rovnou pod jeho řádkem (31. 10. 2026): hodnota,
            podoba, pro koho a věnování. Dřív stálo v pravém sloupci pod
            souhrnem, kde se do úzkého lepkavého bloku nevešlo — a k souhrnu
            stejně nepatřilo. V náhledu (pokladna) se nekreslí. */}
        {type !== "preview" && isGiftVoucherProductLine(item as never) && (
          <GiftVoucherLineSetup
            line={item as never}
            currencyCode={currencyCode}
          />
        )}
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
