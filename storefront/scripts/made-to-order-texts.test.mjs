/**
 * Texty zakázkové výroby pro zákazníka (audit § 0, pravidla Z4, Z5, Z9, Z10) —
 * čistá logika bez sítě: štítek u ceny, znění zaškrtnutí, stav a zrušení v účtu,
 * věta o záloze v předsmluvních informacích.
 *
 *   node --import ./scripts/lib/ts-register.mjs --test scripts/made-to-order-texts.test.mjs
 */
import assert from "node:assert/strict"
import { test } from "node:test"

const util = await import("../src/lib/util/made-to-order.ts")
const commission = await import("../src/lib/util/commission.ts")

const {
  MADE_TO_ORDER_ACK_TEXT,
  MADE_TO_ORDER_CANCEL_SENTENCE,
  madeToOrderBadgeText,
  productionMaxDaysFor,
  commissionStatusLabel,
  commissionCancelCopy,
  cancelledCommissionText,
  formatCommissionDateTime,
  commissionTermsSummary,
  depositSentence,
} = util
const { productionTermsFor } = commission

const money = (amount) => `${amount} Kč`

test("zaškrtnutí Z10 má přesné znění z auditu a PDF (bod 08)", () => {
  assert.equal(
    MADE_TO_ORDER_ACK_TEXT,
    "Beru na vědomí, že výrobek vyrobený podle mého zadání nelze vrátit ve 14denní lhůtě a že záloha se po zahájení výroby nevrací."
  )
  assert.match(MADE_TO_ORDER_CANCEL_SENTENCE, /před zahájením výroby/)
  assert.match(MADE_TO_ORDER_CANCEL_SENTENCE, /po zahájení se záloha nevrací, zbytek ano\.$/)
})

test("štítek pod cenou skládá jen to, co profil dal", () => {
  assert.equal(
    madeToOrderBadgeText({ depositPercentage: 25, maxDays: 42 }),
    "Na zakázku · záloha 25 % · výroba do 42 dnů · nelze vrátit do 14 dnů"
  )
  assert.equal(
    madeToOrderBadgeText({ depositPercentage: 30 }),
    "Na zakázku · záloha 30 % · nelze vrátit do 14 dnů"
  )
  assert.equal(madeToOrderBadgeText(), "Na zakázku · nelze vrátit do 14 dnů")
  assert.equal(
    madeToOrderBadgeText({ depositPercentage: 0, maxDays: null }),
    "Na zakázku · nelze vrátit do 14 dnů"
  )
})

test("lhůta a záloha z profilu — přepis u provedení má přednost", () => {
  const profile = {
    enabled: true,
    specification_required: false,
    default_deposit_percentage: 25,
    production_time_min_days: 14,
    production_time_max_days: 42,
    variants: [
      {
        variant_id: "v2",
        deposit_percentage_override: 40,
        production_time_max_days_override: 60,
      },
    ],
  }
  assert.equal(productionMaxDaysFor(profile, "v1"), 42)
  assert.equal(productionMaxDaysFor(profile, "v2"), 60)
  assert.equal(productionMaxDaysFor(null, "v1"), null)
  assert.deepEqual(productionTermsFor(profile, "v1"), {
    deposit_percentage: 25,
    production_time_max_days: 42,
  })
  assert.deepEqual(productionTermsFor(profile, "v2"), {
    deposit_percentage: 40,
    production_time_max_days: 60,
  })
  assert.deepEqual(productionTermsFor(null), {
    deposit_percentage: null,
    production_time_max_days: null,
  })
})

test("předsmluvní souhrn: jedno procento jen při shodě, lhůta nejdelší", () => {
  assert.deepEqual(
    commissionTermsSummary([
      { deposit_percentage: 25, production_time_max_days: 42 },
      { deposit_percentage: 25, production_time_max_days: 60 },
    ]),
    { depositPercentage: 25, maxDays: 60 }
  )
  assert.deepEqual(
    commissionTermsSummary([
      { deposit_percentage: 25, production_time_max_days: 42 },
      { deposit_percentage: 50, production_time_max_days: null },
    ]),
    { depositPercentage: null, maxDays: 42 }
  )
  assert.deepEqual(commissionTermsSummary([]), { depositPercentage: null, maxDays: null })
})

