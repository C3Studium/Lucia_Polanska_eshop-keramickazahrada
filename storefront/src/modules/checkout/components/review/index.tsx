"use client"

import { AnimatePresence, motion } from "framer-motion"
import { useSearchParams } from "next/navigation"
import { useState } from "react"

import { initiatePaymentSession, recordCheckoutConsent } from "@lib/data/cart"
import {
  buildComgateSessionPayload,
  extractComgateRedirectUrl,
  type ComgatePaymentMethod,
} from "@lib/util/comgate"
import { convertToLocale } from "@lib/util/money"

import { isMadeToOrderLine, type ProductionLeadTime } from "@lib/util/commission"
import {
  allMadeToOrderAcked,
  madeToOrderAckItems,
  commissionPieceFilled,
  commissionPiecesOf,
  readCommissionBrief,
} from "@lib/util/made-to-order"
import CheckoutCommissionBriefs from "../commission-briefs"
import { isZeroChargeCart, zeroChargeCopy } from "@lib/util/price-on-request"
import { cartNeedsShipping } from "@lib/util/needs-shipping"

import CheckoutConsent from "../legal-consent"
import { ORDER_BUTTON_LABEL } from "../legal-consent/labels"
import PaymentButton from "../payment-button"
import PreContractInfo, {
  chargeSplit,
  describePayment,
} from "../pre-contract-info"
import type { ProductionPaymentMode } from "@lib/util/made-to-order"
import OrderRecap from "./recap"
import {
  contentVariants,
  errorVariants,
  HEADING_REST_X,
  HEADING_SHIFT_X,
  headingTransition,
  rowVariants,
} from "./motion"
import styles from "./style.module.scss"

const COMMISSION_GATE_HINT =
  "Tohle je výroba na míru — než objednávku zaplatíte, napište prosím nebo nahrajte fotku, co si představujete (uloží se samo). Bez toho nevíme, co máme vyrobit."
const CONSENT_GATE_HINT =
  "Než objednávku odešlete, potvrďte prosím souhlas s obchodními podmínkami."
const MADE_TO_ORDER_GATE_HINT =
  "Potvrďte prosím ještě, že berete na vědomí, že výrobek podle vašeho zadání nelze vrátit ve 14denní lhůtě a že záloha se po zahájení výroby nevrací."
/* Z-A: u víc zakázek má každá vlastní zaškrtnutí — hláška říká, že chybí některé. */
const MADE_TO_ORDER_GATE_HINT_MANY =
  "Potvrďte prosím poučení u každého výrobku na zakázku — že ho nelze vrátit ve 14denní lhůtě a že záloha se po zahájení výroby nevrací."

