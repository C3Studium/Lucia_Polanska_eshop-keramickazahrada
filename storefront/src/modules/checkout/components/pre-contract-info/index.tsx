"use client"

import type { ReactNode } from "react"

import {
  isComgate,
  isDobirkaPayment,
  isManual,
  isPickupPayment,
} from "@lib/constants"
import { useLegalFacts } from "@lib/legal/facts-context"
import { renderInline } from "@lib/legal/inline"
import { backorderWaitNote } from "@lib/util/backorder"
import {
  comgateMethodForOption,
  type ComgatePaymentMethod,
} from "@lib/util/comgate"
import { isMadeToOrderLine, type ProductionLeadTime } from "@lib/util/commission"
import {
  MADE_TO_ORDER_CANCEL_SENTENCE,
  commissionItemTermsLine,
  commissionTermsSummary,
  commissionTotalsSentence,
  depositSentence,
  type ProductionPaymentMode,
} from "@lib/util/made-to-order"
import { convertToLocale } from "@lib/util/money"
import { productLines } from "@lib/util/packaging"
import { hasPriceOnRequestLine } from "@lib/util/price-on-request"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

import { LEGAL_LINKS } from "../legal-consent/labels"

import styles from "./style.module.scss"

/**
 * Předsmluvní informace (§ 1820, § 1826 OZ) — to, co zákazník musí vidět
 * těsně před tlačítkem „Objednávka zavazující k platbě" a co v souhrnu zboží
 * a cen chybělo: čím platí, kdy zboží dostane, jestli a jak může odstoupit,
 * kdo je prodávající a kde jsou podmínky.
 *
 * Zboží, ceny a doprava jsou v pokladně v rekapitulaci nad tímhle blokem
 * (`review/recap.tsx`), v rychlém nákupu v miniatuře objednávky; tady se
 * neopakují. Údaje o prodávající a dodací lhůta zboží skladem jsou právní
 * údaje z administrace obchodu (`useLegalFacts()` — načte je kořenový layout,
 * viz `@lib/legal/facts-context`) — chybějící se ukáže jako `[[DOPLNIT: …]]`.
 */

/**
 * Kolik se platí TEĎ a kolik po dokončení. U zakázky to NENÍ cena košíku —
 * je to zvolená záloha (default), celek nebo vlastní částka ze slideru
 * (`ProductionPaymentMode`, počítá backend); běžný košík platí celek.
 * Stejná logika jako `ProductionPaymentRecap` v pravém souhrnu.
 */
export const chargeSplit = (
  mode: ProductionPaymentMode | null | undefined,
  cartTotal: number
): { now: number; later: number; madeToOrder: boolean } => {
  if (!mode?.has_made_to_order) {
    return { now: cartTotal, later: 0, madeToOrder: false }
  }
  const now =
    mode.mode === "full"
      ? mode.full_amount
      : mode.mode === "custom"
        ? mode.custom?.amount ?? mode.deposit_amount
        : mode.deposit_amount
  return { now, later: Math.max(0, mode.full_amount - now), madeToOrder: true }
}

export type PaymentDescription = {
  /** „Platební karta", „Dobírka", „Zaplatíte při vyzvednutí"… */
  label: string
  /** Jak a kdy se platí, malým písmem. */
  note: string
}

/** ComGate metoda podle id volby z kroku Platba (`?method=`). */
const comgateMethodName = (
  optionId: string,
  methods: ComgatePaymentMethod[]
): string => {
  const methodId = comgateMethodForOption(optionId)
  const found = methods.find((method) => method.id === methodId)
  if (found) return found.name_short || found.name
  const id = methodId.toUpperCase()
  if (id.includes("APPLE")) return "Apple Pay"
  if (id.includes("GOOGLE")) return "Google Pay"
  if (id.startsWith("BANK")) return "Platba přes banku"
  if (id.startsWith("CARD")) return "Platební karta"
  return "Online platba"
}