test("věta o záloze: platí-li zákazník víc než zálohu, řekne obojí", () => {
  assert.equal(
    depositSentence(
      { contractualDeposit: 500, depositPercentage: 25, now: 500, later: 1500 },
      money
    ),
    "Záloha 25 %: 500 Kč — platíte teď. Doplatek 1500 Kč po dokončení."
  )
  assert.equal(
    depositSentence(
      { contractualDeposit: 500, depositPercentage: 25, now: 2000, later: 0 },
      money
    ),
    "Záloha 25 % = 500 Kč; teď platíte 2000 Kč. Bez doplatku."
  )
  assert.equal(
    depositSentence(
      { contractualDeposit: 500, depositPercentage: null, now: 800, later: 1200 },
      money
    ),
    "Záloha = 500 Kč; teď platíte 800 Kč. Doplatek 1200 Kč po dokončení."
  )
})

test("čas e-mailu o zahájení v českém čase a tvaru dd. mm. yyyy hh:mm", () => {
  // 12:05 UTC v říjnu = 14:05 v Praze (letní čas).
  assert.equal(formatCommissionDateTime("2026-10-20T12:05:00.000Z"), "20. 10. 2026 14:05")
})

test("stav zakázky podle e-mailu Z3, ne podle tvrzení", () => {
  assert.equal(
    commissionStatusLabel({ stage: "deposit_paid", production_start_notified_at: null }),
    "Čeká na zahájení výroby"
  )
  assert.equal(
    commissionStatusLabel({
      stage: "in_production",
      production_start_notified_at: "2026-10-20T12:05:00.000Z",
    }),
    "Ve výrobě od 20. 10. 2026 14:05"
  )
  assert.equal(
    commissionStatusLabel({
      stage: "cancelled",
      production_start_notified_at: "2026-10-20T12:05:00.000Z",
      cancellation_phase: "after_production",
    }),
    "Zrušeno"
  )
})

test("zrušení před zahájením (Z4) je jednokrokové s plnou částkou", () => {
  const copy = commissionCancelCopy(
    {
      phase: "before_production",
      production_start_notified_at: null,
      refund_amount: 500,
      deposit_kept: 0,
      deposit_amount: 500,
    },
    money
  )
  assert.equal(copy.steps, "single")
  assert.equal(copy.lead, "Vrátíme vám všechno (500 Kč) do 14 dnů stejnou cestou.")
  assert.equal(copy.button, "Zrušit zakázku")
})

test("zrušení po zahájení (Z5) je dvoukrokové, záloha propadá", () => {
  const copy = commissionCancelCopy(
    {
      phase: "after_production",
      production_start_notified_at: "2026-10-20T12:05:00.000Z",
      refund_amount: 1500,
      deposit_kept: 500,
      deposit_amount: 500,
    },
    money
  )
  assert.equal(copy.steps, "double")
  assert.equal(
    copy.lead,
    "Zakázka je ve výrobě od 20. 10. 2026 14:05. Záloha 500 Kč se nevrací. Vrátíme vám 1500 Kč."
  )
  assert.equal(copy.confirm, "Ano, zrušit zakázku")

  const nothing = commissionCancelCopy(
    {
      phase: "after_production",
      production_start_notified_at: "2026-10-20T12:05:00.000Z",
      refund_amount: 0,
      deposit_kept: 500,
      deposit_amount: 500,
    },
    money
  )
  assert.match(nothing.lead, /Není co vracet\.$/)
})

test("věta po zrušení nese fázi a částku jen tehdy, když ji backend dal", () => {
  assert.equal(
    cancelledCommissionText(
      {
        stage: "cancelled",
        cancellation_phase: "before_production",
        cancelled_by: "customer",
        cancellation_refund_amount: 500,
      },
      money
    ),
    "Zakázka byla zrušena před zahájením výroby. Vrátíme vám 500 Kč do 14 dnů stejnou cestou, jakou jste platili."
  )
  assert.equal(
    cancelledCommissionText(
      {
        stage: "cancelled",
        cancellation_phase: "after_production",
        cancelled_by: "seller",
        cancellation_refund_amount: 0,
      },
      money
    ),
    "Zakázka byla zrušena po zahájení výroby z naší strany. Není co vracet."
  )
  assert.equal(
    cancelledCommissionText({ stage: "cancelled" }, money),
    "Zakázka byla zrušena."
  )
})
