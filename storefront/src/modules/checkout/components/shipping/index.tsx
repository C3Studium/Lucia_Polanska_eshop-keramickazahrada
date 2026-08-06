"use client"

import styles from "./style.module.scss"

import { RadioGroup, Radio } from "@headlessui/react"
import { setShippingMethod } from "@lib/data/cart"
import { calculatePriceForShippingOption } from "@lib/data/fulfillment"
import { convertToLocale } from "@lib/util/money"
import { CheckCircleSolid, Loader } from "@medusajs/icons"
import { HttpTypes, StoreOrderAddress } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import ErrorMessage from "@modules/checkout/components/error-message"
import Divider from "@modules/common/components/divider"
import MedusaRadio from "@modules/common/components/radio"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import PremiumActionButton from "@modules/common/components/premium-action-button"

const PICKUP_OPTION_ON = "__PICKUP_ON"
const PICKUP_OPTION_OFF = "__PICKUP_OFF"

type ShippingProps = {
  cart: HttpTypes.StoreCart
  availableShippingMethods: HttpTypes.StoreCartShippingOption[] | null
  packetaApiKey?: string
  packetaShippingMethodId?: string
}

function formatAddress(address: StoreOrderAddress | null): string {
  if (!address) {
    return ""
  }

  let ret = ""

  if (address.address_1) {
    ret += ` ${address.address_1}`
  }

  if (address.address_2) {
    ret += `, ${address.address_2}`
  }

  if (address.postal_code) {
    ret += `, ${address.postal_code} ${address.city}`
  }

  if (address.country_code) {
    ret += `, ${address.country_code.toUpperCase()}`
  }

  return ret
}

const getFulfillmentType = (
  option: HttpTypes.StoreCartShippingOption
): string | undefined => (option as any).service_zone?.fulfillment_set?.type

