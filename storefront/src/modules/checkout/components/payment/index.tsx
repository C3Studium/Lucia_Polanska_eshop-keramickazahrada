"use client"

import { RadioGroup } from "@headlessui/react"
import { isStripe as isStripeFunc, paymentInfoMap, isComgate } from "@lib/constants"
import { initiatePaymentSession } from "@lib/data/cart"
import { CheckCircleSolid, CreditCard } from "@medusajs/icons"
import { Container, Text, clx } from "@medusajs/ui"
import ErrorMessage from "@modules/checkout/components/error-message"
import PaymentContainer, {
  StripeCardContainer,
} from "@modules/checkout/components/payment-container"
import Divider from "@modules/common/components/divider"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState, useMemo } from "react"
import styles from "./style.module.scss"
import { useFormStatus } from "react-dom"

import { motion } from "framer-motion"

const Payment = ({
  cart,
  availablePaymentMethods,
}: {
  cart: any
  availablePaymentMethods: any[]
}) => {
  const activeSession = cart.payment_collection?.payment_sessions?.find(
    (paymentSession: any) => paymentSession.status === "pending"
  )

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cardBrand, setCardBrand] = useState<string | null>(null)
  const [cardComplete, setCardComplete] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(() => {
    if (isComgate(activeSession?.provider_id)) {
       const method = (activeSession?.data as any)?.method
       if (method === "BANK_ALL") return "pp_comgate_bank"
       if (method === "APPLEPAY_REDIRECT" || method === "APPLEPAY") return "pp_comgate_applepay"
       if (method === "GOOGLEPAY_REDIRECT" || method === "GOOGLEPAY") return "pp_comgate_googlepay"
       return "pp_comgate_card" 
    }
    return activeSession?.provider_id ?? ""
  })

  const displayPaymentMethods = useMemo(() => {
    console.log("[Payment] availablePaymentMethods:", availablePaymentMethods?.map(pm => pm.id))
    return availablePaymentMethods.flatMap(pm => {
      // Match any comgate provider (pp_comgate_comgate, comgate, etc.)
      if (isComgate(pm.id)) {
        console.log("[Payment] Expanding comgate provider:", pm.id)
        return [
           { id: "pp_comgate_card" },
           { id: "pp_comgate_applepay" },
           { id: "pp_comgate_googlepay" },
           { id: "pp_comgate_bank" }
        ]
      }
      return pm
    })
  }, [availablePaymentMethods])

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const isOpen = searchParams.get("step") === "payment"

  const isStripe = isStripeFunc(selectedPaymentMethod)


  console.log("availablePaymentMethods:", availablePaymentMethods)
  console.log("CartID:", cart?.region?.id)
  console.log("CartObject:", cart)

  // Select payment method - for Comgate, just set state (like Manual Payment).
  // The actual Comgate session is created only when the "Zaplatit" button is clicked.
  const setPaymentMethod = async (method: string) => {
    setError(null)
    setSelectedPaymentMethod(method)
    if (isStripeFunc(method)) {
      const response = await initiatePaymentSession(cart, {
        provider_id: method,
      })
      console.log("response:", response)
    }
    // For Comgate and Manual: do NOTHING on select, just like Manual Payment works.
  }




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

  const handleSubmit = async () => {
    setIsLoading(true)
    try {
      const shouldInputCard =
        isStripeFunc(selectedPaymentMethod) && !activeSession

      // For comgate virtual IDs, check if active session is already a comgate session
      const checkActiveSession = isComgate(selectedPaymentMethod)
        ? isComgate(activeSession?.provider_id)
        : activeSession?.provider_id === selectedPaymentMethod

      if (!checkActiveSession || isComgate(selectedPaymentMethod)) {
        // Always recreate Comgate sessions so the correct method is sent to Comgate gateway
        if (isComgate(selectedPaymentMethod)) {
          // Comgate: create session with method data, just like Manual creates session
          let comgateMethod = "ALL"
          if (selectedPaymentMethod === "pp_comgate_card") comgateMethod = "CARD_ALL"
          if (selectedPaymentMethod === "pp_comgate_bank") comgateMethod = "BANK_ALL"
          if (selectedPaymentMethod === "pp_comgate_applepay") comgateMethod = "APPLEPAY_REDIRECT"
          if (selectedPaymentMethod === "pp_comgate_googlepay") comgateMethod = "GOOGLEPAY_REDIRECT"

          const email = cart?.email || null
          const firstName = cart?.billing_address?.first_name || cart?.shipping_address?.first_name || null
          const lastName = cart?.billing_address?.last_name || cart?.shipping_address?.last_name || null

          console.log("[Comgate] Creating session with method:", comgateMethod)
          await initiatePaymentSession(cart, {
            provider_id: "pp_comgate_comgate",
            data: {
              email,
              first_name: firstName,
              last_name: lastName,
              cart_id: cart.id,
              method: comgateMethod,
            } as any,
          })
        } else {
          // Manual, Stripe, etc.
          await initiatePaymentSession(cart, {
            provider_id: selectedPaymentMethod,
          })
        }
      }

      if (!shouldInputCard) {
        return router.push(
          pathname + "?" + createQueryString("step", "review"),
          {
            scroll: false,
          }
        )
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    setError(null)
  }, [isOpen])






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
          <ClickButton
            text="Upravit"
            onClickAction={handleEdit}
            className={styles.editBtn}
            data-testid="edit-delivery-button"
          />
        )}
      </div>
      <div>
        <div className={isOpen ? styles.open : styles.closed}>
          {!paidByGiftcard && availablePaymentMethods?.length && (
            <>
              <RadioGroup
                value={selectedPaymentMethod}
                onChange={(value: string) => setPaymentMethod(value)}
              >
                {displayPaymentMethods.map((paymentMethod) => (
                  <div key={paymentMethod.id}>
                    {isStripeFunc(paymentMethod.id) ? (
                      <StripeCardContainer
                        paymentProviderId={paymentMethod.id}
                        selectedPaymentOptionId={selectedPaymentMethod}
                        paymentInfoMap={paymentInfoMap}
                        setCardBrand={setCardBrand}
                        setError={setError}
                        setCardComplete={setCardComplete}
                      />
                    ) : (
                      <PaymentContainer
                        paymentInfoMap={paymentInfoMap}
                        paymentProviderId={paymentMethod.id}
                        selectedPaymentOptionId={selectedPaymentMethod}
                      />
                    )}
                  </div>
                ))}
              </RadioGroup>
            </>
          )}

          {paidByGiftcard && (
            <div className={styles.colThird}>
              <Text className={styles.sectionTitle}>
                Způsob platby
              </Text>
              <Text className={styles.sectionText} data-testid="payment-method-summary">
                Dárková karta
              </Text>
            </div>
          )}

          <ErrorMessage
            error={error}
            data-testid="payment-method-error-message"
          />

          {/* Same button for ALL methods - select method, then continue to review */}
          <div className={styles.buttonRow}>
            <ClickButton
              text={!activeSession && isStripeFunc(selectedPaymentMethod) ? 'Zadat údaje o kartě' : 'Pokračovat k přehledu'}
              onClickAction={handleSubmit}
              className={styles.submitBtn}
              data-testid="submit-payment-button"
              disabled={(isStripe && !cardComplete) || (!selectedPaymentMethod && !paidByGiftcard) || isLoading}
            />
          </div>
        </div>

        <div className={isOpen ? styles.closed : styles.open}>
          {cart && paymentReady && activeSession ? (
            <div className={styles.summaryRow}>
              <div className={styles.colThird}>
                <Text className={styles.sectionTitle}>
                  Způsob platby
                </Text>
                <Text className={styles.sectionText} data-testid="payment-method-summary">
                  {paymentInfoMap[activeSession?.provider_id]?.title ||
                    activeSession?.provider_id}
                </Text>
              </div>
              <div className={styles.colThird}>
                <Text className={styles.sectionTitle}>
                  Detaily platby
                </Text>
                <div className={styles.detailsRow} data-testid="payment-details-summary">
                  <Container className={styles.iconBox}>
                    {paymentInfoMap[selectedPaymentMethod]?.icon || (
                      <CreditCard />
                    )}
                  </Container>
                  <Text className={styles.sectionText}>
                    {isStripeFunc(selectedPaymentMethod) && cardBrand
                      ? cardBrand
                      : "Další krok se objeví"}
                  </Text>
                </div>
              </div>
            </div>
          ) : paidByGiftcard ? (
            <div className={styles.colThird}>
              <Text className={styles.sectionTitle}>
                Způsob platby
              </Text>
              <Text className={styles.sectionText} data-testid="payment-method-summary">
                Dárková karta
              </Text>
            </div>
          ) : null}
        </div>
      </div>
      <Divider className={styles.divider} />


    </div>
  )
}

