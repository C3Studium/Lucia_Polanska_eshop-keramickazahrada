"use client"

import { useState } from "react"

import { setGiftVoucherLine } from "@lib/data/cart"
import { VOUCHER_LINE_KEYS } from "@lib/util/gift-voucher-code"
import {
  GIFT_VOUCHER_SETUP_ID,
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
 * Nastavení JEDNOHO dárkového poukazu, přímo pod jeho řádkem v košíku.
 *
 * Zákazník přidá poukaz do košíku holý a hodnotu, podobu i obdarovaného zvolí
 * až tady — vedle částky, které se to týká. Dokud to neudělá, košík k pokladně
 * nepustí (`Summary`, `CheckoutBar`); poslední slovo má backend
 * (`giftVoucherSetupProblem`).
 *
 * 31. 10. 2026 se to celé smrsklo. Předtím to byla karta s vlastním nadpisem,
 * cenou v serifu přes dva řádky, pěti poli pod sebou a shrnutím v popisném
 * seznamu — dohromady vyšší než celý zbytek položky, a na širokém okně to
 * stálo v jednom úzkém sloupci s prázdnem vedle sebe. Teď: popisek vlevo,
 * pole vpravo, nepovinné údaje až na vyžádání. Nadpis ani shrnutí se tu
 * nekreslí vůbec — obojí stojí o pár řádků výš v samotné položce.
 */

export function GiftVoucherLineSetup({
  line,
  currencyCode,
  anchor = false,
}: {
  line: HttpTypes.StoreCartLineItem
  currencyCode: string
  /**
   * Nese tenhle blok kotvu `#nastaveni-poukazu`? Zamčené tlačítko k pokladně
   * na ni odkazuje, takže ji dostane PRVNÍ nenastavený poukaz v košíku —
   * a v celém dokumentu smí být jen jednou.
   */
  anchor?: boolean
}) {
  return (
    <div
      className={s.inline}
      id={anchor ? GIFT_VOUCHER_SETUP_ID : undefined}
      data-testid="gift-voucher-line-setup"
    >
      <VoucherCard
        /* Po uložení přijde položka s novými metadaty — jiný klíč = karta
           se nasadí znovu a políčka ukážou, co je opravdu uložené. */
        key={`${line.id}:${JSON.stringify(line.metadata ?? {})}`}
        line={line}
        currencyCode={currencyCode}
      />
    </div>
  )
}

function VoucherCard({
  line,
  currencyCode,
}: {
  line: HttpTypes.StoreCartLineItem
  currencyCode: string
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

  /* Nastavený poukaz: hodnota i podoba stojí v samotné položce o kus výš
     (cena vpravo, „Elektronický pro Janu" pod variantou), takže se tu
     neopakují. Zbývá věnování — to jinde v košíku vidět není — a cesta zpět
     do polí. */
  if (!open) {
    return (
      <div className={s.saved} data-testid="gift-voucher-card">
        {form.dedication ? (
          <p className={s.dedication}>&bdquo;{form.dedication}&ldquo;</p>
        ) : null}
        <button
          type="button"
          className={s.link}
          onClick={() => setOpen(true)}
          data-testid="gift-voucher-edit"
        >
          Upravit poukaz
        </button>
      </div>
    )
  }

  return (
    <div className={s.card} data-testid="gift-voucher-card">
      {/* Dva holé poukazy se v košíku slijí do jednoho řádku (Medusa slučuje
          položky se shodnými metadaty), takže jedno nastavení platí pro oba.
          Kdo chce dva různé, nastaví první a druhý přidá potom — ten už se
          s nastaveným nesleje. */}
      {line.quantity > 1 && (
        <p className={s.hint}>
          Nastavení platí pro všech {line.quantity} kusů. Každý jinak? Nechte tu 1 kus,
          uložte a další poukaz přidejte z obchodu.
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
            className={s.link}
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Zpět
          </button>
        )}
      </div>
    </div>
  )
}