/**
 * Způsob platby slovy, pro souhrn i pro poznámku u tlačítka. ComGate cesta
 * ještě nemá platební relaci (zakládá se až tlačítkem), takže se metoda čte
 * z volby v kroku Platba; ostatní cesty z relace na košíku.
 */
export const describePayment = ({
  comgateOptionId,
  comgateMethods = [],
  providerId,
  paidByGiftcard = false,
}: {
  comgateOptionId?: string | null
  comgateMethods?: ComgatePaymentMethod[]
  providerId?: string | null
  paidByGiftcard?: boolean
}): PaymentDescription | null => {
  if (paidByGiftcard) {
    return { label: "Dárkový poukaz", note: "objednávka je uhrazená poukazem" }
  }
  if (comgateOptionId) {
    return {
      label: comgateMethodName(comgateOptionId, comgateMethods),
      note: "zaplatíte hned online přes platební bránu ComGate",
    }
  }
  if (!providerId) return null
  if (isPickupPayment(providerId)) {
    return {
      label: "Zaplatíte při vyzvednutí",
      note: "zaplatíte na místě, až si zboží vyzvednete v ateliéru",
    }
  }
  if (isDobirkaPayment(providerId)) {
    return {
      label: "Dobírka",
      note: "zaplatíte doručovateli při převzetí zásilky",
    }
  }
  if (isManual(providerId)) {
    return { label: "Testovací platba", note: "jen pro zkoušku obchodu" }
  }
  if (isComgate(providerId)) {
    return {
      label: "Online platba",
      note: "zaplatíte hned online přes platební bránu ComGate",
    }
  }
  return null
}

type PreContractInfoProps = {
  cart: any
  payment: PaymentDescription | null
  /** Výrobní lhůty a smluvní podmínky zakázkových položek (`listProductionLeadTimes`). */
  leadTimes?: ProductionLeadTime[]
  /** Zvolený režim platby zakázky (záloha / celek / vlastní) — částky backendu. */
  productionMode?: ProductionPaymentMode | null
  /** Doprava slovy — jen tam, kde ji neukazuje rekapitulace (rychlý nákup). */
  delivery?: string | null
  /** Hustší sazba pro rychlý nákup. */
  compact?: boolean
}

/** Dokument v nové záložce — rozdělaná pokladna i zaškrtnutí zůstanou. */
const DocLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <LocalizedClientLink href={href} target="_blank" rel="noopener">
    {children}
  </LocalizedClientLink>
)

