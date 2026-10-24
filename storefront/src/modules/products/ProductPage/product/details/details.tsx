"use client"

import ProductOptions from "./Options/ProductOptions"
import MadeToOrderPanel from "@modules/products/components/made-to-order"
import {
  MadeToOrderAddNotice,
  MadeToOrderBadge,
  MadeToOrderSteps,
} from "@modules/products/components/made-to-order-notice"
import SafetyNotice from "@modules/products/components/safety-notice"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import VoucherAmountField, {
  checkVoucherAmount,
  isCustomAmountVoucher,
  voucherConfig,
} from "@modules/products/components/voucher-amount"
import GiftVoucherForm, {
  EMPTY_GIFT_VOUCHER_FORM,
  giftVoucherFormError,
  voucherLineMetadata,
  type GiftVoucherFormValue,
} from "@modules/products/components/gift-voucher-form"
import { isGiftVoucherProduct } from "@lib/util/gift-voucher-code"
import {
  depositPercentageFor,
  madeToOrderMetadata,
  productionMaxDaysFor,
  type ProductionProfile,
} from "@lib/util/made-to-order"
import {
  availabilityLabel,
  isPurchasable,
  maxPurchasableQuantity,
  variantAvailability,
} from "@lib/util/availability"
import { backorderWaitNote } from "@lib/util/backorder"
import { COMMISSION_CATEGORY_HANDLE } from "@lib/util/commission"
import { DOBIRKA_COUNTRIES, productAllowsDobirka } from "@lib/util/dobirka"
import { addToCart } from "@lib/data/cart"
import { toCzechErrorMessage } from "@lib/util/error-messages"
import type { AddToCartState } from "./Cta/Add"
import { BundleProduct } from "@lib/data/products"
import { scrollWithLenis } from "@lib/helpers/scrollWithLenis"
import { HttpTypes } from "@medusajs/types"
import type { CopyBlock } from "@lib/util/site-copy"
import { itemText } from "@lib/util/site-copy"
import { useEditRerender } from "@lib/hooks/use-edit-rerender"
import { editableItem } from "@modules/common/components/cms-text"
import Details from "@modules/products/ProductPage/details"
import RestockForm from "@modules/products/ProductPage/restock"
import BundleActions from "@modules/products/components/bundle-actions"
import { isEqual } from "lodash"
import { motion } from "framer-motion"
import { useEffect, useMemo, useRef, useState } from "react"
import Gallery from "../Gallery/gallery"
import CTA from "./Cta/Add"
import ProductPrice from "./Cta/Price"
import { inquiryHref, isPriceOnRequest } from "@lib/util/price-on-request"

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  categories?: HttpTypes.StoreProductCategory[]
  wishlistItems?: any[]
  isAuthenticated?: boolean
  /** The account has at least one saved address — „Koupit ihned" needs it. */
  hasSavedAddress?: boolean
  initialRating?: number
  initialCount?: number
  bundle?: BundleProduct
  isBundlePreview?: boolean
  productionProfile?: ProductionProfile | null
  /** Režim výběru do úpravy objednávky — viz `ProductPickMode`. */
  pick?: ProductPickMode
  /** Blok `global.produkt` — jde dál do detailů, galerie a hlídání naskladnění. */
  texts?: CopyBlock
}

/**
 * Režim výběru — stránka produktu jako „mini stránka" uvnitř úpravy
 * objednávky (`/order/:id/edit/pridat/:handle`). Výběr provedení a počtu
 * zůstává, ale košík, oblíbené, „Koupit ihned" a hlídání naskladnění zmizí;
 * tlačítko místo „Do košíku" zavolá `onPick` („Přidat k objednávce #N").
 * Do skutečného košíku se nesahá.
 */
