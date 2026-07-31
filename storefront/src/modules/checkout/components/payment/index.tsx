"use client"

import { RadioGroup } from "@headlessui/react"
import {
  isComgate,
  isStripe as isStripeFunc,
  paymentInfoMap,
} from "@lib/constants"
import { initiatePaymentSession } from "@lib/data/cart"
import {
  extractComgateRedirectUrl,
  fromComgateOptionId,
  getComgateMethodLogo,
  toComgateOptionId,
  type ComgatePaymentMethod,
} from "@lib/util/comgate"
import { CheckCircleSolid, CreditCard } from "@medusajs/icons"
import { Container, Text, clx } from "@medusajs/ui"
import PremiumActionButton from "@modules/common/components/premium-action-button"
import ErrorMessage from "@modules/checkout/components/error-message"
import PaymentContainer, {
  StripeCardContainer,
} from "@modules/checkout/components/payment-container"
import Divider from "@modules/common/components/divider"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import styles from "./style.module.scss"

const legacyComgateOptions = [
  { id: "pp_comgate_card", method: "CARD_ALL" },
  { id: "pp_comgate_applepay", method: "APPLEPAY_REDIRECT" },
  { id: "pp_comgate_googlepay", method: "GOOGLEPAY_REDIRECT" },
  { id: "pp_comgate_bank", method: "BANK_ALL" },
]

const legacyOptionForMethod = (method: string) => {
  if (method === "BANK_ALL") return "pp_comgate_bank"
  if (method === "APPLEPAY_REDIRECT" || method === "APPLEPAY") {
    return "pp_comgate_applepay"
  }
  if (method === "GOOGLEPAY_REDIRECT" || method === "GOOGLEPAY") {
    return "pp_comgate_googlepay"
  }
  return "pp_comgate_card"
}

const methodForOption = (optionId: string) =>
  fromComgateOptionId(optionId) ||
  legacyComgateOptions.find((option) => option.id === optionId)?.method ||
  "ALL"

