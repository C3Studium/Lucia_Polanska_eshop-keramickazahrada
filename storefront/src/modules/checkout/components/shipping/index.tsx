"use client"

import styles from "./style.module.scss"

import { RadioGroup, Radio } from "@headlessui/react"
import { mergeCartMetadata, setShippingMethod } from "@lib/data/cart"
import { calculatePriceForShippingOption } from "@lib/data/fulfillment"
import { convertToLocale } from "@lib/util/money"
import {
  deliveryAllowedUnder,
  restrictionNotice,
  restrictionRowHint,
  type DeliveryRestriction,
} from "@lib/util/fragile"
import {
  BALIKOVNA_WIDGET_ORIGIN,
  BALIKOVNA_WIDGET_URL,
  balikovnaPointFromMetadata,
  formatBalikovnaPoint,
  isBalikovnaOption,
  parsePickerResult,
  type BalikovnaPoint,
} from "@lib/util/balikovna"
import { CheckCircleSolid, Loader } from "@medusajs/icons"
import { HttpTypes, StoreOrderAddress } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import ErrorMessage from "@modules/checkout/components/error-message"
import Divider from "@modules/common/components/divider"
import MedusaRadio from "@modules/common/components/radio"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import PremiumActionButton from "@modules/common/components/premium-action-button"

