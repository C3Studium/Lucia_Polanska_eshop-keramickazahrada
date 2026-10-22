"use client"

import {
  clearanceInfo,
  discountFromReference,
  getProductPrice,
} from "@lib/util/get-product-price"
import { convertToLocale } from "@lib/util/money"
import { isPriceOnRequest } from "@lib/util/price-on-request"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import styles from "./style.module.scss"
import { usePriceReference } from "./use-price-reference"

/**
 * Cena na stránce výrobku.
 *
 * ## Sleva (price-list typu „sale") — § 12a ZOS
 *
 * Procento i srovnávací cena se počítají z NEJNIŽŠÍ CENY ZA 30 DNÍ PŘED
 * SLEVOU (historie cen v backendu, `usePriceReference`), ne z běžné ceny.
 * - reference je → „−X %" a věta „Nejnižší cena za 30 dní před slevou: …"
 *   (když historie celých 30 dní nepokrývá: „Nejnižší cena před slevou: …"
 *   s poznámkou — pravdivě, bez tvrzení o 30 dnech);
 * - aktuální cena pod referencí není → žádná sleva se neukazuje;
 * - backend reference nedal → JEN aktuální cena, bez štítku „Sleva" i bez
 *   procenta: samotný štítek by byl oznámením slevy bez předchozí ceny,
 *   a to § 12a ZOS nedovoluje;
 * - než reference dorazí, cena se ukazuje bez slevových údajů.
 *
 * ## Kus s vadou („Poškozené")
 *
 * Jeho cena není sleva, ale cena kusu s vadou — žádné přeškrtnutí, žádné
 * procento, jen „Cena kusu s uvedenou vadou". Popis vady stojí hned nad
 * cenou v rámečku „Poškození" (`details.tsx`), proto se tu neopakuje.
 * Pod tím věta, že odstoupit do 14 dnů jde i u kusu s vadou (§ 1829 OZ),
 * jen vadu, kvůli které je levnější, nelze reklamovat (§ 2167 písm. a) OZ).
 */

const formatAmount = (amount: number, currencyCode: string) =>
  String(convertToLocale({ amount, currency_code: currencyCode }))
    .replace(/czk/i, "")
    .trim()

/**
 * Cena balení výrobku v Kč — totéž čtení jako `packagingPriceCzkOf`
 * v backendu (`lib/packaging.ts`), podle kterého server balné účtuje:
 * nevyplněná nebo nesmyslná = 0.
 */
const packagingPriceCzk = (product: HttpTypes.StoreProduct): number => {
  const raw = (product.metadata as Record<string, unknown> | null | undefined)?.packaging_price
  if (raw === null || raw === undefined || raw === "") return 0
  const parsed = typeof raw === "number" ? raw : Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : 0
}

export default function ProductPrice({
  product,
  variant,
  className,
}: {
  product: HttpTypes.StoreProduct
  variant?: HttpTypes.StoreProductVariant
  className?: string
  countryCode: string
}) {
  const { cheapestPrice, variantPrice } = getProductPrice({
    product,
    variantId: variant?.id,
  })

  const selectedPrice = variant ? variantPrice : cheapestPrice
  const calculatedPrice = selectedPrice?.calculated_price
  /* „Cena po domluvě" přebije i cenu, která u variant zůstala — prodává se
     až po poptávce (lib/util/price-on-request). */
  const priceOnRequest = isPriceOnRequest(product.metadata)
  const hasPrice = !priceOnRequest && calculatedPrice != null
  const isSale = selectedPrice?.price_type === "sale"
  const currencyCode = selectedPrice?.currency_code ?? "czk"
  const clearance = clearanceInfo(product)

  const reference = usePriceReference(
    isSale ? selectedPrice?.variant_id : undefined,
    currencyCode
  )
  const lowest =
    reference.status === "ready" ? reference.reference.lowest_30d : null
  const percent = isSale
    ? discountFromReference(selectedPrice?.calculated_price_number, lowest)
    : null

  const showReference = isSale && percent != null && lowest != null
  const saleStyled = showReference
  const packaging = packagingPriceCzk(product)

  return (
    <div className="product__details__cta__price">
      <p>Cena |</p>
      <div className="product__details__cta__price__main">
        <span
          className={[
            "product__priceCurrent",
            saleStyled ? "product__priceCurrent--sale" : "",
            !hasPrice ? "product__priceUnavailable" : "",
            className ?? "",
          ].filter(Boolean).join(" ")}
          data-testid="product-price"
          data-value={selectedPrice?.calculated_price_number}
        >
          {hasPrice
            ? String(calculatedPrice).replace(/czk/i, "").trim()
            : priceOnRequest
              ? "Cena po domluvě"
              : "Cena na dotaz"}
        </span>

        {showReference && (
          <>
            <span className="product__priceDiscount">−{percent} %</span>
            <p className={styles.line} data-testid="price-reference">
              <span className="product__priceOriginalLabel">
                {reference.status === "ready" && reference.reference.complete
                  ? "Nejnižší cena za 30 dní před slevou: "
                  : "Nejnižší cena před slevou: "}
              </span>
              <span className={styles.amount} data-value={lowest}>
                {formatAmount(lowest!, currencyCode)}
              </span>
              {reference.status === "ready" && !reference.reference.complete && (
                <span className={styles.note}>
                  Záznam cen za celých 30 dní před slevou nemáme.
                </span>
              )}
            </p>
          </>
        )}

        {clearance && hasPrice && (
          <p className={styles.line} data-testid="clearance-price-note">
            {clearance.damage
              ? "Cena kusu s uvedenou vadou"
              : "Cena kusu s vadou"}
            <span className={styles.note} data-testid="clearance-withdrawal-note">
              I kus s vadou můžete do 14 dnů od převzetí{" "}
              <LocalizedClientLink href="/odstoupeni-od-smlouvy">vrátit</LocalizedClientLink>;
              vadu, kvůli které je levnější, ale reklamovat nelze.
            </span>
          </p>
        )}

        {/* Balné u ceny (§ 1811 odst. 2 OZ, § 12 ZOS — cena včetně všech
            poplatků): ne až v košíku. Částka je ta, kterou server účtuje
            jako položku „Balné" pod výrobkem; v cizí měně ji přepočítá
            kurzem ČNB, proto se tu uvádí v Kč. */}
        {hasPrice && (
          <p className={styles.line} data-testid="product-packaging-price">
            {packaging > 0 ? (
              <>
                + balné{" "}
                <span className={styles.amount} data-value={packaging}>
                  {currencyCode.toLowerCase() === "czk"
                    ? formatAmount(packaging, "czk")
                    : `${packaging.toLocaleString("cs-CZ")} Kč`}
                </span>{" "}
                za kus
                <span className={styles.note}>
                  Cena balení je u každého výrobku jiná a účtuje se zvlášť
                  {currencyCode.toLowerCase() === "czk"
                    ? "."
                    : " — v eurech ji přepočteme kurzem ČNB."}
                </span>
              </>
            ) : (
              "Balné u tohoto výrobku neúčtujeme."
            )}
          </p>
        )}
      </div>
    </div>
  )
}
