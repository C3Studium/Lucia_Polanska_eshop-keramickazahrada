"use client"

import { useId } from "react"

import {
  depositPercentageFor,
  productionMaxDaysFor,
  productionTimeLabel,
  type ProductionProfile,
} from "@lib/util/made-to-order"
import { convertToLocale } from "@lib/util/money"
import { useTexty } from "@lib/context/texty"
import { dosadZnacky } from "@lib/constants/texty"

import styles from "./style.module.scss"

type MadeToOrderPanelProps = {
  profile: ProductionProfile
  variantId?: string | null
  /** Unit price of the selected variant, so the deposit can be shown as an amount. */
  unitAmount?: number | null
  currencyCode: string
  /**
   * Cena po domluvě: kus jde do košíku za 0 Kč a cenu Lucie pošle e-mailem
   * až po objednávce. Procento zálohy se pak neuvádí — počítalo by se z nuly.
   */
  priceOnRequest?: boolean
}

/**
 * Tells the customer, before they commit, that this piece is made for them: how long it takes
 * and what they pay now. The deposit percentage is the backend's — a variant's override beats
 * the product default — but the *amount* shown is derived only for display; the checkout never
 * re-derives it (§4.3 reads the API's figures).
 *
 * Deliberately information-only: the description of the piece (and its photos) is written in
 * the cart, next to the deposit chooser, so the product page stays a decision, not a form.
 */
export default function MadeToOrderPanel({
  profile,
  variantId,
  unitAmount,
  currencyCode,
  priceOnRequest = false,
}: MadeToOrderPanelProps) {
  const fieldId = useId()
  const leadTime = productionTimeLabel(profile)
  /* Z9: lhůta běží od zahájení výroby (e-mail „Zakázka je ve výrobě"), ne od
     objednání — proto „do N dnů od zahájení", rozpětí z profilu jen jako „obvykle". */
  const maxDays = productionMaxDaysFor(profile, variantId)
  const depositPercentage = depositPercentageFor(profile, variantId)
  const depositAmount =
    depositPercentage != null && unitAmount != null
      ? Math.round((unitAmount * depositPercentage) / 100)
      : null

  /*
   * Celý panel se skládá z vět, které si majitelka mění v administraci
   * (Právní věci a texty → Texty obchodu). Prázdná věta se nevykreslí —
   * tak se projeví vypínač u každého textu.
   */
  const texty = useTexty()
  const lhuta = maxDays
    ? dosadZnacky(texty["zakazka.panel_lhuta"], {
        dny: maxDays,
        obvykle:
          leadTime && leadTime !== `do ${maxDays} dní` ? ` (obvykle ${leadTime})` : "",
      })
    : leadTime
      ? dosadZnacky(texty["zakazka.panel_lhuta_rozmezi"], { rozmezi: leadTime })
      : ""
  const zaloha = priceOnRequest
    ? texty["zakazka.panel_zaloha_po_domluve"]
    : depositPercentage != null
      ? dosadZnacky(texty["zakazka.panel_zaloha"], {
          procento: depositPercentage,
          castka:
            depositAmount != null
              ? ` — ${convertToLocale({ amount: depositAmount, currency_code: currencyCode })}`
              : "",
        })
      : ""

  /* Prázdný panel se nekreslí vůbec — rámeček bez vět je jen rámeček. */
  if (
    !texty["zakazka.panel_nadpis"] &&
    !lhuta &&
    !zaloha &&
    !texty["zakazka.panel_kosik"] &&
    !texty["zakazka.panel_bez_vraceni"]
  ) {
    return null
  }

  return (
    <section className={styles.root} aria-labelledby={`${fieldId}-title`}>
      {texty["zakazka.panel_nadpis"] ? (
        <p className={styles.eyebrow} id={`${fieldId}-title`}>
          {texty["zakazka.panel_nadpis"]}
        </p>
      ) : null}

      {lhuta ? <p className={styles.lead}>{lhuta}</p> : null}

      {/*
        Cena po domluvě: procento ani částka zálohy tu nemají co dělat —
        obojí vychází z ceny, kterou teprve domluvíme. Místo toho se řekne
        pořadí: nejdřív cena, pak záloha (nebo rovnou celá částka).
      */}
      {zaloha ? (
        <p
          className={styles.deposit}
          data-testid={
            priceOnRequest ? "made-to-order-deposit-on-request" : undefined
          }
        >
          {zaloha}
        </p>
      ) : null}

      {texty["zakazka.panel_kosik"] ? (
        <p className={styles.lead}>{texty["zakazka.panel_kosik"]}</p>
      ) : null}

      {/* Poučení o vyloučení odstoupení PŘED objednávkou (§ 1820 odst. 1
          písm. j) OZ) — v pokladně ho zákazník ještě potvrdí zaškrtnutím. */}
      {texty["zakazka.panel_bez_vraceni"] ? (
        <p className={styles.lead} data-testid="made-to-order-no-return">
          {texty["zakazka.panel_bez_vraceni"]}
        </p>
      ) : null}
    </section>
  )
}
