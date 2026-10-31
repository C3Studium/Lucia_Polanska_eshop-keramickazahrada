"use client"

import { useState } from "react"

import { setGiftVoucherLine } from "@lib/data/cart"
import { convertToLocale } from "@lib/util/money"
import { VOUCHER_LINE_KEYS } from "@lib/util/gift-voucher-code"
import {
  GIFT_VOUCHER_SETUP_ID,
  giftVoucherLinesOf,
  voucherLineAmount,
  voucherLineKind,
  voucherLineNeedsSetup,
} from "@lib/util/gift-voucher-setup"
import {
  checkVoucherAmount,
  isCustomAmountVoucher,
  voucherConfig,
} from "@lib/util/voucher-amount"
import GiftVoucherForm, {
  EMPTY_GIFT_VOUCHER_FORM,
  giftVoucherFormError,
  type GiftVoucherFormValue,
} from "@modules/products/components/gift-voucher-form"
import VoucherAmountField from "@modules/products/components/voucher-amount"
import type { HttpTypes } from "@medusajs/types"

import s from "./style.module.scss"

/**
 * Nastavení dárkového poukazu — pod souhrnem v košíku (30. 10. 2026).
 *
 * Dřív se hodnota, podoba a obdarovaný vyplňovali na stránce produktu, pod
 * cenou. Zákazník tak musel projít pět polí dřív, než vůbec věděl, že poukaz
 * chce, a dva poukazy pro dva lidi znamenaly projít je dvakrát. Teď se poukaz
 * jen přidá do košíku a nastaví se tady, vedle částky, které se to týká —
 * každý poukaz ve vlastní kartě pod sebou.
 *
 * Dokud zůstane nenastavený, košík k pokladně nepustí (`Summary`,
 * `CheckoutBar`); poslední slovo má backend (`giftVoucherSetupProblem`).
 */

type CartLike = HttpTypes.StoreCart

/**
 * Nastavení JEDNOHO poukazu, k vykreslení přímo pod jeho řádkem v košíku
 * (31. 10. 2026).
 *
 * Dřív stálo celé nastavení v pravém sloupci pod souhrnem. Tam se ale
 * nevešlo — sloupec je úzký a lepkavý, takže u poukazu s vlastní částkou
 * přetékal mimo obrazovku a nešel dorolovat. A hlavně: patří k té položce,
 * ne k souhrnu, takže pod ní je i logicky doma.
 */
export function GiftVoucherLineSetup({
  line,
  currencyCode,
}: {
  line: HttpTypes.StoreCartLineItem
  currencyCode: string
}) {
  return (
    <div className={s.inline} data-testid="gift-voucher-line-setup">
      <VoucherCard
        /* Po uložení přijde položka s novými metadaty — jiný klíč = karta
           se nasadí znovu a políčka ukážou, co je opravdu uložené. */
        key={`${line.id}:${JSON.stringify(line.metadata ?? {})}`}
        line={line}
        currencyCode={currencyCode}
        position={null}
      />
    </div>
  )
}

export default function GiftVoucherSetup({ cart }: { cart: CartLike }) {
  const lines = giftVoucherLinesOf(cart as never) as HttpTypes.StoreCartLineItem[]
  if (!lines.length) return null

  return (
    <section
      id={GIFT_VOUCHER_SETUP_ID}
      className={s.root}
      aria-label="Nastavení dárkového poukazu"
      data-testid="gift-voucher-setup"
    >
      <p className={s.eyebrow}>Ještě jedna věc</p>
      <h2 className={s.title}>
        {lines.length > 1 ? "Dárkové poukazy" : "Dárkový poukaz"}
      </h2>
      <p className={s.lede}>
        {lines.length > 1
          ? "U každého poukazu zvolte hodnotu a podobu. Bez toho nejde pokračovat k pokladně."
          : "Zvolte hodnotu a podobu poukazu. Bez toho nejde pokračovat k pokladně."}
      </p>

      <div className={s.cards}>
        {lines.map((line, index) => (
          <VoucherCard
            /* Po uloženi přijde položka s novými metadaty — jiný klíč = karta
               se nasadí znovu a políčka ukážou, co je opravdu uložené. */
            key={`${line.id}:${JSON.stringify(line.metadata ?? {})}`}
            line={line}
            currencyCode={cart.currency_code}
            position={lines.length > 1 ? index + 1 : null}
          />
        ))}
      </div>
    </section>
  )
}

