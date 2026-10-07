"use client"

import { createPortal } from "react-dom"
import { useEffect, useState, useTransition } from "react"
import {
  changeOrderDelivery,
  type DeliveryAddressInput,
  type OrderDeliveryContext,
} from "@lib/data/order-edit"
import {
  BALIKOVNA_WIDGET_ORIGIN,
  BALIKOVNA_WIDGET_URL,
  formatBalikovnaPoint,
  parsePickerResult,
  type BalikovnaPoint,
} from "@lib/util/balikovna"
import Input from "@modules/common/components/input"
import PhoneInput from "@modules/common/components/phone-input"
import Modal from "@modules/common/components/modal"
import styles from "./style.module.scss"

/**
 * Změna cíle doručení na stránce úpravy objednávky (self-service z e-mailu).
 *
 * Renderuje se jen pro dopravu, u které má změna smysl:
 *  - `balikovna` → tlačítko otevře oficiální widget ČP (iframe v portálu) a
 *    vybrané místo pošle backendu (kind "balikovna"),
 *  - `home` → tlačítko otevře popup s předvyplněnou adresou; po uložení ji
 *    pošle (kind "address").
 * Pro `pickup`/`other` se komponenta vůbec nevykresluje (řeší to volající).
 * Server je soudce — po úspěchu stav jen optimisticky srovnáme a potvrdíme.
 */
