"use client"

import { RadioGroup } from "@headlessui/react"
import { isStripe as isStripeFunc, paymentInfoMap, isComgate } from "@lib/constants"
import { initiatePaymentSession, initComgateMetadata } from "@lib/data/cart"
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
    if (activeSession?.provider_id === "pp_comgate_comgate") {
       const method = (activeSession.data as any)?.method
       if (method === "BANK_ALL") return "pp_comgate_bank"
       if (method === "APPLEPAY") return "pp_comgate_applepay"
       if (method === "GOOGLEPAY") return "pp_comgate_googlepay"
       return "pp_comgate_card" 
    }
    return activeSession?.provider_id ?? ""
  })

  const displayPaymentMethods = useMemo(() => {
    return availablePaymentMethods.flatMap(pm => {
      if (pm.id === "pp_comgate_comgate") {
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
  const [comgateUrl, setComgateUrl] = useState<string>("")

  console.log("availablePaymentMethods:", availablePaymentMethods)
  console.log("CartID:", cart?.region?.id)
  console.log("CartObject:", cart)

  const setPaymentMethod = async (method: string) => {
    setError(null)
    setSelectedPaymentMethod(method)
    if (isStripeFunc(method)) {
      const response = await initiatePaymentSession(cart, {
        provider_id: method,
      })
      console.log("response:", response)
    }
    else if (isComgate(method)) {
      // Initialize Comgate payment session
      const firstName = cart?.billing_address?.first_name || cart?.shipping_address?.first_name || null
      const lastName = cart?.billing_address?.last_name || cart?.shipping_address?.last_name || null
      const email = cart?.email || null
      
      let comgateMethod = "ALL"
      if (method === "pp_comgate_card") comgateMethod = "CARD_ALL"
      if (method === "pp_comgate_bank") comgateMethod = "BANK_ALL"
      if (method === "pp_comgate_applepay") comgateMethod = "APPLEPAY"
      if (method === "pp_comgate_googlepay") comgateMethod = "GOOGLEPAY"

      const resp = await initiatePaymentSession(cart, {
        provider_id: "pp_comgate_comgate",
        // pass extra data so provider can use it directly
        data: {
          email,
          first_name: firstName,
          last_name: lastName,
          cart_id: cart.id,
          method: comgateMethod,
        } as any,
      })
      if ((resp as any)?.message) {
        setError((resp as any).message)
        return
      }

      // Send metadata to backend (cart metadata) so Comgate service can use them
      const init = await initComgateMetadata({
        cartId: cart.id,
        email,
        firstName,
        lastName,
      })
      if (!init.success) {
        console.warn("Failed to init Comgate metadata:", init.message)
      }
      console.log("Comgate initialized")
    }
  }


  // const handleComgatePay = async () => {
  //   setIsLoading(true)
  //   setError(null)
  //   try {
  //     const firstName = cart?.billing_address?.first_name || cart?.shipping_address?.first_name || null
  //     const lastName = cart?.billing_address?.last_name || cart?.shipping_address?.last_name || null
  //     const email = cart?.email || null

  //     const resp = await initiatePaymentSession(cart, {
  //       provider_id: selectedPaymentMethod,
  //       data: {
  //         email,
  //         first_name: firstName,
  //         last_name: lastName,
  //         cart_id: cart.id,
  //       } as any,
  //     })

  // const anyResp: any = resp
  // const url = anyResp?.url || anyResp?.payment_url || anyResp?.redirect_url || anyResp?.data?.url
  //     if (url) {
  //       setComgateUrl(url)
  //     } else if ((resp as any)?.message) {
  //       setError((resp as any).message)
  //     } else {
  //       setError("Nelze zahájit platbu Comgate. Zkuste to znovu.")
  //     }
  //   } catch (err: any) {
  //     console.error('Comgate init error', err)
  //     setError(err?.message || 'Chyba při inicializaci platby Comgate')
  //   } finally {
  //     setIsLoading(false)
  //   }
  // }
  const handleComgatePay = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const firstName = cart?.billing_address?.first_name || cart?.shipping_address?.first_name || null
      const lastName = cart?.billing_address?.last_name || cart?.shipping_address?.last_name || null
      const email = cart?.email || null

      let comgateMethod = "ALL"
      if (selectedPaymentMethod === "pp_comgate_card") comgateMethod = "CARD_ALL"
      if (selectedPaymentMethod === "pp_comgate_bank") comgateMethod = "BANK_ALL"
      if (selectedPaymentMethod === "pp_comgate_applepay") comgateMethod = "APPLEPAY"
      if (selectedPaymentMethod === "pp_comgate_googlepay") comgateMethod = "GOOGLEPAY"

      const resp = await initiatePaymentSession(cart, {
        provider_id: "pp_comgate_comgate",
        data: {
          email,
          first_name: firstName,
          last_name: lastName,
          cart_id: cart.id,
          method: comgateMethod
        } as any,
      })

  const anyResp: any = resp
  const url = anyResp?.url || anyResp?.payment_url || anyResp?.redirect_url || anyResp?.data?.url
      if (url) {
        setComgateUrl(url)
      } else if ((resp as any)?.message) {
        setError((resp as any).message)
      } else {
        setError("Nelze zahájit platbu Comgate. Zkuste to znovu.")
      }
    } catch (err: any) {
      console.error('Comgate init error', err)
      setError(err?.message || 'Chyba při inicializaci platby Comgate')
    } finally {
      setIsLoading(false)
    }
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

      const checkActiveSession =
        activeSession?.provider_id === selectedPaymentMethod


      if (!checkActiveSession) {
        // When creating session here, also include extra data for Comgate
        const isComgateSelected = isComgate(selectedPaymentMethod)
        const firstName = cart?.billing_address?.first_name || cart?.shipping_address?.first_name || null
        const lastName = cart?.billing_address?.last_name || cart?.shipping_address?.last_name || null
        const email = cart?.email || null
          await initiatePaymentSession(cart, {
          provider_id: "pp_comgate_comgate",
          ...(isComgateSelected
            ? {
                data: {
                  email,
                  first_name: firstName,
                  last_name: lastName,
                  method: selectedPaymentMethod === "pp_comgate_bank" ? "BANK_ALL" : 
                          selectedPaymentMethod === "pp_comgate_applepay" ? "APPLEPAY" :
                          selectedPaymentMethod === "pp_comgate_googlepay" ? "GOOGLEPAY" :
                          "CARD_ALL"
                } as any,
              }
            : {}),
        })
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

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (!event?.data) return;

      const { scope, action, value } = event.data;

      if (
        scope === "comgate-to-eshop" &&
        action === "status" &&
        value?.status
      ) {
        const { status, id, refId } = value;

        if (["PAID", "AUTHORIZED"].includes(status)) {
          // Např. rovnou zavoláš placeOrder()
          handleSubmit()
            .then(() => {
              console.log("Order placed after Comgate payment")
              // třeba redirect na thank you page
            })
            .catch(console.error);
        } else if (status === "CANCELLED") {
          // zobrazíš chybovou hlášku nebo zavřeš iframe
        }
      }
    }

    window.addEventListener("message", listener)
    return () => window.removeEventListener("message", listener)
  }, [])




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

          {/* Use ClickButton to keep consistent animated button UI */}
          <div className={styles.buttonRow}>
            {isComgate(selectedPaymentMethod) ? (
              <ClickButton
                text={comgateUrl ? 'Otevřít platbu' : 'Zaplatit přes Comgate'}
                onClickAction={handleComgatePay}
                className={styles.submitBtn}
                data-testid="submit-payment-button"
                disabled={!selectedPaymentMethod || isLoading}
              />
            ) : (
              <ClickButton
                text={!activeSession && isStripeFunc(selectedPaymentMethod) ? ' Zadat údaje o kartě' : 'Pokračovat k přehledu'}
                onClickAction={handleSubmit}
                className={styles.submitBtn}
                data-testid="submit-payment-button"
                disabled={(isStripe && !cardComplete) || (!selectedPaymentMethod && !paidByGiftcard) || isLoading}
              />
          )}
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

    {comgateUrl && (
      <div id="comgate-container">
    <iframe
      id="comgate-iframe"
      src={comgateUrl}
      allow="payment"
      frameBorder="0"
    />
  </div>
    )}
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
                        style={{ backgroundColor: "var(--OButton)" }}
                    >
                        <PerspectiveText label={text}/>
                    </div>
                    <div 
                        className={styles.el}
                        style={{ backgroundColor: "var(--CharcoalBg)" }}
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