const Review = ({
  cart,
  countryCode,
  productionMode,
  vacationNotice,
  comgateMethods = [],
  leadTimes = [],
}: {
  cart: any
  countryCode: string
  productionMode?: ProductionPaymentMode | null
  /** Hotová věta o dovolené (jen informace, platbu neblokuje) — nebo nic. */
  vacationNotice?: string | null
  /** Nabídka ComGate — z ní se volba `?method=` přeloží na název metody. */
  comgateMethods?: ComgatePaymentMethod[]
  /** Výrobní lhůty zakázkových položek pro předsmluvní souhrn. */
  leadTimes?: ProductionLeadTime[]
}) => {
  const searchParams = useSearchParams()
  const [accepted, setAccepted] = useState(false)
  /* Z-A „zakázka = položka": id řádku → čas zaškrtnutí poučení Z10. Čas se
     bere hned při kliknutí, ať se k řádku uloží okamžik, kdy zákazník
     opravdu klikl, ne kdy odeslal objednávku. */
  const [madeToOrderAcks, setMadeToOrderAcks] = useState<
    Record<string, string | undefined>
  >({})
  const [isPaying, setIsPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isOpen = searchParams.get("step") === "review"
  const comgateMethod = searchParams.get("method")

  /*
   * Which lines are commissions. Every signal counts — the catalogue category, the product's
   * made-to-order marker, or a brief already on the line — so the brief box appears for a zakázka
   * driven only by a production profile too (that was the one the deposit slider showed but the
   * brief missed). `prompt` is the owner's „co poslat" instruction, mirrored onto the product.
   */
  const commissionLines = ((cart?.items ?? []) as any[])
    .filter(isMadeToOrderLine)
    .map((item) => ({
      id: item.id as string,
      title: (item.product_title || item.title || "") as string,
      brief: readCommissionBrief(item),
    }))

  /* U zakázky se nedá k platbě, dokud není brief vyplněný — aspoň text NEBO
     fotka. Čte se z KOŠÍKU, ne z klientského callbacku: brief teď bydlí v pravém
     sloupci (na širokém) i v toku (na mobilu), a obě kopie ukládají na tutéž
     položku. Po uložení se košík revaliduje → tenhle výpočet se přepočítá a gate
     se otevře. (Jen zakázky; běžný košík pole `commissionLines` nemá.) */
  /* Po KUSECH, ne po řádku: „Domovní znamení · 2 ks" jsou dva kusy a každý má
     své zadání. Složený pohled na řádku (`specification`) je neprázdný už
     s jedním vyplněným kusem, takže by brána pustila objednávku, u které
     druhý kus nikdo nepopsal. */
  const allCommissionsComplete = ((cart?.items ?? []) as any[])
    .filter(isMadeToOrderLine)
    .every((item) => commissionPiecesOf(item).every(commissionPieceFilled))

  /* Zakázka v košíku → povinné zaškrtnutí poučení (§ 1837 písm. d) OZ, Z10)
     — jedno NA KAŽDOU zakázkovou položku (Z-A); objednávka jde dál, až jsou
     všechna. */
  const hasMadeToOrder =
    commissionLines.length > 0 || Boolean(productionMode?.has_made_to_order)
  const ackItems = madeToOrderAckItems(commissionLines, hasMadeToOrder)
  const madeToOrderOk = allMadeToOrderAcked(ackItems, madeToOrderAcks)
  const consentReady = accepted && madeToOrderOk
  const setAck = (itemId: string, checked: boolean) => {
    setMadeToOrderAcks((current) => ({
      ...current,
      [itemId]: checked ? new Date().toISOString() : undefined,
    }))
    setError(null)
  }

  /* Kolik se zaplatí TEĎ. U zakázky to NENÍ cena košíku — je to zvolená záloha
     (default), půlka, celek nebo vlastní částka ze slideru; zbytek se doplatí
     po dokončení. Tlačítko i rekapitulace proto musí ukazovat tuhle částku, ne
     cart.total (jinak by věta u tlačítka lhala o částce, i když brána vezme
     jen zálohu). Běžný košík bez zakázky platí celek = cart.total.

     Volba částky se dělá v kroku Platba (widget je přesunutý tam) a ukládá se na
     košík; `selectProductionPaymentMode` košík revaliduje, takže sem už přijde
     `productionMode` s aktuální volbou při přechodu na Přehled — čteme ji rovnou. */
  const { now: chargeNow, later: outstanding } = chargeSplit(
    productionMode,
    cart?.total ?? 0
  )

  const money = (amount: number) =>
    convertToLocale({ amount, currency_code: cart?.currency_code ?? "czk" })

  const paidByGiftcard =
    cart?.gift_cards && cart?.gift_cards?.length > 0 && cart?.total === 0

  /* Cena po domluvě a k úhradě 0 (jen takový kus + osobní odběr): žádná brána,
     objednávka se dokončí s relací `pp_system_default` (lib/util/price-on-request).
     Případná zbylá volba `?method=` z dřívějška se pak nepoužije. */
  const zeroCharge = isZeroChargeCart(cart)
  const zeroCopy = zeroChargeCopy(cart)

  const previousStepsCompleted =
    cart.shipping_address &&
    (!cartNeedsShipping(cart) || (cart.shipping_methods?.length ?? 0) > 0) &&
    (cart.payment_collection || paidByGiftcard || comgateMethod || zeroCharge)

  /* Čím se platí — ComGate cesta ještě nemá platební relaci (zakládá se až
     tlačítkem), takže se metoda čte z `?method=`; ostatní z relace na košíku
     (tatáž, podle které `PaymentButton` volí svou variantu). */
  const payment = zeroCharge
    ? {
        label: zeroCopy.reviewLabel,
        note: zeroCopy.reviewNote,
      }
    : describePayment({
    comgateOptionId: comgateMethod,
    comgateMethods,
    providerId: cart?.payment_collection?.payment_sessions?.[0]?.provider_id,
    paidByGiftcard: Boolean(paidByGiftcard),
  })

  const comgateNote =
    outstanding > 0
      ? `Teď zaplatíte zálohu ${money(chargeNow)} online (${payment?.label ?? "ComGate"}, platební brána ComGate). Zbytek ${money(outstanding)} doplatíte po dokončení zakázky.`
      : `Zaplatíte ${money(chargeNow)} hned online (${payment?.label ?? "ComGate"}, platební brána ComGate).`

  /**
   * Consent is written to the cart *before* the payment session is created — so the record
   * exists no matter what happens at the gateway, and so updating the cart can never invalidate
   * a session that is already in flight. The server action merges against a FRESH cart (a stale
   * `cart.metadata` spread here could revert the production-payment amount the customer just
   * chose) and takes the document versions from the legal registry.
   */
  const recordConsent = async () => {
    await recordCheckoutConsent({
      clientAcceptedAt: new Date().toISOString(),
      madeToOrderAck: hasMadeToOrder && madeToOrderOk,
      // Čas zaškrtnutí ke každé zakázkové položce → `made_to_order.ack_at` řádku.
      madeToOrderAcks: hasMadeToOrder ? madeToOrderAcks : undefined,
    })
  }

  const payWithComgate = async () => {
    if (isPaying || !consentReady || !comgateMethod || !allCommissionsComplete) {
      return
    }

    setIsPaying(true)
    setError(null)

    try {
      await recordConsent()

      const result = await initiatePaymentSession(
        cart,
        buildComgateSessionPayload(cart, comgateMethod) as any
      )

      if (!result.success) {
        throw new Error(result.message)
      }

      const redirectUrl = extractComgateRedirectUrl(result.data)

      if (!redirectUrl) {
        throw new Error("Platební brána se neozvala. Zkuste to prosím znovu.")
      }

      window.location.assign(redirectUrl)
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : "Platbu se nepovedlo spustit. Zkuste to prosím znovu."
      )
      setIsPaying(false)
    }
  }

  const gateHint = !allCommissionsComplete
    ? null
    : !accepted
      ? CONSENT_GATE_HINT
      : !madeToOrderOk
        ? ackItems.length > 1
          ? MADE_TO_ORDER_GATE_HINT_MANY
          : MADE_TO_ORDER_GATE_HINT
        : null

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <motion.h2
          className={styles.heading}
          initial={false}
          animate={{
            opacity: isOpen ? 1 : 0.42,
            x: isOpen ? HEADING_REST_X : HEADING_SHIFT_X,
          }}
          transition={headingTransition}
        >
          Přehled
        </motion.h2>
      </div>
      <AnimatePresence initial={false}>
        {isOpen && previousStepsCompleted && (
          <motion.div
            className={styles.content}
            key="review-content"
            variants={contentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.div variants={rowVariants} initial="hidden" animate="visible">
              <OrderRecap
                cart={cart}
                deposit={
                  productionMode?.has_made_to_order
                    ? { now: chargeNow, later: outstanding }
                    : null
                }
              />
            </motion.div>

            {/* The brief, one per commissioned line: what they want, and pictures of it.
                On a wide screen it lives in the right summary column (under the
                discount code); here it shows only on a phone/tablet, in the flow.
                `briefsMobile` hides this copy from 1020px up — see style. */}
            {commissionLines.length > 0 && (
              <motion.div
                className={styles.briefsMobile}
                variants={rowVariants}
                initial="hidden"
                animate="visible"
              >
                <CheckoutCommissionBriefs cart={cart} />
              </motion.div>
            )}

            {/* Předsmluvní informace (§ 1820, § 1826 OZ): platba, dodací
                lhůta, odstoupení / jeho vyloučení u zakázky, prodávající,
                dokumenty. Zboží a ceny jsou v rekapitulaci výš. */}
            <motion.div variants={rowVariants} initial="hidden" animate="visible">
              <PreContractInfo
                cart={cart}
                payment={payment}
                leadTimes={leadTimes}
                productionMode={productionMode}
              />
            </motion.div>

            <motion.div variants={rowVariants} initial="hidden" animate="visible">
              <CheckoutConsent
                variant="review"
                accepted={accepted}
                onAcceptedChange={(value) => {
                  setAccepted(value)
                  setError(null)
                }}
                madeToOrderItems={ackItems}
                madeToOrderAcks={madeToOrderAcks}
                onMadeToOrderAckChange={setAck}
              />
            </motion.div>

            <AnimatePresence>
              {error && (
                <motion.p
                  className={styles.error}
                  role="alert"
                  variants={errorVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.div variants={rowVariants} initial="hidden" animate="visible">
              {/* U zakázky bez vyplněného briefu je tlačítko zamčené — spousta
                  lidí by jinak nechápala, proč „nejde zaplatit". Výrazný callout
                  NAD tlačítkem říká, že nejdřív musí napsat/nahrát, co si
                  představují. */}
              {vacationNotice && (
                <p className={styles.vacationNotice} data-testid="vacation-notice">
                  {vacationNotice}
                </p>
              )}
              {!allCommissionsComplete && (
                <p className={styles.commissionGate}>{COMMISSION_GATE_HINT}</p>
              )}
              {zeroCharge ? (
                consentReady && allCommissionsComplete ? (
                  <PaymentButton
                    cart={cart}
                    data-testid="submit-order-button"
                    countryCode={countryCode}
                    zeroCharge
                    onBeforePlaceAction={recordConsent}
                  />
                ) : gateHint ? (
                  <p className={styles.gateHint}>{gateHint}</p>
                ) : null
              ) : comgateMethod ? (
                <>
                  <button
                    type="button"
                    className={styles.payButton}
                    onClick={payWithComgate}
                    disabled={!consentReady || !allCommissionsComplete || isPaying}
                    data-testid="submit-order-button"
                  >
                    {isPaying ? "Přesměrováváme k platbě…" : ORDER_BUTTON_LABEL}
                  </button>
                  <p className={styles.payNote} data-testid="submit-order-note">
                    {comgateNote}
                  </p>
                  {gateHint ? <p className={styles.gateHint}>{gateHint}</p> : null}
                </>
              ) : consentReady && allCommissionsComplete ? (
                <PaymentButton
                  cart={cart}
                  data-testid="submit-order-button"
                  countryCode={countryCode}
                  amountLabel={money(chargeNow)}
                  /* The consent record must exist for EVERY payment path —
                     the ComGate flow writes it itself, the direct ones (osobní
                     odběr, dobírka) get it here, before placing the order. */
                  onBeforePlaceAction={recordConsent}
                />
              ) : gateHint ? (
                <p className={styles.gateHint}>{gateHint}</p>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Review