type ShippingProps = {
  cart: HttpTypes.StoreCart
  availableShippingMethods: HttpTypes.StoreCartShippingOption[] | null
  packetaApiKey?: string
  packetaShippingMethodId?: string
  /** Set when the basket forces fragile carriage or collection — and why. */
  restriction?: DeliveryRestriction
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
  restriction = null,
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingPrices, setIsLoadingPrices] = useState(true)

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
  /* Balíkovna: vybrané výdejní místo přežívá v cart.metadata, takže návrat
     na krok dopravy (nebo reload) o něj nepřijde. */
  const [balikovnaPoint, setBalikovnaPoint] = useState<BalikovnaPoint | null>(
    () => balikovnaPointFromMetadata(cart.metadata as Record<string, unknown>)
  )
  const [balikovnaOpen, setBalikovnaOpen] = useState(false)

  async function onPointSelected(pickupPoint: string) {
    try {
      /* Server-side MERGE — a direct POST with partial metadata replaced the
         whole object and erased whatever the other checkout steps had saved
         (consent, zvolená záloha zakázky…). */
      await mergeCartMetadata({ packeta_pickup_point: pickupPoint }, cart.id)
      setPacketaPickupPointSelected(true)
      setError(null)
    } catch (err: any) {
      console.error("Network error while saving pickup point:", err)
      setError("Spojení vypadlo, výdejní místo se neuložilo. Zkuste to prosím znovu.")
    }
  }

  /* Uložení vybrané Balíkovny do košíku — stejná cesta jako u Packety, ale
     ve čtyřech polích: štítek potřebuje ZIP a NAME zvlášť (PSČ z adresy bývá
     jiné než PSČ provozovny — viz lib/util/balikovna.ts). */
  async function saveBalikovnaPoint(point: BalikovnaPoint) {
    try {
      // Same merge contract as Packeta above — never replace cart metadata.
      await mergeCartMetadata(
        {
          balikovna_point_id: point.id,
          balikovna_point_zip: point.zip,
          balikovna_point_name: point.name,
          balikovna_point_address: point.address,
        },
        cart.id
      )
      setError(null)
    } catch (err) {
      console.error("Network error while saving Balíkovna point:", err)
      setBalikovnaPoint(null)
      setError("Spojení vypadlo, Balíkovna se neuložila. Zkuste to prosím znovu.")
    }
  }

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const isOpen = searchParams.get("step") === "delivery"

  /* Widget hlásí výběr postMessage zprávou `pickerResult` (oficiální manuál
     Balíkovny) — posloucháme jen s otevřeným dialogem a jen zprávy z jejich
     originu, cokoliv jiného ignorujeme. */
  useEffect(() => {
    if (!balikovnaOpen) return

    const listener = (event: MessageEvent) => {
      if (event.origin !== BALIKOVNA_WIDGET_ORIGIN) return
      const point = parsePickerResult(event.data)
      if (!point) return
      setBalikovnaOpen(false)
      setBalikovnaPoint(point)
      void saveBalikovnaPoint(point)
    }

    window.addEventListener("message", listener)
    return () => window.removeEventListener("message", listener)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balikovnaOpen, cart.id])

  /*
   * One list, carriers first and collection last. It used to be two: the couriers here, and
   * Osobní odběr behind a „Vyberte způsob vyzvednutí" row that opened a second panel below.
   * That made a choice of the same kind — how do I get this — read as two unrelated
   * questions, and put the answer to one of them outside the component that asked it.
   */
  const deliveryOptions = useMemo(() => {
    const options = availableShippingMethods ?? []
    const isPickup = (option: HttpTypes.StoreCartShippingOption) =>
      getFulfillmentType(option) === "pickup"

    return [
      ...options.filter((option) => !isPickup(option)),
      ...options.filter(isPickup),
    ]
  }, [availableShippingMethods])

  useEffect(() => {
    setIsLoadingPrices(true)

    const promises = deliveryOptions
      .filter((sm) => sm.price_type === "calculated")
      .map((sm) => calculatePriceForShippingOption(sm.id, cart.id))

    if (!promises.length) {
      setIsLoadingPrices(false)
      return
    }

    Promise.allSettled(promises).then((res) => {
      const pricesMap: Record<string, number> = {}
      res
        .filter((r) => r.status === "fulfilled")
        .forEach((p) => (pricesMap[p.value?.id || ""] = p.value?.amount!))

      setCalculatedPricesMap(pricesMap)
      setIsLoadingPrices(false)
    })
  }, [deliveryOptions, cart.id])

  // (removed debug logging)

  /* The Packeta widget script loads ONLY when a Packeta option is actually on
     offer — it used to be injected for every checkout visitor, a third-party
     script paid for by people who could never use it. */
  const packetaOffered = useMemo(
    () =>
      Boolean(packetaShippingMethodId) &&
      deliveryOptions.some(
        (option: any) => option.id === packetaShippingMethodId?.toString()
      ),
    [deliveryOptions, packetaShippingMethodId]
  )
  useEffect(() => {
    if (typeof window === "undefined" || !packetaOffered) return
    if ((window as any).Packeta?.Widget) return
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
  }, [packetaOffered])

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
        setError("Výběr výdejního místa se nám nepovedlo spustit. Napište nám prosím.")
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
      setError("Ještě načítáme mapu výdejních míst, moment…")
      return
    }

    open()
  }

  const handleSetShippingMethod = async (
    id: string,
    behavior?: { advance?: boolean }
  ) => {
    setError(null)

    let currentId: string | null = null
    setIsLoading(true)

    // If this is the special Packeta / Zásilkovna method, open the widget immediately
    if (id === packetaShippingMethodId?.toString()) {
      handleOpenWidget()
    } else {
      setPacketaPickupPointSelected(false)
    }

    // Balíkovna: mapa výdejních míst se otevře hned s výběrem dopravy —
    // stejný okamžik jako u Packety, ať se chovají jednotně.
    if (
      isBalikovnaOption(deliveryOptions.find((option) => option.id === id)) &&
      !balikovnaPoint
    ) {
      setBalikovnaOpen(true)
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

      if (res?.success) {
        /* The pick was everything this option needed — advancing here spares
           the „Pokračovat k platbě" click that would buy nothing. Widget
           deliveries (Packeta, Balíkovna) still owe a pickup point, so they
           stay; the existing gating on the continue button keeps holding. */
        const chosen = deliveryOptions.find((option) => option.id === id)
        const needsWidget =
          id === packetaShippingMethodId?.toString() ||
          isBalikovnaOption(chosen)
        if (behavior?.advance && !needsWidget) {
          handleSubmit()
        }
        return
      }

      setShippingMethodId(currentId)
      setError(res?.message || "Dopravu se nepovedlo uložit. Zkuste to prosím znovu.")
    } catch {
      setShippingMethodId(currentId)
      setError("Dopravu se nepovedlo uložit. Zkuste to prosím znovu.")
    } finally {
      setIsLoading(false)
    }
  }

  /* Auto-advance is a POINTER convenience only. headless-ui's RadioGroup fires
     `onChange` for arrow-key navigation too, so without this flag the first
     arrow press would throw a keyboard user to the payment step mid-browse.
     A pointer press arms it; any key press disarms it before onChange runs. */
  const advanceOnPick = useRef(false)

  /* A single offered delivery is no decision: preselect it, once, so the step
     needs one click (continue) instead of two. Still rendered, still
     changeable. Never a widget option — preselecting Packeta/Balíkovna would
     pop a modal nobody asked for — and never one the restriction blocks. */
  const autoPicked = useRef(false)
  useEffect(() => {
    if (!isOpen || shippingMethodId || isLoading || autoPicked.current) return
    const hasCalculated = deliveryOptions.some(
      (option) => option.price_type === "calculated"
    )
    if (hasCalculated && isLoadingPrices) return

    const enabled = deliveryOptions.filter((option) => {
      const isPickup = getFulfillmentType(option) === "pickup"
      const hasNoPrice =
        option.price_type === "calculated" &&
        typeof calculatedPricesMap[option.id] !== "number"
      const blocked =
        Boolean(restriction) && !deliveryAllowedUnder(option, isPickup)
      return !hasNoPrice && !blocked && !option.insufficient_inventory
    })
    if (enabled.length !== 1) return

    const only = enabled[0]
    if (
      only.id === packetaShippingMethodId?.toString() ||
      isBalikovnaOption(only)
    ) {
      return
    }

    autoPicked.current = true
    void handleSetShippingMethod(only.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isOpen,
    shippingMethodId,
    isLoading,
    isLoadingPrices,
    deliveryOptions,
    calculatedPricesMap,
    restriction,
    packetaShippingMethodId,
  ])

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
                Kam a jak vám to máme poslat?
              </span>
            </div>
            {restriction && (
              <p className={styles.commissionNotice} role="status">
                {restrictionNotice[restriction]}
              </p>
            )}
            <div
              data-testid="delivery-options-container"
              onPointerDownCapture={() => {
                advanceOnPick.current = true
              }}
              onKeyDownCapture={() => {
                advanceOnPick.current = false
              }}
            >
              <div className={styles.deliveryOptions}>
                <RadioGroup
                  value={shippingMethodId}
                  aria-label="Způsob dopravy"
                  onChange={(v) => {
                    if (!v) return
                    const advance = advanceOnPick.current
                    advanceOnPick.current = false
                    void handleSetShippingMethod(v, { advance })
                  }}
                >
                  {deliveryOptions.map((option) => {
                    const isPickup = getFulfillmentType(option) === "pickup"
                    const address = isPickup
                      ? formatAddress(
                          (option as any).service_zone?.fulfillment_set?.location
                            ?.address
                        )
                      : ""
                    const hasNoPrice =
                      option.price_type === "calculated" &&
                      !isLoadingPrices &&
                      typeof calculatedPricesMap[option.id] !== "number"
                    const blockedByRestriction =
                      Boolean(restriction) &&
                      !deliveryAllowedUnder(option, isPickup)
                    const isDisabled =
                      hasNoPrice ||
                      blockedByRestriction ||
                      !!option.insufficient_inventory

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
                          <div className={styles.methodSummary}>
                            <span className={styles.methodLabel}>
                              {isBalikovnaOption(option) && (
                                <img
                                  src="/assets/img/balikovna.svg"
                                  alt=""
                                  width={18}
                                  height={18}
                                  className={styles.carrierIcon}
                                />
                              )}
                              {option.name}
                            </span>
                            {address && (
                              <span className={styles.methodText}>
                                {address}
                              </span>
                            )}
                            {blockedByRestriction && restriction && (
                              <span className={styles.methodText}>
                                {restrictionRowHint[restriction]}
                              </span>
                            )}
                            {!blockedByRestriction &&
                              option.insufficient_inventory && (
                                <span className={styles.methodText}>
                                  Tolik kusů bohužel nemáme
                                </span>
                              )}
                          </div>
                        </div>
                        <span className={styles.radioPrice}>
                          {option.price_type === "flat" ? (
                            convertToLocale({
                              amount: option.amount!,
                              currency_code: cart?.currency_code,
                            })
                          ) : typeof calculatedPricesMap[option.id] ===
                            "number" ? (
                            // `0` is a real price (doprava zdarma), not a
                            // missing one — the old truthiness check showed „-".
                            convertToLocale({
                              amount: calculatedPricesMap[option.id],
                              currency_code: cart?.currency_code,
                            })
                          ) : isLoadingPrices ? (
                            <>
                              <Loader aria-hidden="true" />
                              <span className="sr-only">Počítáme cenu…</span>
                            </>
                          ) : (
                            <span aria-label="Cena zatím není známa">-</span>
                          )}
                        </span>
                      </Radio>
                    )
                  })}
                </RadioGroup>
              </div>
            </div>
          </div>

          {/* Balíkovna: bez vybraného místa se nedá pokračovat — štítek by
              neměl kam jet. Stejný vzor jako Packeta níže. */}
          {(() => {
            const selectedOption = deliveryOptions.find(
              (option) => option.id === shippingMethodId
            )
            if (!isBalikovnaOption(selectedOption)) return null
            return !balikovnaPoint ? (
              <div className={styles.packetaNotice}>
                <p className={styles.packetaNoticeText}>
                  Vyberte prosím Balíkovnu, kam vám balík pošleme.
                </p>
                <PremiumActionButton
                  text="Vybrat Balíkovnu"
                  onClickAction={() => setBalikovnaOpen(true)}
                  className={styles.openPacketaBtn}
                  data-testid="open-balikovna-button"
                />
              </div>
            ) : (
              <div
                className={styles.packetaConfirmation}
                data-testid="balikovna-confirmation"
              >
                <p className={styles.packetaConfirmationLabel}>
                  Vybraná Balíkovna:
                </p>
                <p className={styles.packetaConfirmationValue}>
                  {formatBalikovnaPoint(balikovnaPoint)}
                  {balikovnaPoint.address
                    ? ` · ${balikovnaPoint.address}`
                    : ""}
                </p>
                <button
                  type="button"
                  className={styles.balikovnaChange}
                  onClick={() => setBalikovnaOpen(true)}
                >
                  Změnit Balíkovnu
                </button>
              </div>
            )
          })()}

          {balikovnaOpen && (
            <div
              className={styles.balikovnaModal}
              role="dialog"
              aria-modal="true"
              aria-label="Výběr Balíkovny"
            >
              <button
                type="button"
                className={styles.balikovnaBackdrop}
                aria-label="Zavřít výběr Balíkovny"
                onClick={() => setBalikovnaOpen(false)}
              />
              <div className={styles.balikovnaPanel}>
                <div className={styles.balikovnaPanelHeader}>
                  <span>Vyberte svou Balíkovnu</span>
                  <button
                    type="button"
                    onClick={() => setBalikovnaOpen(false)}
                    aria-label="Zavřít"
                  >
                    ×
                  </button>
                </div>
                {/* Oficiální dialog ČP; allow="geolocation" kvůli funkci
                    „Moje poloha" (bez něj ji prohlížeč zablokuje). */}
                <iframe
                  title="Výběr místa pro vyzvednutí zásilky"
                  src={BALIKOVNA_WIDGET_URL}
                  allow="geolocation"
                  className={styles.balikovnaFrame}
                />
              </div>
            </div>
          )}

          {/* If packeta shipping method is selected but no pickup point chosen, show notice and reopen button */}
          {shippingMethodId === packetaShippingMethodId?.toString() &&
            !packetaPickupPointSelected && (
              <div className={styles.packetaNotice}>
                <p className={styles.packetaNoticeText}>
                  Vyberte prosím výdejní místo v mapě.
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
                (isBalikovnaOption(
                  deliveryOptions.find(
                    (option) => option.id === shippingMethodId
                  )
                ) &&
                  !balikovnaPoint) ||
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
            <p>Dopravu můžete změnit, dokud objednávku nepotvrdíte.</p>
          </div>
        )
      )}
      <Divider className={styles.divider} />
    </div>
  )
}

export default Shipping