export default function PreContractInfo({
  cart,
  payment,
  leadTimes = [],
  productionMode = null,
  delivery,
  compact = false,
}: PreContractInfoProps) {
  const facts = useLegalFacts()
  // Jen fakta (bez odkazů) — odkazy jsou `DocLink`, aby se otevíraly vedle.
  const inline = (text: string) =>
    renderInline(text, { placeholderClassName: styles.placeholder, facts })

  const goods = productLines((cart?.items ?? []) as any[])
  const madeToOrder = goods.filter(isMadeToOrderLine)
  const regular = goods.filter((item) => !isMadeToOrderLine(item))
  // Nepočítaný sklad = kus se dělá na objednávku (viz `variantAvailability`).
  const untracked = regular.filter(
    (item) => item?.variant && item.variant.manage_inventory === false
  )
  const titleOf = (item: any) => item?.product_title || item?.title || "Výrobek"

  const leadFor = (item: any) =>
    leadTimes.find((lead) => lead.line_id === item.id) ?? null

  const deliveryLines: ReactNode[] = []
  if (regular.length > untracked.length) {
    deliveryLines.push(inline("Zboží skladem: {{delivery.dispatchTime}}."))
  }
  untracked.forEach((item) =>
    deliveryLines.push(`${titleOf(item)}: ${backorderWaitNote(item.product)}`)
  )
  madeToOrder.forEach((item) => {
    const lead = leadFor(item)
    /* Z9: lhůta je „do N dnů OD ZAHÁJENÍ výroby" (ne orientačně od objednání);
       zahájení oznámí e-mail. Rozpětí z profilu zůstává jako „obvykle". */
    const maxDays = lead?.production_time_max_days ?? null
    const usual =
      lead?.label && maxDays && lead.label !== `do ${maxDays} dní`
        ? ` (obvykle ${lead.label})`
        : ""
    deliveryLines.push(
      maxDays
        ? `${titleOf(item)}: vyrábíme na zakázku, hotovo do ${maxDays} dnů od zahájení výroby${usual}. Pak zásilku odešleme, nebo vám dáme vědět, že je připravená k vyzvednutí.`
        : lead?.label
          ? `${titleOf(item)}: vyrábíme na zakázku, hotovo zhruba za ${lead.label}. Pak zásilku odešleme, nebo vám dáme vědět, že je připravená k vyzvednutí.`
          : `${titleOf(item)}: vyrábíme na zakázku — s termínem se vám ozveme.`
    )
  })

  /*
   * Řádek „Zakázka" (audit § 0, Z10): smluvní záloha % a Kč proti tomu, co se
   * platí teď, doplatek, lhůta od zahájení výroby a jedna věta o zrušení
   * (Z4/Z5). Záloha v Kč je backendu (`deposit_amount` režimu platby) — tady se
   * nic nepočítá; procento a lhůta z profilu výroby přes `leadTimes`. Co
   * backend nedá, se vynechá.
   */
  const commission = madeToOrder.length > 0 || Boolean(productionMode?.has_made_to_order)
  const money = (amount: number) =>
    convertToLocale({ amount, currency_code: cart?.currency_code ?? "czk" })
  const { depositPercentage, maxDays } = commissionTermsSummary(
    madeToOrder.map((item) => leadFor(item)).filter((lead) => lead != null)
  )
  const split = chargeSplit(productionMode, cart?.total ?? 0)
  const contractualDeposit =
    productionMode?.has_made_to_order && productionMode.deposit_amount > 0
      ? productionMode.deposit_amount
      : null
  const commissionLines: string[] = []
  if (commission && madeToOrder.length > 1) {
    /*
     * Z-A „zakázka = položka": u víc zakázek řádek pro KAŽDOU — záloha % a
     * lhůta té položky z profilu, záloha v Kč z rozpisu režimu platby
     * (`production_lines`, když ho backend dá) — a pod tím součet „Celkem
     * záloha X teď, doplatky Y po dokončení" z částek backendu.
     */
    const paymentLineFor = (item: any) =>
      productionMode?.production_lines?.find((line) => line.line_id === item.id) ?? null
    madeToOrder.forEach((item) => {
      const lead = leadFor(item)
      const paymentLine = paymentLineFor(item)
      commissionLines.push(
        commissionItemTermsLine(
          {
            title: titleOf(item),
            depositPercentage: paymentLine?.deposit_percentage ?? lead?.deposit_percentage,
            depositAmount: paymentLine?.deposit_amount,
            maxDays: lead?.production_time_max_days,
          },
          money
        )
      )
    })
    if (productionMode?.has_made_to_order) {
      commissionLines.push(commissionTotalsSentence(split, money))
    }
    commissionLines.push(MADE_TO_ORDER_CANCEL_SENTENCE)
  } else if (commission) {
    if (contractualDeposit != null) {
      commissionLines.push(
        depositSentence(
          { contractualDeposit, depositPercentage, now: split.now, later: split.later },
          money
        )
      )
    } else if (depositPercentage) {
      commissionLines.push(`Záloha ${depositPercentage} % ceny výrobku.`)
    }
    if (maxDays) {
      commissionLines.push(`Výroba do ${maxDays} dnů od zahájení výroby.`)
    }
    commissionLines.push(MADE_TO_ORDER_CANCEL_SENTENCE)
  }

  /* Cena po domluvě: kus je v košíku za 0 Kč, záloha z něj teď žádná —
     cena i záloha přijdou e-mailem po objednávce. */
  if (commission && hasPriceOnRequestLine(madeToOrder)) {
    commissionLines.unshift(
      "Cenu výrobku po domluvě vám pošlu e-mailem po objednávce; zálohu nebo celou částku zaplatíte až potom, výroba začne po zaplacení zálohy."
    )
  }

  const withdrawalPath = LEGAL_LINKS.withdrawal
  const termsPath = LEGAL_LINKS.terms
  const madeToOrderTitles = madeToOrder.map(titleOf).join(", ")
  const withdrawal: ReactNode =
    madeToOrder.length === 0 ? (
      <>
        Od smlouvy můžete odstoupit do 14 dnů od převzetí zboží, bez udání
        důvodu — <DocLink href={withdrawalPath}>poučení o odstoupení</DocLink>.
      </>
    ) : regular.length === 0 ? (
      <>
        U zboží vyrobeného na zakázku právo na odstoupení nemáte (§ 1837 písm.
        d) OZ). Pravidla zakázky jsou v{" "}
        <DocLink href={LEGAL_LINKS.termsMadeToOrder}>
          obchodních podmínkách
        </DocLink>
        .
      </>
    ) : (
      <>
        U zboží vyrobeného na zakázku ({madeToOrderTitles}) právo na odstoupení
        nemáte (§ 1837 písm. d) OZ). Od koupě ostatního zboží můžete odstoupit
        do 14 dnů od převzetí —{" "}
        <DocLink href={withdrawalPath}>poučení o odstoupení</DocLink>.
      </>
    )

  return (
    <section
      className={compact ? `${styles.root} ${styles.compact}` : styles.root}
      aria-labelledby="pre-contract-title"
      data-testid="pre-contract-info"
    >
      <h3 id="pre-contract-title" className={styles.title}>
        Než objednávku odešlete
      </h3>
      <dl className={styles.rows}>
        {delivery && (
          <div>
            <dt>Doprava</dt>
            <dd>{delivery}</dd>
          </div>
        )}
        <div>
          <dt>Platba</dt>
          <dd data-testid="pre-contract-payment">
            {payment ? (
              <>
                {payment.label}
                <small>{payment.note}</small>
              </>
            ) : (
              "Způsob platby vyberete níž."
            )}
          </dd>
        </div>
        {deliveryLines.length > 0 && (
          <div>
            <dt>Dodací lhůta</dt>
            <dd>
              {deliveryLines.map((line, index) => (
                <span key={index} className={styles.line}>
                  {line}
                </span>
              ))}
            </dd>
          </div>
        )}
        {commission && (
          <div>
            <dt>Zakázka</dt>
            <dd data-testid="pre-contract-commission">
              {commissionLines.map((line, index) => (
                <span key={index} className={styles.line}>
                  {line}
                </span>
              ))}
              <span className={styles.line}>
                Podrobně v{" "}
                <DocLink href={LEGAL_LINKS.termsMadeToOrder}>
                  obchodních podmínkách, čl. Výroba na zakázku
                </DocLink>
                .
              </span>
            </dd>
          </div>
        )}
        {/* `dd` je mřížka (štítek platby + drobná poznámka pod ním), takže
            každý holý textový úsek i odkaz by byl vlastní řádek — tečka za
            „poučení o odstoupení" pak visela sama na dalším řádku. Souvislá
            věta proto v jednom `span`. */}
        <div>
          <dt>Odstoupení</dt>
          <dd data-testid="pre-contract-withdrawal">
            <span>{withdrawal}</span>
          </dd>
        </div>
        <div>
          <dt>Prodávající</dt>
          <dd>
            <span>
              {inline(
                "{{seller.name}}, {{seller.address}}, IČO {{seller.ico}}, {{seller.email}}, {{seller.phone}}"
              )}
            </span>
          </dd>
        </div>
      </dl>
      <p className={styles.docs}>
        <DocLink href={termsPath}>Obchodní podmínky</DocLink>
        <span aria-hidden="true"> · </span>
        <DocLink href={withdrawalPath}>Poučení o odstoupení</DocLink>
        <span aria-hidden="true"> · </span>
        <DocLink href={LEGAL_LINKS.complaints}>Reklamační řád</DocLink>
      </p>
    </section>
  )
}