const Shipping: React.FC<ShippingProps> = ({
  cart,
  availableShippingMethods,
  packetaApiKey,
  packetaShippingMethodId,
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingPrices, setIsLoadingPrices] = useState(true)

  const [showPickupOptions, setShowPickupOptions] =
    useState<string>(PICKUP_OPTION_OFF)
  const [calculatedPricesMap, setCalculatedPricesMap] = useState<
    Record<string, number>
  >({})
  const [error, setError] = useState<string | null>(null)
  const [packetaPickupPointSelected, setPacketaPickupPointSelected] = useState<
    boolean | null
  >(false)
  const [packetaPickupPointInfo, setPacketaPickupPointInfo] = useState<
    string | null
  >(null)
  const [shippingMethodId, setShippingMethodId] = useState<string | null>(
    cart.shipping_methods?.at(-1)?.shipping_option_id || null
  )

  async function onPointSelected(pickupPoint: string) {
    const base = (process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "").replace(
      /\/+$/,
      ""
    )
    const url = `${base}/store/carts/${cart.id}`
    const metadataUrl = `${base}/store/carts/${cart.id}/metadata`

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-publishable-api-key":
            process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY?.toString() || "",
        },
        body: JSON.stringify({
          metadata: { packeta_pickup_point: pickupPoint },
        }),
      })

      if (!res.ok) {
        const body = await res.text().catch(() => "<unreadable>")
        console.error(
          "Failed to POST pickup metadata",
          res.status,
          res.statusText,
          body
        )
        setError("Nepodařilo se uložit místo vyzvednutí. Zkuste to znovu.")
        return
      }

      // optional: re-fetch metadata to confirm
      const md = await fetch(metadataUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-publishable-api-key":
            process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY?.toString() || "",
        },
      })
      if (!md.ok) {
        console.warn("Metadata GET returned", md.status, md.statusText)
      }

      setPacketaPickupPointSelected(true)
      setError(null)
    } catch (err: any) {
      console.error("Network error while saving pickup point:", err)
      setError("Došlo k síťové chybě při ukládání místa vyzvednutí.")
    }
  }

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const isOpen = searchParams.get("step") === "delivery"

  const _shippingMethods = useMemo(
    () =>
      availableShippingMethods?.filter(
        (option) => getFulfillmentType(option) !== "pickup"
      ),
    [availableShippingMethods]
  )

  const _pickupMethods = useMemo(
    () =>
      availableShippingMethods?.filter(
        (option) => getFulfillmentType(option) === "pickup"
      ),
    [availableShippingMethods]
  )

  const hasPickupOptions = !!_pickupMethods?.length

  useEffect(() => {
    setIsLoadingPrices(true)

    if (_shippingMethods?.length) {
      const promises = _shippingMethods
        .filter((sm) => sm.price_type === "calculated")
        .map((sm) => calculatePriceForShippingOption(sm.id, cart.id))

      if (promises.length) {
        Promise.allSettled(promises).then((res) => {
          const pricesMap: Record<string, number> = {}
          res
            .filter((r) => r.status === "fulfilled")
            .forEach((p) => (pricesMap[p.value?.id || ""] = p.value?.amount!))

          setCalculatedPricesMap(pricesMap)
          setIsLoadingPrices(false)
        })
      } else {
        setIsLoadingPrices(false)
      }
    } else {
      setIsLoadingPrices(false)
    }

    if (_pickupMethods?.find((m) => m.id === shippingMethodId)) {
      setShowPickupOptions(PICKUP_OPTION_ON)
    }
  }, [_pickupMethods, _shippingMethods, cart.id, shippingMethodId])

  // (removed debug logging)

  useEffect(() => {
    if (typeof window === "undefined") {
      console.warn(
        "Window is not defined, skipping Packeta widget initialization"
      )
      return
    }
    if ((window as any).Packeta?.Widget) {
      console.warn(
        "Packeta Widget is already loaded, skipping script injection"
      )
      return
    }
    let script = document.getElementById(
      "packeta-widget-script"
    ) as HTMLScriptElement | null
    if (!script) {
      script = document.createElement("script")
      script.id = "packeta-widget-script"
      script.src = "https://widget.packeta.com/v6/www/js/library.js"
      script.async = true
      document.body.appendChild(script)
    }
  }, [])

  const handleEdit = () => {
    router.push(pathname + "?step=delivery", { scroll: false })
  }

  const handleSubmit = () => {
    router.push(pathname + "?step=payment", { scroll: false })
  }

  const handleOpenWidget = () => {
    const key = packetaApiKey

    const packetaOptions = {
      language: "cs",
      valueFormat:
        '"Packeta",id,carrierId,carrierPickupPointId,name,city,street',
      view: "modal",
      vendors: [
        { country: "cz" },
        { country: "hu" },
        { country: "sk" },
        { country: "ro" },
        { country: "cz", group: "zbox" },
        { country: "sk", group: "zbox" },
        { country: "hu", group: "zbox" },
        { country: "pl" },
        { country: "ro", group: "zbox" },
      ],
    }

    function showSelectedPickupPoint(point: any) {
      try {
        const saveElement: any = document.querySelector(
          ".packeta-selector-value"
        )
        if (saveElement) {
          saveElement.innerText = ""
        } else {
          console.warn(".packeta-selector-value element not found in DOM")
        }

        if (point) {
          if (saveElement) {
            saveElement.innerText = "Address2: " + point.formatedValue
          }
          // store a normalized formatted value for confirmation UI
          try {
            const formatted = point.formatedValue || String(point)
            const normalize = (val: string) => {
              if (!val) return val
              const parts = val
                .split(",")
                .map((p: string) => p.trim())
                .filter(Boolean)

              // Heuristic 1: look for repeating city pattern like [.., city, street, city, street]
              for (let i = 0; i + 2 < parts.length; i++) {
                if (parts[i] === parts[i + 2]) {
                  return `${parts[i]}, ${parts[i + 1]}`
                }
              }

              // Heuristic 2: find a part that looks like a street (contains a digit or parentheses)
              for (let i = 1; i < parts.length; i++) {
                if (/\d/.test(parts[i]) || parts[i].includes("(")) {
                  const city = parts[i - 1] ?? parts[i]
                  const street = parts[i]
                  return `${city}, ${street}`
                }
              }

              // Fallback: return last two parts joined by comma, or the whole string
              if (parts.length >= 2) {
                return `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`
              }
              return val
            }

            setPacketaPickupPointInfo(normalize(formatted))
            setPacketaPickupPointSelected(true)
          } catch (e) {
            // ignore state set errors in odd environments
          }

          const parts = point.formatedValue.split(",")
          const number = parts[1]?.trim() // druhý prvek (index 1)
          onPointSelected(number)
        }
      } catch (err) {
        console.error("Error in showSelectedPickupPoint:", err)
      }
    }

    const open = () => {
      if (!(window as any).Packeta?.Widget) return
      if (!key) {
        console.error("PACKETA_API_KEY is not configured")
        setError("Výběr výdejního místa není nakonfigurovaný.")
        return
      }
      try {
        ;(window as any).Packeta.Widget.pick(
          key,
          showSelectedPickupPoint,
          packetaOptions
        )
      } catch (err) {
        console.error("Packeta.Widget.pick threw:", err)
      }
    }

    if (!(window as any).Packeta?.Widget) {
      console.warn("Widget is not loaded yet, will open when ready")
      let script = document.getElementById(
        "packeta-widget-script"
      ) as HTMLScriptElement | null
      if (!script) {
        script = document.createElement("script")
        script.id = "packeta-widget-script"
        script.src = "https://widget.packeta.com/v6/www/js/library.js"
        script.async = true
        document.body.appendChild(script)
      }
      script.addEventListener("load", () => open(), { once: true })
      script.addEventListener(
        "error",
        () => console.error("Failed to load Packeta widget script"),
        { once: true }
      )
      setError("Načítáme výběr výdejního místa…")
      return
    }

    open()
  }

  const handleSetShippingMethod = async (
    id: string,
    variant: "shipping" | "pickup"
  ) => {
    setError(null)

    if (variant === "pickup") {
      setShowPickupOptions(PICKUP_OPTION_ON)
    } else {
      setShowPickupOptions(PICKUP_OPTION_OFF)
    }
    let currentId: string | null = null
    setIsLoading(true)

    // If this is the special Packeta / Zásilkovna method, open the widget immediately
    if (id === packetaShippingMethodId?.toString()) {
      handleOpenWidget()
    } else {
      setPacketaPickupPointSelected(false)
    }

    setShippingMethodId((prev) => {
      currentId = prev
      return id
    })

    try {
      const res = await setShippingMethod({
        cartId: cart.id,
        shippingMethodId: id,
      })

      if (res?.success) return

      setShippingMethodId(currentId)
      setError(res?.message || "Způsob dopravy se nepodařilo uložit.")
    } catch {
      setShippingMethodId(currentId)
      setError("Způsob dopravy se nepodařilo uložit.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    setError(null)
  }, [isOpen])

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h2
          className={clx(styles.heading, {
            [styles.inactive]: !isOpen && cart.shipping_methods?.length === 0,
          })}
        >
          Doručení
          {!isOpen && (cart.shipping_methods?.length ?? 0) > 0 && (
            <CheckCircleSolid />
          )}
        </h2>
        {!isOpen &&
          cart?.shipping_address &&
          cart?.billing_address &&
          cart?.email && (
            <PremiumActionButton
              compact
              text="Upravit"
              onClickAction={handleEdit}
              className={styles.editBtn}
              data-testid="edit-delivery-button"
            />
          )}
      </div>

      {isOpen ? (
        <>
          <div className={styles.deliveryOptions}>
            <div className={styles.deliveryOptionsHeader}>
              <span className={clx(styles.radioLabel, "font-medium")}>
                Způsob dopravy:
              </span>
              <span className={clx(styles.radioAddress, "mb-4")}>
                Jak byste chtěli, aby byla vaše objednávka doručena?
              </span>
            </div>
            <div data-testid="delivery-options-container">
              <div className={styles.deliveryOptions}>
                {hasPickupOptions && (
                  <RadioGroup
                    value={showPickupOptions}
                    onChange={() => {
                      const id = _pickupMethods?.find(
                        (option) => !option.insufficient_inventory
                      )?.id
                      if (id) {
                        handleSetShippingMethod(id, "pickup")
                        return
                      }
                      // Otherwise the row just refuses to select, with nothing said.
                      setError(
                        "Osobní odběr teď není možný — na skladě není dost kusů."
                      )
                    }}
                  >
                    <Radio
                      value={PICKUP_OPTION_ON}
                      data-testid="delivery-option-radio"
                      className={clx(styles.radioRow, {
                        [styles.active]: showPickupOptions === PICKUP_OPTION_ON,
                      })}
                    >
                      <div className={styles.radioContent}>
                        <MedusaRadio
                          checked={showPickupOptions === PICKUP_OPTION_ON}
                        />
                        <span className={styles.radioLabel}>
                          Vyberte způsob vyzvednutí
                        </span>
                      </div>
                      <span className={styles.radioPrice}>-</span>
                    </Radio>
                  </RadioGroup>
                )}
                <RadioGroup
                  value={shippingMethodId}
                  onChange={(v) => v && handleSetShippingMethod(v, "shipping")}
                >
                  {_shippingMethods?.map((option) => {
                    const isDisabled =
                      option.price_type === "calculated" &&
                      !isLoadingPrices &&
                      typeof calculatedPricesMap[option.id] !== "number"
                    return (
                      <Radio
                        key={option.id}
                        value={option.id}
                        data-testid="delivery-option-radio"
                        disabled={isDisabled}
                        className={clx(styles.radioRow, {
                          [styles.active]: option.id === shippingMethodId,
                          [styles.disabled]: isDisabled,
                        })}
                      >
                        <div className={styles.radioContent}>
                          <MedusaRadio
                            checked={option.id === shippingMethodId}
                          />
                          <span className={styles.radioLabel}>
                            {option.name}
                          </span>
                        </div>
                        <span className={styles.radioPrice}>
                          {option.price_type === "flat" ? (
                            convertToLocale({
                              amount: option.amount!,
                              currency_code: cart?.currency_code,
                            })
                          ) : calculatedPricesMap[option.id] ? (
                            convertToLocale({
                              amount: calculatedPricesMap[option.id],
                              currency_code: cart?.currency_code,
                            })
                          ) : isLoadingPrices ? (
                            <Loader />
                          ) : (
                            "-"
                          )}
                        </span>
                      </Radio>
                    )
                  })}
                </RadioGroup>
              </div>
            </div>
          </div>

          {showPickupOptions === PICKUP_OPTION_ON && (
            <div className={styles.deliveryOptions}>
              {/* Same header treatment as „Způsob dopravy" above. Bare, the two spans ran
                  together as „ObchodVyberte si obchod poblíž vás" — invisible until the
                  pickup branch started rendering at all. */}
              <div className={styles.deliveryOptionsHeader}>
                <span className={clx(styles.radioLabel, "font-medium")}>
                  Obchod
                </span>
                <span className={clx(styles.radioAddress, "mb-4")}>
                  Vyberte si obchod poblíž vás
                </span>
              </div>
              <div data-testid="delivery-options-container">
                <div className={styles.deliveryOptions}>
                  <RadioGroup
                    value={shippingMethodId}
                    onChange={(v) => v && handleSetShippingMethod(v, "pickup")}
                  >
                    {_pickupMethods?.map((option) => {
                      return (
                        <Radio
                          key={option.id}
                          value={option.id}
                          disabled={option.insufficient_inventory}
                          data-testid="delivery-option-radio"
                          className={clx(styles.radioRow, {
                            [styles.active]: option.id === shippingMethodId,
                            [styles.disabled]: option.insufficient_inventory,
                          })}
                        >
                          <div className={styles.radioContent}>
                            <MedusaRadio
                              checked={option.id === shippingMethodId}
                            />
                            <div className={styles.methodSummary}>
                              <span className={styles.methodLabel}>
                                {option.name}
                              </span>
                              <span className={styles.methodText}>
                                {formatAddress(
                                  (option as any).service_zone?.fulfillment_set
                                    ?.location?.address
                                )}
                              </span>
                            </div>
                          </div>
                          <span className={styles.radioPrice}>
                            {convertToLocale({
                              amount: option.amount!,
                              currency_code: cart?.currency_code,
                            })}
                          </span>
                        </Radio>
                      )
                    })}
                  </RadioGroup>
                </div>
              </div>
            </div>
          )}

          <div className={styles.packetaSelector}></div>

          {/* If packeta shipping method is selected but no pickup point chosen, show notice and reopen button */}
          {shippingMethodId === packetaShippingMethodId?.toString() &&
            !packetaPickupPointSelected && (
              <div className={styles.packetaNotice}>
                <p className={styles.packetaNoticeText}>
                  Prosím, zvolte místo vyzvednutí v okně výdejního místa.
                </p>
                <PremiumActionButton
                  text="Znovu vybrat místo"
                  onClickAction={handleOpenWidget}
                  className={styles.openPacketaBtn}
                  data-testid="reopen-packeta-button"
                />
              </div>
            )}

          {/* Show confirmation of selected pickup point once chosen */}
          {shippingMethodId === packetaShippingMethodId?.toString() &&
            packetaPickupPointSelected &&
            packetaPickupPointInfo && (
              <div
                className={styles.packetaConfirmation}
                data-testid="packeta-confirmation"
              >
                <p className={styles.packetaConfirmationLabel}>
                  Vybrané výdejní místo:
                </p>
                <p className={styles.packetaConfirmationValue}>
                  {packetaPickupPointInfo}
                </p>
              </div>
            )}

          <div className={styles.actions}>
            <ErrorMessage
              error={error}
              data-testid="delivery-option-error-message"
            />
            <PremiumActionButton
              text="Pokračovat k platbě"
              onClickAction={handleSubmit}
              className={styles.divider}
              disabled={
                !cart.shipping_methods?.[0] ||
                (shippingMethodId === packetaShippingMethodId?.toString() &&
                  !packetaPickupPointSelected) ||
                isLoading
              }
              data-testid="submit-delivery-option-button"
            />
          </div>
        </>
      ) : (
        cart &&
        (cart.shipping_methods?.length ?? 0) > 0 && (
          <div className={styles.completedSummary}>
            <span className={styles.completedLabel}>Vybrané doručení</span>
            <div className={styles.completedMethod}>
              <strong>{cart.shipping_methods?.at(-1)?.name}</strong>
              <span>
                {convertToLocale({
                  amount: cart.shipping_methods?.at(-1)?.amount!,
                  currency_code: cart?.currency_code,
                })}
              </span>
            </div>
            <p>Dopravu můžete upravit až do potvrzení objednávky.</p>
          </div>
        )
      )}
      <Divider className={styles.divider} />
    </div>
  )
}

export default Shipping