export default function OrderDeliverySection({
  orderId,
  token,
  delivery,
}: {
  orderId: string
  token: string
  delivery: OrderDeliveryContext
}) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Optimistické zrcadlo aktuálního cíle — po úspěchu ukážeme nový rovnou.
  const [point, setPoint] = useState<BalikovnaPoint | null>(
    delivery.pickup_point
      ? {
          id: delivery.pickup_point.id,
          zip: delivery.pickup_point.zip,
          name: delivery.pickup_point.name,
          address: delivery.pickup_point.address,
        }
      : null
  )
  const [address, setAddress] = useState<DeliveryAddressInput | null>(
    delivery.shipping_address
  )

  const [widgetOpen, setWidgetOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)

  const emptyForm: DeliveryAddressInput = {
    first_name: "",
    last_name: "",
    address_1: "",
    address_2: "",
    city: "",
    postal_code: "",
    country_code: address?.country_code || "cz",
    phone: "",
  }
  const [form, setForm] = useState<DeliveryAddressInput>(address ?? emptyForm)

  const submitPoint = (picked: BalikovnaPoint) =>
    startTransition(async () => {
      setError(null)
      setResult(null)
      const outcome = await changeOrderDelivery(orderId, token, {
        kind: "balikovna",
        point: picked,
      })
      if ("error" in outcome) {
        setError(outcome.error)
        return
      }
      setPoint(picked)
      setResult("Doručení jsme změnili.")
    })

  /* Widget hlásí výběr postMessage zprávou `pickerResult` z originu ČP —
     posloucháme jen s otevřeným dialogem a jen zprávy odtud (stejný vzor jako
     krok dopravy v pokladně). */
  useEffect(() => {
    if (!widgetOpen) return
    const listener = (event: MessageEvent) => {
      if (event.origin !== BALIKOVNA_WIDGET_ORIGIN) return
      const picked = parsePickerResult(event.data)
      if (!picked) return
      setWidgetOpen(false)
      submitPoint(picked)
    }
    window.addEventListener("message", listener)
    return () => window.removeEventListener("message", listener)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetOpen])

  const handleField = (e: { target: { name: string; value: string } }) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const openForm = () => {
    setForm(address ?? emptyForm)
    setError(null)
    setResult(null)
    setFormOpen(true)
  }

  const formValid =
    form.first_name.trim() &&
    form.last_name.trim() &&
    form.address_1.trim() &&
    form.city.trim() &&
    form.postal_code.trim()

  const submitAddress = () =>
    startTransition(async () => {
      setError(null)
      setResult(null)
      const payload: DeliveryAddressInput = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        address_1: form.address_1.trim(),
        address_2: form.address_2.trim(),
        city: form.city.trim(),
        postal_code: form.postal_code.trim(),
        country_code: address?.country_code || "cz",
        phone: form.phone.trim(),
      }
      const outcome = await changeOrderDelivery(orderId, token, {
        kind: "address",
        address: payload,
      })
      if ("error" in outcome) {
        setError(outcome.error)
        return
      }
      setAddress(payload)
      setFormOpen(false)
      setResult("Doručení jsme změnili.")
    })

  const addressLine = (a: DeliveryAddressInput) =>
    [a.address_1, a.address_2, `${a.postal_code} ${a.city}`.trim()]
      .filter((part) => part && part.trim())
      .join(", ")

  return (
    <div className={styles.box}>
      <h3 className={styles.title}>Doručení</h3>

      {delivery.method === "balikovna" ? (
        <>
          <p className={styles.note}>
            {point ? (
              <>
                Výdejna: <strong>{formatBalikovnaPoint(point)}</strong>
                {point.address ? ` · ${point.address}` : ""}
              </>
            ) : (
              "Výdejní místo zatím nevybrané."
            )}
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondary}
              disabled={pending}
              onClick={() => {
                setError(null)
                setResult(null)
                setWidgetOpen(true)
              }}
            >
              {pending ? "Ukládám…" : "Změnit výdejní místo"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className={styles.note}>
            {address ? (
              <>
                Adresa: <strong>{addressLine(address)}</strong>
              </>
            ) : (
              "Adresa zatím nevyplněná."
            )}
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondary}
              disabled={pending}
              onClick={openForm}
            >
              {pending ? "Ukládám…" : "Změnit adresu"}
            </button>
          </div>
        </>
      )}

      {error && <p className={styles.error}>{error}</p>}
      {result && <p className={styles.note}>{result}</p>}

      {/* Balíkovna: oficiální dialog ČP v portálu na document.body — stejný
          důvod jako v pokladně (fixed se nesmí kotvit do transformovaného
          předka). allow="geolocation" kvůli funkci „Moje poloha". */}
      {widgetOpen &&
        createPortal(
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
              onClick={() => setWidgetOpen(false)}
            />
            <div className={styles.balikovnaPanel}>
              <div className={styles.balikovnaPanelHeader}>
                <span>Vyberte svou Balíkovnu</span>
                <button
                  type="button"
                  onClick={() => setWidgetOpen(false)}
                  aria-label="Zavřít"
                >
                  ×
                </button>
              </div>
              <iframe
                title="Výběr místa pro vyzvednutí zásilky"
                src={BALIKOVNA_WIDGET_URL}
                allow="geolocation"
                className={styles.balikovnaFrame}
              />
            </div>
          </div>,
          document.body
        )}

      {/* Pošta domů: adresa se mění v popupu předvyplněném z aktuální adresy. */}
      <Modal
        isOpen={formOpen}
        close={() => setFormOpen(false)}
        data-testid="delivery-address-modal"
      >
        <Modal.Title>Změna doručovací adresy</Modal.Title>
        <Modal.Body>
          <div className={styles.deliveryForm}>
            <Input
              variant="contact"
              label="Jméno"
              name="first_name"
              autoComplete="given-name"
              value={form.first_name}
              onChange={handleField}
              required
            />
            <Input
              variant="contact"
              label="Příjmení"
              name="last_name"
              autoComplete="family-name"
              value={form.last_name}
              onChange={handleField}
              required
            />
            <Input
              variant="contact"
              label="Adresa"
              name="address_1"
              autoComplete="address-line1"
              value={form.address_1}
              onChange={handleField}
              required
              className={styles.deliveryFormWide}
            />
            <Input
              variant="contact"
              label="Bytová jednotka, patro, apod."
              name="address_2"
              autoComplete="address-line2"
              value={form.address_2}
              onChange={handleField}
              className={styles.deliveryFormWide}
            />
            <Input
              variant="contact"
              label="PSČ"
              name="postal_code"
              autoComplete="postal-code"
              inputMode="numeric"
              value={form.postal_code}
              onChange={handleField}
              required
            />
            <Input
              variant="contact"
              label="Město"
              name="city"
              autoComplete="address-level2"
              value={form.city}
              onChange={handleField}
              required
            />
            <PhoneInput
              variant="contact"
              label="Telefon"
              name="phone"
              value={form.phone}
              onChange={handleField}
              className={styles.deliveryFormWide}
            />
          </div>
          {error && <p className={styles.error}>{error}</p>}
        </Modal.Body>
        <Modal.Footer>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => setFormOpen(false)}
            >
              Zrušit
            </button>
            <button
              type="button"
              className={styles.primary}
              disabled={pending || !formValid}
              onClick={submitAddress}
            >
              {pending ? "Ukládám…" : "Uložit adresu"}
            </button>
          </div>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