const Payment = ({
  cart,
  availablePaymentMethods,
  comgateMethods,
}: {
  cart: any
  availablePaymentMethods: any[]
  comgateMethods: ComgatePaymentMethod[]
}) => {
  const activeSession = cart.payment_collection?.payment_sessions?.find(
    (paymentSession: any) => paymentSession.status === "pending"
  )
  const activeComgateMethod = String(activeSession?.data?.method || "")

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cardBrand, setCardBrand] = useState<string | null>(null)
  const [cardComplete, setCardComplete] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(() => {
    if (isComgate(activeSession?.provider_id)) {
      return comgateMethods.some((method) => method.id === activeComgateMethod)
        ? toComgateOptionId(activeComgateMethod)
        : legacyOptionForMethod(activeComgateMethod)
    }
    return activeSession?.provider_id ?? ""
  })

  const displayPaymentMethods = useMemo(() => {
    return availablePaymentMethods.flatMap((provider) => {
      if (!isComgate(provider.id)) return [provider]

      return comgateMethods.length
        ? comgateMethods.map((method) => ({
            id: toComgateOptionId(method.id),
            comgateMethod: method,
          }))
        : legacyComgateOptions.map(({ id }) => ({ id }))
    })
  }, [availablePaymentMethods, comgateMethods])

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const isOpen = searchParams.get("step") === "payment"
  const isStripe = isStripeFunc(selectedPaymentMethod)
  const hasComgate = availablePaymentMethods.some((method) =>
    isComgate(method.id)
  )

  const paidByGiftcard =
    cart?.gift_cards && cart?.gift_cards?.length > 0 && cart?.total === 0
  const paymentReady =
    (activeSession && cart?.shipping_methods.length !== 0) || paidByGiftcard

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams)
      params.set(name, value)
      return params.toString()
    },
    [searchParams]
  )

  const handleEdit = () => {
    router.push(pathname + "?" + createQueryString("step", "payment"), {
      scroll: false,
    })
  }

  const openComgate = async (optionId: string) => {
    if (isLoading) return

    setSelectedPaymentMethod(optionId)
    setIsLoading(true)
    setError(null)

    const shippingAddress = cart?.shipping_address
    const billingAddress = cart?.billing_address || shippingAddress
    const shippingName = String(
      cart?.shipping_methods?.at(-1)?.name || ""
    ).toLowerCase()

    try {
      const result = await initiatePaymentSession(cart, {
        provider_id: "pp_comgate_comgate",
        data: {
          cart_id: cart.id,
          method: methodForOption(optionId),
          email: cart?.email || null,
          first_name:
            billingAddress?.first_name || shippingAddress?.first_name || null,
          last_name:
            billingAddress?.last_name || shippingAddress?.last_name || null,
          country_code:
            shippingAddress?.country_code ||
            billingAddress?.country_code ||
            "cz",
          billing_city: billingAddress?.city,
          billing_street: billingAddress?.address_1,
          billing_postal_code: billingAddress?.postal_code,
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
        } as any,
      })

      if (!result.success) {
        throw new Error(
          result.message || "Platební bránu se nepodařilo připravit."
        )
      }

      const redirectUrl = extractComgateRedirectUrl(result.data)
      if (!redirectUrl) {
        throw new Error("Platební brána nevrátila adresu pro pokračování.")
      }

      window.location.assign(redirectUrl)
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : "Platební bránu se nepodařilo otevřít."
      )
      setIsLoading(false)
    }
  }

  const setPaymentMethod = async (method: string) => {
    setError(null)
    setSelectedPaymentMethod(method)

    if (isComgate(method)) {
      await openComgate(method)
      return
    }

    if (isStripeFunc(method)) {
      const result = await initiatePaymentSession(cart, {
        provider_id: method,
      })
      if (!result.success) {
        setError(result.message || "Platební metodu se nepodařilo připravit.")
      }
    }
  }

  const handleSubmit = async () => {
    if (paidByGiftcard) {
      router.push(pathname + "?" + createQueryString("step", "review"), {
        scroll: false,
      })
      return
    }

    if (!selectedPaymentMethod || isComgate(selectedPaymentMethod)) return

    setIsLoading(true)
    try {
      const shouldInputCard =
        isStripeFunc(selectedPaymentMethod) && !activeSession
      const hasSelectedSession =
        activeSession?.provider_id === selectedPaymentMethod

      if (!hasSelectedSession) {
        const result = await initiatePaymentSession(cart, {
          provider_id: selectedPaymentMethod,
        })
        if (!result.success) {
          throw new Error(result.message)
        }
      }

      if (!shouldInputCard) {
        router.push(pathname + "?" + createQueryString("step", "review"), {
          scroll: false,
        })
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Platební metodu se nepodařilo připravit."
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    setError(null)
  }, [isOpen])

  const activeComgateInfo = comgateMethods.find(
    (method) => method.id === activeComgateMethod
  )

  return (
    <div className={styles.root}>
      <div className={styles.headerRow}>
        <h2
          className={clx(styles.heading, {
            [styles.headingDisabled]: !isOpen && !paymentReady,
          })}
        >
          Platba
          {!isOpen && paymentReady && <CheckCircleSolid />}
        </h2>
        {!isOpen && paymentReady && (
          <PremiumActionButton
            compact
            text="Upravit"
            onClickAction={handleEdit}
            className={styles.editBtn}
            data-testid="edit-delivery-button"
          />
        )}
      </div>
      <div>
        <div className={isOpen ? styles.open : styles.closed}>
          {!paidByGiftcard && availablePaymentMethods?.length > 0 && (
            <>
              <div className={styles.methodIntro}>
                <span>Vyberte způsob úhrady</span>
                <p>
                  {hasComgate
                    ? "Volbou metody potvrzujete objednávku a přejdete rovnou k bezpečné platbě."
                    : "Platbu dokončíte bezpečně v následujícím kroku."}
                </p>
              </div>
              <RadioGroup
                className={styles.methodList}
                value={selectedPaymentMethod}
                onChange={(value: string) => void setPaymentMethod(value)}
                aria-label="Způsob platby"
              >
                {displayPaymentMethods.map((paymentMethod) => {
                  const methodInfo = paymentMethod.comgateMethod as
                    | ComgatePaymentMethod
                    | undefined
                  const paymentMethodInfo = methodInfo
                    ? {
                        title: methodInfo.name_short || methodInfo.name,
                        category:
                          methodInfo.groupLabel || "Bezpečná platba Comgate",
                        detail:
                          isLoading &&
                          selectedPaymentMethod === paymentMethod.id
                            ? "Otevíráme bezpečnou platbu…"
                            : methodInfo.description ||
                              "Klepnutím přejdete přímo k platbě.",
                        logo: getComgateMethodLogo(methodInfo),
                      }
                    : undefined

                  return isStripeFunc(paymentMethod.id) ? (
                    <StripeCardContainer
                      key={paymentMethod.id}
                      paymentProviderId={paymentMethod.id}
                      selectedPaymentOptionId={selectedPaymentMethod}
                      paymentInfoMap={paymentInfoMap}
                      setCardBrand={setCardBrand}
                      setError={setError}
                      setCardComplete={setCardComplete}
                    />
                  ) : (
                    <PaymentContainer
                      key={paymentMethod.id}
                      paymentInfoMap={paymentInfoMap}
                      paymentProviderId={paymentMethod.id}
                      selectedPaymentOptionId={selectedPaymentMethod}
                      paymentMethodInfo={paymentMethodInfo}
                      disabled={isLoading}
                      onSelectedAction={
                        isComgate(paymentMethod.id)
                          ? () => void openComgate(paymentMethod.id)
                          : undefined
                      }
                    />
                  )
                })}
              </RadioGroup>
            </>
          )}

          {paidByGiftcard && (
            <div className={styles.colThird}>
              <Text className={styles.sectionTitle}>Způsob platby</Text>
              <Text className={styles.sectionText}>Dárková karta</Text>
            </div>
          )}

          <div aria-live="polite">
            {isLoading && isComgate(selectedPaymentMethod) && (
              <p className={styles.paymentStatus}>
                Připravujeme zvolenou metodu a otevíráme Comgate…
              </p>
            )}
            <ErrorMessage
              error={error}
              data-testid="payment-method-error-message"
            />
          </div>

          {(paidByGiftcard ||
            (selectedPaymentMethod && !isComgate(selectedPaymentMethod))) && (
            <div className={styles.buttonRow}>
              <PremiumActionButton
                text={
                  !activeSession && isStripeFunc(selectedPaymentMethod)
                    ? "Zadat údaje o kartě"
                    : "Pokračovat k přehledu"
                }
                onClickAction={handleSubmit}
                className={styles.submitBtn}
                data-testid="submit-payment-button"
                disabled={
                  (isStripe && !cardComplete) ||
                  (!selectedPaymentMethod && !paidByGiftcard) ||
                  isLoading
                }
              />
            </div>
          )}
        </div>

        <div className={isOpen ? styles.closed : styles.open}>
          {cart && paymentReady && activeSession ? (
            <div className={styles.summaryRow}>
              <div className={styles.colThird}>
                <Text className={styles.sectionTitle}>Způsob platby</Text>
                <Text className={styles.sectionText}>
                  {activeComgateInfo?.name_short ||
                    activeComgateInfo?.name ||
                    paymentInfoMap[activeSession?.provider_id]?.title ||
                    activeSession?.provider_id}
                </Text>
              </div>
              <div className={styles.colThird}>
                <Text className={styles.sectionTitle}>Detaily platby</Text>
                <div className={styles.detailsRow}>
                  <Container className={styles.iconBox}>
                    {paymentInfoMap[selectedPaymentMethod]?.icon || (
                      <CreditCard />
                    )}
                  </Container>
                  <Text className={styles.sectionText}>
                    {isStripeFunc(selectedPaymentMethod) && cardBrand
                      ? cardBrand
                      : "Připraveno k dokončení"}
                  </Text>
                </div>
              </div>
            </div>
          ) : paidByGiftcard ? (
            <div className={styles.colThird}>
              <Text className={styles.sectionTitle}>Způsob platby</Text>
              <Text className={styles.sectionText}>Dárková karta</Text>
            </div>
          ) : null}
        </div>
      </div>
      <Divider className={styles.divider} />
    </div>
  )
}

export default Payment
