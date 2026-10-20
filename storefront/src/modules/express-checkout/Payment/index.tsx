"use client"

import { isComgate } from "@lib/constants"
import {
  initiatePaymentSession,
  listProductionLeadTimes,
  recordCheckoutConsent,
} from "@lib/data/cart"
import { selectProductionPaymentMode } from "@lib/data/made-to-order-actions"
import { isMadeToOrderLine, type ProductionLeadTime } from "@lib/util/commission"
import type { ProductionPaymentMode } from "@lib/util/made-to-order"
import CheckoutConsent from "@modules/checkout/components/legal-consent"
import { ORDER_BUTTON_LABEL } from "@modules/checkout/components/legal-consent/labels"
import PreContractInfo, {
  chargeSplit,
  describePayment,
} from "@modules/checkout/components/pre-contract-info"
import ProductionPaymentModeChoice from "@modules/checkout/components/production-payment-mode"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import {
  extractComgateRedirectUrl,
  fromComgateOptionId,
  toComgateOptionId,
  type ComgatePaymentMethod,
} from "@lib/util/comgate"
import { convertToLocale } from "@lib/util/money"
import {
  readLastPaymentMethod,
  rememberLastPaymentMethod,
} from "@lib/util/payment-preference"
import { HttpTypes } from "@medusajs/types"
import ComgatePaymentSelector from "@modules/common/components/comgate-payment-selector"
import { AnimatePresence, motion } from "framer-motion"
import Image from "next/image"
import { useEffect, useState } from "react"
import styles from "../style.module.scss"
import { isPackagingLine, productLines, withPackagingUnderProducts } from "@lib/util/packaging"
import PackagingLine, { PackagingNote, packagingFor } from "@modules/common/components/packaging-line"

type PaymentProps = {
  cart: HttpTypes.StoreCart
  paymentMethods: HttpTypes.StorePaymentProvider[]
  comgateMethods: ComgatePaymentMethod[]
  countryCode: string
  handle: string
  /** Zakázka: volba zálohy (kolik zaplatit hned). `null` u běžného produktu. */
  productionMode?: ProductionPaymentMode | null
}

const legacyComgateMethods = [
  { id: "pp_comgate_card", method: "CARD_ALL" },
  { id: "pp_comgate_applepay", method: "APPLEPAY_REDIRECT" },
  { id: "pp_comgate_googlepay", method: "GOOGLEPAY_REDIRECT" },
  { id: "pp_comgate_bank", method: "BANK_ALL" },
]

const methodForOption = (id: string) =>
  fromComgateOptionId(id) ||
  legacyComgateMethods.find((method) => method.id === id)?.method ||
  "ALL"

const legacyOptionForMethod = (method: string) => {
  if (method.includes("APPLE")) return "pp_comgate_applepay"
  if (method.includes("GOOGLE")) return "pp_comgate_googlepay"
  if (method.includes("BANK")) return "pp_comgate_bank"
  return "pp_comgate_card"
}