export type ProductPickMode = {
  /** Text tlačítka — „Přidat k objednávce #39" / „Vyměnit za tento výrobek". */
  label: string
  /** Varianty, které server dovolí (`allowed[product.id]`). Ostatní provedení
      jdou vybrat, ale tlačítko u nich řekne, že nejdou. */
  allowedVariantIds: string[]
  /** Strop počtu kusů (kontrakt `add`: 1–20). */
  maxQuantity: number
  /** Pevný počet kusů — výměna řádku za jiný výrobek (§3d.10) přebírá počet
      řádku, stepper se proto nezobrazí. */
  fixedQuantity?: number
  /** Věta pod tlačítkem („Vyměníme 2 ks …"). */
  note?: string
  /** Věta k provedení, které server nedovolí. */
  blockedText?: string
  onPick: (
    variant: HttpTypes.StoreProductVariant,
    quantity: number
  ) => { ok: true } | { ok: false; message: string }
}

const optionsAsKeymap = (
  variantOptions: HttpTypes.StoreProductVariant["options"]
) =>
  variantOptions?.reduce((acc: Record<string, string>, option: any) => {
    acc[option.option_id] = option.value
    return acc
  }, {}) ?? {}

const ProductDetails: React.FC<ProductTemplateProps> = ({
  product,
  region,
  countryCode,
  categories,
  wishlistItems,
  isAuthenticated,
  hasSavedAddress = false,
  initialRating = 0,
  initialCount = 0,
  bundle,
  isBundlePreview = false,
  productionProfile,
  pick,
  texts,
}) => {
  /* Bez výběru provedení se panel nákupu po zapnutí editace sám nepřekreslí
     a texty z `global.produkt` by zůstaly bez anotací. Viz hook. */
  useEditRerender()
  const [options, setOptions] = useState<Record<string, string | undefined>>({})
  const [addState, setAddState] = useState<AddToCartState>({ kind: "idle" })
  const [quantity, setQuantity] = useState(1)

  // V režimu výběru se zakázka nenabízí (server ji do `allowed` nedá), takže
  // panel zakázky ani „zakázkový" košík tu nemají co dělat.
  const isMadeToOrder = !pick && Boolean(productionProfile?.enabled)
  /* Zakázka has two signals — the catalogue category today, the production
     profile once profiles are filled in. Either one counts (they do not
     overlap yet), so the category alone must also keep „Koupit ihned" away. */
  const isCommissionCategory = (categories ?? []).some(
    (category) => category.handle === COMMISSION_CATEGORY_HANDLE
  )
  const resetTimer = useRef<number | undefined>(undefined)
  const isAdding = addState.kind === "adding"

  // The confirmation is temporary; clear it if the customer leaves the page first.
  useEffect(() => () => window.clearTimeout(resetTimer.current), [])

  /* Předvybrané provedení: první varianta — v režimu výběru první, kterou jde
     k objednávce přidat, ať tlačítko nezačíná zamčené. */
  const pickAllowed = pick?.allowedVariantIds
  useEffect(() => {
    const firstVariant =
      (pickAllowed &&
        product.variants?.find((variant) => pickAllowed.includes(variant.id))) ||
      product.variants?.[0]
    if (firstVariant) setOptions(optionsAsKeymap(firstVariant.options))
  }, [product.variants, pickAllowed])

  const selectedVariant = useMemo(() => {
    return product.variants?.find((variant) =>
      isEqual(optionsAsKeymap(variant.options), options)
    )
  }, [product.variants, options])

  const isValidVariant = useMemo(
    () =>
      !!product.variants?.some((variant) =>
        isEqual(optionsAsKeymap(variant.options), options)
      ),
    [product.variants, options]
  )

  /* Per-variant photos and note ride on variant metadata — the admin's
     „Varianty a ceny" writes them, this is the only place that reads them. */
  const variantMeta = (selectedVariant?.metadata ?? null) as Record<
    string,
    unknown
  > | null
  const variantPhotos = Array.isArray(variantMeta?.images)
    ? (variantMeta.images as unknown[]).filter(
        (url): url is string => typeof url === "string"
      )
    : []
  const variantNote =
    typeof variantMeta?.note === "string" ? variantMeta.note.trim() : ""

  /* Poškozený kus: popis poškození se drží na produktu (metadata), zakládá ho
     flow „Výprodej / poškozený kus". Ukazuje se zákazníkovi, aby věděl, co
     kupuje — jeden konkrétní kus s touhle vadou. */
  const productMeta = (product.metadata ?? null) as Record<
    string,
    unknown
  > | null
  const clearanceDamage =
    typeof productMeta?.clearance_damage === "string"
      ? productMeta.clearance_damage.trim()
      : ""

  /* Zakázka → štítek u ceny a věta u tlačítka (§ 1820 odst. 1 písm. j) OZ):
     o vyloučení odstoupení musí zákazník vědět předem. Platí pro profil výroby
     i pro kategorii zakázek (a pro zrcadlo profilu v metadatech, kdyby se
     profil nenačetl). Ve výběru do úpravy objednávky ne — zakázka tam není. */
  const showMadeToOrderNotice =
    !pick &&
    (isMadeToOrder || isCommissionCategory || Boolean(productMeta?.made_to_order))
  /* Smluvní podmínky do štítku a kroků (audit § 0): záloha % (Z2) a lhůta od
     zahájení (Z9) z profilu výroby pro zvolené provedení. Bez profilu (zakázka
     jen kategorií) zůstane krátký štítek — nic se nevymýšlí. */
  const madeToOrderDeposit = isMadeToOrder
    ? depositPercentageFor(productionProfile, selectedVariant?.id)
    : null
  const madeToOrderMaxDays = isMadeToOrder
    ? productionMaxDaysFor(productionProfile, selectedVariant?.id)
    : null

  /* Dárkový poukaz s vlastní částkou: pole místo ceny, částka jde do košíku
     jako `metadata.voucher_amount` a backend z ní udělá cenu řádku. */
  const isVoucher = !pick && !bundle && isCustomAmountVoucher(productMeta)
  /* Jakýkoli dárkový poukaz (pevná hodnota i vlastní částka): formulář
     podoby a obdarovaného, hodnoty jdou do metadat položky. */
  const isGiftVoucher = !pick && !bundle && isGiftVoucherProduct(productMeta)
  const [giftVoucher, setGiftVoucher] = useState<GiftVoucherFormValue>(
    EMPTY_GIFT_VOUCHER_FORM
  )
  const [giftVoucherTouched, setGiftVoucherTouched] = useState(false)
  /* „Cena po domluvě" (`metadata.price_on_request`, přepínač v administraci;
     backend tutéž vlajku vynucuje v lib/price-on-request.ts) nebo výrobek
     prostě bez ceny (Domovní znamení, 20. 10. 2026 rozhodnutí Lucie): nejde
     do košíku, vede na poptávku na stránce Výroba s předvyplněným výrobkem.
     Bez ceny by řádek v košíku nešel ani ocenit. */
  const priceOnRequest =
    !pick &&
    (isPriceOnRequest(productMeta) ||
      (Boolean(selectedVariant) &&
        selectedVariant?.calculated_price?.calculated_amount == null))
  const voucherCfg = useMemo(() => voucherConfig(productMeta), [productMeta])
  const [voucherAmount, setVoucherAmount] = useState("")
  const [voucherTouched, setVoucherTouched] = useState(false)
  const currencyCode = region?.currency_code ?? "czk"

  const availability = useMemo(
    () => variantAvailability(selectedVariant),
    [selectedVariant]
  )
  const inStock = isPurchasable(availability)
  const pickMax = pick?.maxQuantity
  const maxQuantity = useMemo(
    () =>
      pickMax
        ? Math.min(pickMax, maxPurchasableQuantity(selectedVariant, pickMax))
        : maxPurchasableQuantity(selectedVariant),
    [selectedVariant, pickMax]
  )
  /** Vybrané provedení server k objednávce přidat nedovolí. */
  const pickBlocked = Boolean(
    pick && selectedVariant && !pick.allowedVariantIds.includes(selectedVariant.id)
  )

  // Never leave a quantity above what the customer can actually buy.
  useEffect(() => {
    setQuantity((current) => Math.min(Math.max(1, current), Math.max(1, maxQuantity)))
  }, [maxQuantity])

  const setOptionValue = (optionId: string, value: string) => {
    setOptions((previous) => ({ ...previous, [optionId]: value }))
    // Hláška „tohle přidat nejde" patří k předchozímu provedení.
    if (pick && addState.kind === "error") setAddState({ kind: "idle" })
  }

  /* Režim výběru: žádný košík — kus jde do návrhu úpravy a volající vrátí
     zákazníka na stránku úpravy. Chyba (strop změn, vypnuté úložiště) zůstane
     pod tlačítkem. */
  const handlePick = () => {
    if (!pick || !selectedVariant?.id || pickBlocked || addState.kind === "added") {
      return
    }
    const result = pick.onPick(selectedVariant, pick.fixedQuantity ?? quantity)
    setAddState(
      result.ok ? { kind: "added" } : { kind: "error", message: result.message }
    )
  }

  const handleAddToCart = async () => {
    if (!selectedVariant?.id || isAdding) return

    // Poukaz bez platné částky do košíku nejde — chybu ukáže pole samo.
    const voucherCheck = isVoucher
      ? checkVoucherAmount(voucherAmount, voucherCfg, currencyCode)
      : null
    if (voucherCheck && !voucherCheck.ok) {
      setVoucherTouched(true)
      return
    }
    const giftVoucherError = isGiftVoucher ? giftVoucherFormError(giftVoucher) : null
    if (giftVoucherError) {
      setGiftVoucherTouched(true)
      setAddState({ kind: "error", message: giftVoucherError })
      return
    }

    window.clearTimeout(resetTimer.current)
    setAddState({ kind: "adding" })

    try {
      // The empty marker is what lets the cart recognise the line as a commission and open
      // the brief there — the description itself is written in the cart, not here.
      const result = await addToCart({
        variantId: selectedVariant.id,
        quantity,
        countryCode,
        ...(isMadeToOrder ? { metadata: madeToOrderMetadata("") } : {}),
        /* Poukaz: vlastní částka i podoba/obdarovaný v jednom objektu — oba
           jdou přes `line-items-custom`, kde se z `voucher_amount` počítá cena. */
        ...(isGiftVoucher || voucherCheck?.ok
          ? {
              metadata: {
                ...(voucherCheck?.ok ? { voucher_amount: voucherCheck.amount } : {}),
                ...(isGiftVoucher ? voucherLineMetadata(giftVoucher) : {}),
              },
            }
          : {}),
      })

      if (!result?.success) {
        throw new Error(result?.message)
      }

      // The header dropdown opens too, but it is off-viewport at the moment of the click —
      // the button itself has to say what happened.
      setAddState({ kind: "added" })
      resetTimer.current = window.setTimeout(
        () => setAddState({ kind: "idle" }),
        4000
      )
    } catch (error: any) {
      setAddState({
        kind: "error",
        message: toCzechErrorMessage(error?.message),
      })
    }
  }

  const category = categories
    ?.map((item) => item.name || item.handle)
    .filter(Boolean)
    .join(" · ")

  const description =
    product.description?.trim() ||
    "Ručně vyrobená keramika z píseckého ateliéru."
  const descriptionWords = description.split(/\s+/).filter(Boolean)
  const hasLongDescription = descriptionWords.length > 25
  const descriptionPreview = hasLongDescription
    ? descriptionWords.slice(0, 25).join(" ")
    : description
  const selectedOptionLabels = product.options
    ?.map((option) => options[option.id])
    .filter(Boolean)
    .join(" · ")
  const displayTitle = bundle?.title || product.title
  const openDescription = () => {
    window.dispatchEvent(new CustomEvent("open-product-details-desc"))
    const details = document.getElementById("product-details")
    if (details) scrollWithLenis(details)
  }
  const scrollToReviews = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    const reviews = document.getElementById("product-reviews")
    if (reviews) {
      scrollWithLenis(reviews)
      window.history.replaceState(null, "", "#product-reviews")
    }
  }

  return (
    <>
      <div className="product__story">
        {/*
          Pravý sloupec jako JEDEN box.

          Na svislém tabletu má být přilepený k obrazovce celý — nadpis, perex
          i nákup — a lepit se dá jen box, ne skupina sourozenců. Jinde je
          `display: contents`, takže se pro rozvržení chová, jako by tu nebyl,
          a počítač, landscape ani telefon o něm nevědí.

          Galerie tím padá v DOM za nákup. Základní mřížka i `v(lg)` si proto
          sloupce pojmenovávají čísly místo pořadím zápisu.
        */}
        <div className="product__sideStack">
          <aside className="product__identity" aria-label="Informace o produktu">
            <motion.div
              className="product__identityInner"
              initial={initial}
              animate={animate}
              transition={transition}
            >
              <div className="product__eyebrow">
                <span>01 · {category || "Autorská keramika"}</span>
                <span>Písek</span>
              </div>

              <h1>{displayTitle}</h1>
              <p className="product__signature">
                {bundle
                  ? "Vybráno dohromady."
                  : "Vyrobeno rukama, jen jednou."}
              </p>
              <p className="product__lead">
                {descriptionPreview}
                {hasLongDescription && (
                  <>
                    {"… "}
                    <button
                      type="button"
                      className="product__leadMore"
                      onClick={openDescription}
                    >
                      více
                    </button>
                  </>
                )}
              </p>

              {initialCount >= 5 && (
                <div
                  className="product__rating"
                  aria-label={`${initialRating} z 5, ${initialCount} recenzí`}
                >
                  <span className="product__ratingValue">
                    {initialRating.toFixed(1)}
                  </span>
                  <span className="product__ratingRule" />
                  <a href="#product-reviews" onClick={scrollToReviews}>
                    {initialCount} recenzí
                  </a>
                </div>
              )}

              <div className="product__detailsSlot">
                <Details product={product} texts={texts} />
              </div>
            </motion.div>
          </aside>

          <aside
            className="product__purchase"
            data-bundle={bundle ? "true" : undefined}
            aria-label="Výběr varianty a nákup"
          >
            <motion.div
              className="product__purchaseInner"
              initial={initial}
              animate={animate}
              transition={transition2}
            >
              <div className="product__purchaseHeader">
                {/* Popisky z bloku `global.produkt` (`volba.*`); stav dostupnosti
                    vedle je sdílený slovník, ten drží kód. */}
                <span {...editableItem(texts, "volba.stitek")}>
                  {itemText(texts, "volba.stitek", "Vaše volba")}
                </span>
                {/* The shared availability vocabulary (spec §12); bundles are
                    stock-blind on the storefront, so they keep the older
                    two-state copy instead of mislabelling themselves. */}
                <span>
                  {bundle
                    ? inStock
                      ? "K dispozici"
                      : "Na dotaz"
                    : availabilityLabel[availability]}
                </span>
              </div>

              <div className="product__selection">
                <small {...editableItem(texts, "volba.provedeni")}>
                  {itemText(texts, "volba.provedeni", "Vaše provedení")}
                </small>
                <span>
                  {bundle
                    ? `${bundle.items.length} kusy dohromady`
                    : selectedOptionLabels ||
                      selectedVariant?.title ||
                      "Jediné provedení"}
                </span>
              </div>

              {bundle ? (
                <BundleActions
                  bundle={bundle}
                  region={region}
                  isPreview={isBundlePreview}
                  wishlistVariantId={selectedVariant?.id}
                  wishlistItems={wishlistItems}
                  isAuthenticated={isAuthenticated}
                  price={
                    <ProductPrice
                      product={product}
                      variant={selectedVariant}
                      countryCode={countryCode}
                    />
                  }
                />
              ) : (
                <>
                  <div className="product__optionPanel">
                    <ProductOptions
                      product={product}
                      isAdding={isAdding}
                      options={options}
                      setOptionValue={setOptionValue}
                    />
                  </div>

                  {/* The chosen provedení, shown as itself: a variant can carry its
                      own photos and note (admin: Varianty a ceny), because a blue
                      glaze sold by a photo of the green one is a return waiting
                      to happen. */}
                  {(variantPhotos.length > 0 || variantNote) && (
                    <div className="product__variantMedia">
                      {variantPhotos.length > 0 && (
                        <div className="product__variantPhotos">
                          {variantPhotos.map((url) => (
                            <img
                              key={url}
                              src={url}
                              alt={`${product.title} — ${selectedVariant?.title ?? "zvolené provedení"}`}
                              loading="lazy"
                            />
                          ))}
                        </div>
                      )}
                      {variantNote && (
                        <p className="product__variantNote">{variantNote}</p>
                      )}
                    </div>
                  )}

                  <div className="product__buyBlock">
                    {clearanceDamage && (
                      <div className="product__clearanceNote">
                        <span className="product__clearanceNoteLabel">
                          Poškození
                        </span>
                        <p>{clearanceDamage}</p>
                      </div>
                    )}
                    {isMadeToOrder && productionProfile && (
                      <MadeToOrderPanel
                        profile={productionProfile}
                        variantId={selectedVariant?.id}
                        unitAmount={
                          selectedVariant?.calculated_price?.calculated_amount ?? null
                        }
                        currencyCode={region?.currency_code ?? "czk"}
                      />
                    )}
                    {isVoucher ? (
                      <VoucherAmountField
                        config={voucherCfg}
                        currencyCode={currencyCode}
                        value={voucherAmount}
                        onChange={(value) => {
                          setVoucherAmount(value)
                          if (addState.kind === "error") setAddState({ kind: "idle" })
                        }}
                        showError={voucherTouched}
                        disabled={isAdding}
                      />
                    ) : (
                      <ProductPrice
                        product={product}
                        variant={selectedVariant}
                        countryCode={countryCode}
                      />
                    )}
                    {showMadeToOrderNotice && (
                      <MadeToOrderBadge
                        depositPercentage={madeToOrderDeposit}
                        maxDays={madeToOrderMaxDays}
                      />
                    )}
                    {isGiftVoucher && !priceOnRequest && (
                      <GiftVoucherForm
                        value={giftVoucher}
                        onChange={(value) => {
                          setGiftVoucher(value)
                          if (addState.kind === "error") setAddState({ kind: "idle" })
                        }}
                        showErrors={giftVoucherTouched}
                        disabled={isAdding}
                      />
                    )}
                    {priceOnRequest ? (
                      <div className="product__details__cta__buy" data-testid="price-on-request">
                        <LocalizedClientLink
                          href={inquiryHref(product.handle)}
                          className="product__details__cta__inquiry"
                          data-testid="inquiry-link"
                        >
                          Poptat výrobu
                        </LocalizedClientLink>
                        <p className="product__details__cta__codNote">
                          Cena se odvíjí od rozsahu — pošlete nám poptávku a připravíme nabídku
                          s cenou, lhůtou a výší zálohy.
                        </p>
                      </div>
                    ) : (
                    <CTA
                      inStock={inStock}
                      selectedVariant={selectedVariant}
                      isAdding={isAdding}
                      addState={addState}
                      availability={availability}
                      backorderNote={
                        isMadeToOrder || isVoucher || isGiftVoucher
                          ? null
                          : backorderWaitNote(product)
                      }
                      // Dobírka výchozí; ne u zakázky (profil i kategorie) a do zahraničí.
                      codAllowed={
                        productAllowsDobirka(product) &&
                        !isMadeToOrder &&
                        !isCommissionCategory &&
                        DOBIRKA_COUNTRIES.has(String(countryCode).toLowerCase())
                      }
                      quantity={pick?.fixedQuantity ?? quantity}
                      maxQuantity={maxQuantity}
                      // Pevný počet (výměna řádku) = žádný stepper.
                      onQuantityChange={pick?.fixedQuantity ? undefined : setQuantity}
                      isValidVariant={isValidVariant}
                      handleAddToCart={pick ? handlePick : handleAddToCart}
                      pick={
                        pick
                          ? {
                              label: pick.label,
                              blocked: pickBlocked,
                              blockedText: pick.blockedText,
                              note: pick.note,
                            }
                          : undefined
                      }
                      options={options}
                      product={product}
                      wishlistItems={wishlistItems}
                      isAuthenticated={isAuthenticated}
                      countryCode={countryCode}
                      /* Zakázková výroba stays on the classic path — the express
                         flow has no brief and no deposit slider. Auth + saved
                         address are only a hint here: the prebuilt PDP is
                         anonymous, so the button re-checks them in the browser. */
                      /* Poukaz s vlastní částkou taky ne: „Koupit ihned" vkládá
                         variantu bez částky (rychlý nákup pole nemá). */
                      /* A žádný poukaz: „Koupit ihned" nenese podobu ani obdarovaného. */
                      showBuyNow={Boolean(
                        !isMadeToOrder &&
                          !isCommissionCategory &&
                          !isVoucher &&
                          !isGiftVoucher
                      )}
                      buyNowEligible={Boolean(isAuthenticated && hasSavedAddress)}
                      texts={texts}
                    />
                    )}
                    {showMadeToOrderNotice && <MadeToOrderAddNotice />}
                    {/* Čtyři kroky zakázky (bod 05 PDF Potvrzení zakázky) —
                        zákazník čte před objednávkou to, co pak dostane v příloze. */}
                    {showMadeToOrderNotice && (
                      <MadeToOrderSteps maxDays={madeToOrderMaxDays} />
                    )}
                    {/* Bezpečnostní věty podle kategorie + odkaz na protokoly
                        nezávadnosti (LEGAL_AUDIT § 0b N1/N2). Ve výběru do úpravy
                        objednávky ne — tam se nenakupuje. */}
                    {!pick && (
                      <SafetyNotice
                        categoryHandles={(categories ?? []).map((category) => category.handle ?? "")}
                        description={product.description}
                      />
                    )}
                  </div>
                </>
              )}

              {/* Tři značky pod nákupem — položky `znacky.*` bloku `global.produkt`. */}
              <div className="product__serviceNotes">
                <span {...editableItem(texts, "znacky.baleni")}>
                  {itemText(texts, "znacky.baleni", "Zabalíme pečlivě")}
                </span>
                <span {...editableItem(texts, "znacky.rucne")}>
                  {itemText(texts, "znacky.rucne", "Ručně vytvořeno")}
                </span>
                <span {...editableItem(texts, "znacky.atelier")}>
                  {itemText(texts, "znacky.atelier", "Ateliér · Písek")}
                </span>
              </div>

              {/* Hlídání naskladnění do výběru nepatří — tam jde jen to, co je k mání. */}
              {!bundle && !pick && selectedVariant && !inStock && (
                <RestockForm
                  variant={{
                    id: selectedVariant.id,
                    title: selectedVariant.title || undefined,
                  }}
                  product={{ title: product.title || undefined }}
                  texts={texts}
                />
              )}
            </motion.div>
          </aside> 
        </div>

        <div className="product__media" aria-label="Fotografie produktu">
          <Gallery
            product={product}
            region={region}
            countryCode={countryCode}
            bundle={bundle}
            texts={texts}
          />
        </div>
      </div>
    </>
  )
}

export default ProductDetails


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const initial = { opacity: 0, y: 24 }
const animate = { opacity: 1, y: 0 }
const transition = { duration: 0.8, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }
const transition2 = {
              duration: 0.8,
              delay: 0.12,
              ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
            }