function VoucherCard({
  line,
  currencyCode,
  position,
}: {
  line: HttpTypes.StoreCartLineItem
  currencyCode: string
  position: number | null
}) {
  const productMetadata = (line as any).product?.metadata as
    | Record<string, unknown>
    | null
    | undefined
  const customAmount = isCustomAmountVoucher(productMetadata)
  const config = voucherConfig(productMetadata)

  const savedAmount = voucherLineAmount(line as never)
  const savedKind = voucherLineKind(line as never)
  const needsSetup = voucherLineNeedsSetup(line as never, currencyCode)

  const [amount, setAmount] = useState(savedAmount === null ? "" : String(savedAmount))
  const [form, setForm] = useState<GiftVoucherFormValue>({
    ...EMPTY_GIFT_VOUCHER_FORM,
    kind: savedKind ?? EMPTY_GIFT_VOUCHER_FORM.kind,
    recipientName: String(line.metadata?.[VOUCHER_LINE_KEYS.recipientName] ?? ""),
    recipientEmail: String(line.metadata?.[VOUCHER_LINE_KEYS.recipientEmail] ?? ""),
    dedication: String(line.metadata?.[VOUCHER_LINE_KEYS.dedication] ?? ""),
  })
  const [open, setOpen] = useState(needsSetup)
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const heading = position
    ? `${position}. ${line.product_title ?? line.title}`
    : (line.product_title ?? line.title)

  const save = async () => {
    setError(null)

    const check = customAmount ? checkVoucherAmount(amount, config, currencyCode) : null
    if (check && !check.ok) {
      setTouched(true)
      setError(check.message)
      return
    }
    const formProblem = giftVoucherFormError(form)
    if (formProblem) {
      setTouched(true)
      setError(formProblem)
      return
    }

    setSaving(true)
    const result = await setGiftVoucherLine({
      lineId: line.id,
      kind: form.kind,
      amount: check?.ok ? check.amount : null,
      recipientName: form.recipientName,
      recipientEmail: form.recipientEmail,
      dedication: form.dedication,
    })
    setSaving(false)

    if (!result.success) {
      setError(result.message ?? "Poukaz se nepodařilo uložit. Zkuste to prosím znovu.")
      return
    }
    /* Košík se po akci načte znovu a karta se nasadí s uloženými hodnotami —
       zavření je jen pro případ, že by se metadata nezměnila (uložené totéž). */
    setOpen(false)
  }

  if (!open) {
    return (
      <article className={s.card} data-testid="gift-voucher-card">
        <h3 className={s.cardTitle}>{heading}</h3>
        <dl className={s.recap}>
          <div>
            <dt>Hodnota</dt>
            <dd>
              {savedAmount !== null
                ? convertToLocale({ amount: savedAmount, currency_code: currencyCode })
                : convertToLocale({
                    amount: line.unit_price ?? 0,
                    currency_code: currencyCode,
                  })}
            </dd>
          </div>
          <div>
            <dt>Podoba</dt>
            <dd>{savedKind === "electronic" ? "Elektronický — e-mailem" : "Vytištěný"}</dd>
          </div>
          {form.recipientName ? (
            <div>
              <dt>Pro koho</dt>
              <dd>{form.recipientName}</dd>
            </div>
          ) : null}
          {savedKind === "electronic" && form.recipientEmail ? (
            <div>
              <dt>E-mail</dt>
              <dd>{form.recipientEmail}</dd>
            </div>
          ) : null}
          {form.dedication ? (
            <div>
              <dt>Věnování</dt>
              <dd className={s.dedication}>{form.dedication}</dd>
            </div>
          ) : null}
        </dl>
        <button
          type="button"
          className={s.ghost}
          onClick={() => setOpen(true)}
          data-testid="gift-voucher-edit"
        >
          Upravit poukaz
        </button>
      </article>
    )
  }

  return (
    <article className={s.card} data-testid="gift-voucher-card">
      <h3 className={s.cardTitle}>{heading}</h3>
      {needsSetup && <p className={s.todo}>Zatím nenastavený</p>}
      {/* Dva holé poukazy se v košíku slijí do jednoho řádku (Medusa slučuje
          položky se shodnými metadaty), takže jedno nastavení platí pro oba.
          Kdo chce dva různé, nastaví první a druhý přidá potom — ten už se
          s nastaveným nesleje. */}
      {line.quantity > 1 && (
        <p className={s.hint}>
          Nastavení platí pro všechny {line.quantity} kusy. Chcete každý jinak? Dejte
          sem 1 kus, uložte, a pak přidejte další poukaz z obchodu.
        </p>
      )}

      {customAmount && (
        <VoucherAmountField
          config={config}
          currencyCode={currencyCode}
          value={amount}
          onChange={(value) => {
            setAmount(value)
            setError(null)
          }}
          showError={touched}
          disabled={saving}
        />
      )}

      <GiftVoucherForm
        value={form}
        onChange={(value) => {
          setForm(value)
          setError(null)
        }}
        showErrors={touched}
        disabled={saving}
      />

      {error && (
        <p className={s.error} role="alert" data-testid="gift-voucher-error">
          {error}
        </p>
      )}

      <div className={s.actions}>
        <button
          type="button"
          className={s.save}
          onClick={save}
          disabled={saving}
          data-testid="gift-voucher-save"
        >
          {saving ? "Ukládám…" : needsSetup ? "Uložit poukaz" : "Uložit změnu"}
        </button>
        {!needsSetup && (
          <button
            type="button"
            className={s.ghost}
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Zpět
          </button>
        )}
      </div>
    </article>
  )
}