export default Payment


type ClickButtonProps = {
    text: string;
    onClickAction?: () => void | Promise<void>;
    ClickAction?: () => void | Promise<void>; // backward compatibility
    disabled?: boolean;
    type?: "button" | "submit";
    className?: string;
    "data-testid"?: string;
}

// Base animated button used across the site. Can act as a submit button in forms.
function ClickButton({ onClickAction, ClickAction, disabled = false, text, type = "button", className, "data-testid": dataTestId }: ClickButtonProps) {
    const [ isActive , setIsActive ] = useState<boolean>(false);
    const { pending } = useFormStatus();
    const isSubmitting = type === "submit" ? pending : false;
    const isDisabled = disabled || isSubmitting;
    const handleClick = onClickAction ?? ClickAction;

    return (
        <div className={className ? `${styles.ClickButton} ${className}` : styles.ClickButton}>
            <button 
                type={type}
                className={styles.button}
                onClick={handleClick}
                disabled={isDisabled}
                aria-busy={isDisabled || undefined}
                onMouseEnter={() => setIsActive(true)}
                onMouseLeave={() => setIsActive(false)}
                data-testid={dataTestId}
            >
                <motion.div 
                    className={styles.slider}
                    animate={{top: isActive ? "-100%" : "0%"}}
                    transition={{ duration: 0.5, type: "tween", ease: [0.76, 0, 0.24, 1]}}
                >
                    <div 
                        className={styles.el}
                        style={{ backgroundColor: "var(--darkOlive)" }}
                    >
                        <PerspectiveText label={text}/>
                    </div>
                    <div 
                        className={styles.el}
                        style={{ backgroundColor: "var(--bgBlack)" }}
                    >
                        <PerspectiveText label={text} />
                    </div>
                </motion.div>
            </button>
        </div>
    )
}

function PerspectiveText({label}: {label: string}) {
    return (    
        <div className={styles.perspectiveText}>
            <p>{label}</p>
            <p>{label}</p>
        </div>
    )
}