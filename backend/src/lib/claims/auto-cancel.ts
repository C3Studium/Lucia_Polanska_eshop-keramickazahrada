/**
 * Auto-zrušení při založení žádosti (docs/reklamace-a-zruseni.md §13.1) —
 * ČISTÉ rozhodnutí, dokazované testem (`__tests__/claims-13`). Orchestrace
 * (schválit, vyřídit, zrušit objednávku, e-mail, zvonek) je v
 * `auto-cancel-action.ts`, ať se tenhle soubor dá importovat bez workflow.
 *
 * ## Kdy se ruší hned
 *
 * Odstoupení / vrácení, u kterého NENÍ co vracet ani čekat: nic nebylo
 * zachyceno (`nothing_captured`) a nic neodešlo (`goods_shipped = false`).
 * Majitelka by jen klikla „Schválit" a „Zrušit objednávku" — server to udělá
 * za ni a zákazník rovnou ví, že objednávka je zrušená.
 *
 * ## Kdy se neruší nikdy
 *
 * - reklamace (zboží zůstává, rozhoduje majitelka);
 * - zakázka, i smíšená (§1837 — o zakázce rozhoduje majitelka; čistou
 *   zakázku intake pro odstoupení ani nepustí, smíšená se tu nesmí
 *   rozhodnout sama kvůli zakázkové části).
 */

export type AutoCancelFlags = {
  kind: string | null | undefined
  nothing_captured: boolean
  goods_shipped: boolean
  is_commission: boolean
}

export const shouldAutoCancel = (flags: AutoCancelFlags): boolean =>
  (flags.kind === "odstoupeni" || flags.kind === "vraceni") &&
  flags.nothing_captured === true &&
  flags.goods_shipped === false &&
  flags.is_commission === false

/** `decision_note` auto-schválené žádosti — podle ní pozná subscriber i UI, že rozhodl server. */
export const AUTO_CANCEL_DECISION_NOTE = "Automaticky — nezaplaceno, neodesláno"

export const AUTO_CANCEL_RESOLUTION_NOTE =
  "Objednávka neodešla a nebylo nic zaplaceno — zrušena automaticky při přijetí žádosti; není co vracet."

/**
 * Byla žádost vyřízena auto-zrušením? Subscriber `order.canceled` podle toho
 * NEposílá „Objednávka zrušena" — zákazník už dostal `return-approved`
 * s `nothingToReturn` (jediný e-mail za celou událost, §13.1).
 */
export const isAutoCancelledClaim = (request: {
  status?: string | null
  decision_note?: string | null
}): boolean =>
  request?.status === "resolved" && request?.decision_note === AUTO_CANCEL_DECISION_NOTE
