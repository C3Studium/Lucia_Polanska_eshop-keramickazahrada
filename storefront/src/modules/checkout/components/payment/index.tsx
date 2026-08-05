"use client"

import { RadioGroup } from "@headlessui/react"
import { isComgate, paymentInfoMap } from "@lib/constants"
import { initiatePaymentSession } from "@lib/data/cart"
import {
  legacyComgateOptionForMethod,
  toComgateOptionId,
  type ComgatePaymentMethod,
} from "@lib/util/comgate"
import { CheckCircleSolid, CreditCard } from "@medusajs/icons"
import { Container, Text, clx } from "@medusajs/ui"
import PremiumActionButton from "@modules/common/components/premium-action-button"
import ErrorMessage from "@modules/checkout/components/error-message"
import PaymentContainer from "@modules/checkout/components/payment-container"
import ComgatePaymentSelector from "@modules/common/components/comgate-payment-selector"
import Divider from "@modules/common/components/divider"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import styles from "./style.module.scss"

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
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(() => {
    if (isComgate(activeSession?.provider_id)) {
      return comgateMethods.some((method) => method.id === activeComgateMethod)
        ? toComgateOptionId(activeComgateMethod)
        : legacyComgateOptionForMethod(activeComgateMethod)
    }
    return activeSession?.provider_id ?? ""
  })

  const nonComgatePaymentMethods = useMemo(
    () => availablePaymentMethods.filter((provider) => !isComgate(provider.id)),
    [availablePaymentMethods]
  )

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const isOpen = searchParams.get("step") === "payment"
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

  /**
   * Picking a ComGate method no longer goes to the bank. It carries the choice to the Review
   * step, where the customer sees the recap and gives consent; the payment session is created
   * there, from the final action. Consent has to exist before the payment does.
   */
  const continueToReview = (optionId: string) => {
    if (isLoading || !optionId) return

    setSelectedPaymentMethod(optionId)
    setError(null)

    const params = new URLSearchParams(searchParams)
    params.set("step", "review")
    params.set("method", optionId)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const selectComgate = (optionId: string) => {
    if (isLoading) return
    setSelectedPaymentMethod(optionId)
    setError(null)
  }

  const setPaymentMethod = async (method: string) => {
    setError(null)
    setSelectedPaymentMethod(method)

    if (isComgate(method)) {
      continueToReview(method)
      return
    }

    const result = await initiatePaymentSession(cart, { provider_id: method })

    if (!result.success) {
      setError(result.message || "Platební metodu se nepodařilo připravit.")
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

      router.push(pathname + "?" + createQueryString("step", "review"), {
        scroll: false,
      })
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
                    ? "Vyberte metodu. V dalším kroku uvidíte celou objednávku a teprve pak přejdete k platbě."
                    : "Platbu dokončíte bezpečně v následujícím kroku."}
                </p>
              </div>
              {hasComgate && (
                <ComgatePaymentSelector
                  methods={comgateMethods}
                  selectedOptionId={selectedPaymentMethod}
                  onSelect={selectComgate}
                  onConfirm={() => continueToReview(selectedPaymentMethod)}
                  disabled={isLoading}
                  isSubmitting={isLoading}
                />
              )}

              {nonComgatePaymentMethods.length > 0 && (
                <RadioGroup
                  className={styles.methodList}
                  value={selectedPaymentMethod}
                  onChange={(value: string) => void setPaymentMethod(value)}
                  aria-label="Další způsoby platby"
                >
                  {nonComgatePaymentMethods.map((paymentMethod) => (
                    <PaymentContainer
                      key={paymentMethod.id}
                      paymentInfoMap={paymentInfoMap}
                      paymentProviderId={paymentMethod.id}
                      selectedPaymentOptionId={selectedPaymentMethod}
                      disabled={isLoading}
                    />
                  ))}
                </RadioGroup>
              )}
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
                text="Pokračovat k přehledu"
                onClickAction={handleSubmit}
                className={styles.submitBtn}
                data-testid="submit-payment-button"
                disabled={
                  (!selectedPaymentMethod && !paidByGiftcard) || isLoading
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
                    Připraveno k dokončení
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