export const Payment = ({
  cart,
  paymentMethods,
  comgateMethods,
  countryCode,
  handle,
  productionMode,
}: PaymentProps) => {
  const activeSession = cart.payment_collection?.payment_sessions?.find(
    (session) => session.status === "pending"
  )
  const activeComgateMethod = String(activeSession?.data?.method || "")
  const activeMethod = isComgate(activeSession?.provider_id)
    ? comgateMethods.some((method) => method.id === activeComgateMethod)
      ? toComgateOptionId(activeComgateMethod)
      : legacyOptionForMethod(activeComgateMethod)
    : ""

  const [selected, setSelected] = useState(activeMethod)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /* The last method this browser paid with, restored as a *preselection* after
     mount (localStorage is client-only). The selector renders once this has
     settled, so it opens straight in its „Vybrali jste" state — confirm still
     required, consent still required. */
  const [restored, setRestored] = useState(false)
  useEffect(() => {
    setSelected((current) => {
      if (current) return current
      const stored = readLastPaymentMethod()
      return stored && isComgate(stored) ? stored : current
    })
    setRestored(true)
  }, [])
  /* §1826 ObčZ wants an affirmative act, not an implied sentence — the same
     checkbox contract as the main checkout, recorded before payment. */
  const [accepted, setAccepted] = useState(false)
  /* Zakázka → druhé povinné zaškrtnutí (§ 1837 písm. d) OZ), jako v pokladně. */
  const [madeToOrderAccepted, setMadeToOrderAccepted] = useState(false)
  const hasMadeToOrder =
    (cart.items ?? []).some((item) => isMadeToOrderLine(item as any)) ||
    Boolean(productionMode?.has_made_to_order)
  const consentReady = accepted && (!hasMadeToOrder || madeToOrderAccepted)

  /* Výrobní lhůta zakázky do předsmluvního souhrnu — veřejný profil výroby,
     dotažený serverovou akcí (stránka rychlého nákupu ho nepředává). */
  const [leadTimes, setLeadTimes] = useState<ProductionLeadTime[]>([])
  const madeToOrderKey = (cart.items ?? [])
    .filter((item) => isMadeToOrderLine(item as any))
    .map((item) => `${item.id}:${item.variant_id}`)
    .join("|")
  useEffect(() => {
    if (!madeToOrderKey) {
      setLeadTimes([])
      return
    }
    let cancelled = false
    listProductionLeadTimes(
      (cart.items ?? [])
        .filter((item) => isMadeToOrderLine(item as any))
        .map((item) => ({
          id: item.id,
          product_id: item.product_id,
          variant_id: item.variant_id,
          title: item.product_title ?? item.title,
        }))
    )
      .then((result) => {
        if (!cancelled) setLeadTimes(result)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [madeToOrderKey])

  const comgateAvailable = paymentMethods.some((method) => isComgate(method.id))

  const shippingAddress = cart.shipping_address
  const ready =
    !!shippingAddress && !!cart.email && !!cart.shipping_methods?.length

  const money = (amount: number) =>
    convertToLocale({ amount, currency_code: cart.currency_code })
  const charge = chargeSplit(productionMode, cart.total || 0)
  const payment = describePayment({
    comgateOptionId: selected && isComgate(selected) ? selected : null,
    comgateMethods,
  })
  const shippingMethod = cart.shipping_methods?.at(-1)
  const deliveryLabel = shippingMethod
    ? `${shippingMethod.name} · ${money(
        Number(shippingMethod.total ?? shippingMethod.amount ?? 0)
      )}`
    : null
  const confirmNote = !accepted
    ? "Než objednávku odešlete, potvrďte prosím souhlas s obchodními podmínkami."
    : !consentReady
      ? "Potvrďte prosím ještě, že berete na vědomí, že zboží na zakázku nelze vrátit do 14 dnů."
      : charge.later > 0
        ? `Teď zaplatíte zálohu ${money(charge.now)} online (${payment?.label ?? "ComGate"}, platební brána ComGate). Zbytek ${money(charge.later)} doplatíte po dokončení zakázky.`
        : `Zaplatíte ${money(charge.now)} hned online (${payment?.label ?? "ComGate"}, platební brána ComGate).`

  const pay = async (optionId: string) => {
    if (!ready || isSubmitting || !isComgate(optionId)) return
    if (!consentReady) {
      setError(
        accepted
          ? "Potvrďte prosím poučení u zboží vyrobeného na zakázku."
          : "Potvrďte prosím souhlas s obchodními podmínkami."
      )
      return
    }

    setSelected(optionId)
    setIsSubmitting(true)
    setError(null)

    try {
      // The consent record must exist before the gateway takes over. The
      // action merges server-side against a fresh cart (a stale `cart.metadata`
      // from this prop can never overwrite newer keys) and takes the document
      // versions from the legal registry — same as the main checkout.
      await recordCheckoutConsent({
        cartId: cart.id,
        clientAcceptedAt: new Date().toISOString(),
        madeToOrderAck: hasMadeToOrder && madeToOrderAccepted,
      })
      const shippingName = String(
        cart.shipping_methods?.at(-1)?.name || ""
      ).toLowerCase()
      const result = await initiatePaymentSession(cart, {
        provider_id: "pp_comgate_comgate",
        data: {
          email: cart.email,
          first_name: shippingAddress?.first_name,
          last_name: shippingAddress?.last_name,
          cart_id: cart.id,
          method: methodForOption(optionId),
          country_code: shippingAddress?.country_code || countryCode,
          billing_city: cart.billing_address?.city || shippingAddress?.city,
          billing_street:
            cart.billing_address?.address_1 || shippingAddress?.address_1,
          billing_postal_code:
            cart.billing_address?.postal_code || shippingAddress?.postal_code,
          shipping_city: shippingAddress?.city,
          shipping_street: shippingAddress?.address_1,
          shipping_postal_code: shippingAddress?.postal_code,
          delivery:
            shippingName.includes("zásil") ||
            shippingName.includes("zasil") ||
            shippingName.includes("packeta") ||
            shippingName.includes("výdej")
              ? "PICKUP"
              : "HOME_DELIVERY",
          lang: "cs",
          source: "express-checkout",
          return_path: `/${countryCode}/express-checkout/${handle}`,
        } as any,
      })

      if (!result.success) {
        throw new Error(
          result.message || "Platební bránu se nepovedlo otevřít."
        )
      }

      const redirectUrl = extractComgateRedirectUrl(result.data)
      if (!redirectUrl) {
        throw new Error("Platební brána se neozvala. Zkuste to prosím znovu.")
      }

      // The choice held all the way to the gateway — worth remembering.
      rememberLastPaymentMethod(optionId)
      window.location.assign(redirectUrl)
    } catch (paymentError: any) {
      setError(paymentError?.message || "Platbu se nepovedlo dokončit.")
      setIsSubmitting(false)
    }
  }

  const selectMethod = (optionId: string) => {
    if (isSubmitting) return
    setSelected(optionId)
    setError(null)
  }

  return (
    <div className={styles.paymentStep}>
      <div className={styles.orderMiniature}>
        <div className={styles.orderMiniatureHeader}>
          <span className={styles.eyebrow}>Co kupujete</span>
          <span>
            {productLines(cart.items).reduce((sum, item) => sum + item.quantity, 0)} ks
          </span>
        </div>
        {withPackagingUnderProducts(cart.items ?? []).map((item) =>
          // Balné jde s výrobkem — tenký řádek hned pod ním.
          isPackagingLine(item) ? (
            cart.items!.some((other: any) => !isPackagingLine(other) && packagingFor(cart.items!, other) === item) ? null :
            <PackagingLine key={item.id} item={item} currencyCode={cart.currency_code} compact />
          ) : (
          <div className={styles.miniItem} key={item.id}>
            <Image
              src={item.thumbnail || "/assets/img/horizontal_prop.png"}
              alt=""
              width={58}
              height={58}
            />
            <div>
              <strong>{item.product_title || item.title}</strong>
              <small>
                {item.variant?.options
                  ?.map((option) => option.value)
                  .join(" · ")}
              </small>
              <PackagingNote item={packagingFor(cart.items, item)} currencyCode={cart.currency_code} />
            </div>
            <span>{item.quantity}×</span>
          </div>
          )
        )}
        <div className={styles.totalRows}>
          <span>
            <small>Výběr</small>
            <strong>
              {convertToLocale({
                amount: cart.item_subtotal || 0,
                currency_code: cart.currency_code,
              })}
            </strong>
          </span>
          <span>
            <small>Doručení</small>
            <strong>
              {convertToLocale({
                amount: cart.shipping_total || 0,
                currency_code: cart.currency_code,
              })}
            </strong>
          </span>
          <span className={styles.grandTotal}>
            <small>Celkem</small>
            <strong>
              {convertToLocale({
                amount: cart.total || 0,
                currency_code: cart.currency_code,
              })}
            </strong>
          </span>
          {/* Zakázka: brána vezme jen zálohu — „Celkem" to samo neřekne. */}
          {charge.madeToOrder && (
            <span data-testid="express-deposit">
              <small>
                {charge.later > 0
                  ? `Teď zaplatíte zálohu · zbytek ${money(charge.later)} po dokončení`
                  : "Teď zaplatíte celou částku"}
              </small>
              <strong>{money(charge.now)}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Zakázka: kolik zaplatit hned (záloha / celá částka). Volba se ukládá na
          košík, platba pak vezme zvolenou částku — stejně jako v běžné pokladně. */}
      {productionMode?.has_made_to_order && (
        <ProductionPaymentModeChoice
          initial={productionMode}
          onSelect={(mode, amount) =>
            selectProductionPaymentMode(cart.id, mode, amount)
          }
        />
      )}

      <div className={styles.methodSection}>
        <div className={styles.methodHeading}>
          <span className={styles.eyebrow}>Jak zaplatíte</span>
          <span>Šifrovaně a bezpečně</span>
        </div>
        {/* Předsmluvní informace (§ 1820, § 1826 OZ) před tlačítkem — rychlý
            nákup nemá krok Přehled, tak stojí tady. Zboží a ceny jsou
            v miniatuře objednávky výš. */}
        <PreContractInfo
          cart={cart}
          payment={payment}
          leadTimes={leadTimes}
          delivery={deliveryLabel}
          compact
        />
        <CheckoutConsent
          variant="express"
          rowClassName={styles.paymentConsent}
          accepted={accepted}
          onAcceptedChange={(value) => {
            setAccepted(value)
            if (value) setError(null)
          }}
          madeToOrder={hasMadeToOrder}
          madeToOrderAccepted={madeToOrderAccepted}
          onMadeToOrderAcceptedChange={(value) => {
            setMadeToOrderAccepted(value)
            if (value) setError(null)
          }}
        />
        <div aria-busy={isSubmitting}>
          {!comgateAvailable && (
            <p className={styles.paymentUnavailable} role="alert">
              Comgate teď není dostupný. Zkuste to prosím za chvíli znovu — nebo
              nákup dokončete přes{" "}
              <LocalizedClientLink href="/cart">běžný košík</LocalizedClientLink>
              .
            </p>
          )}
          {comgateAvailable && restored && (
            <ComgatePaymentSelector
              methods={comgateMethods}
              selectedOptionId={selected}
              onSelect={selectMethod}
              onConfirm={() => pay(selected)}
              /* Tady tlačítko objednávku ODESÍLÁ a spouští platbu — zákonný
                 název (§ 1826a OZ); částka a způsob platby jsou ve větě pod ním.
                 Metodu jde vybrat i před souhlasem, zamčené je jen tlačítko. */
              confirmLabel={ORDER_BUTTON_LABEL}
              busyLabel="Přesměrováváme k platbě…"
              confirmDisabled={!consentReady}
              confirmHint={<p data-testid="express-submit-note">{confirmNote}</p>}
              disabled={!ready || isSubmitting}
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            className={styles.error}
            role="alert"
            initial={initial}
            animate={animate}
            exit={exit}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
/* 4/1080 = .37vh — screen-relative drop-in, same unit on both ends. */
const initial = { opacity: 0, y: "-0.37vh" }
const animate = { opacity: 1, y: "0vh" }
const exit = { opacity: 0 }
