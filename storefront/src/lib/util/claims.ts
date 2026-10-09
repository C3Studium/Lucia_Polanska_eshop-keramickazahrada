/**
 * Reklamace a zrušení — typy a čisté pomocníky SDÍLENÉ serverem i klientem.
 *
 * Datová vrstva (`@lib/data/claims`) je `"use server"` a smí vyvážet jen
 * asynchronní funkce, takže popisky, překlady stavů a formátování žijí tady,
 * aby je klientské komponenty (formulář, časová osa) mohly importovat bez
 * `server-only`. Tvary odpovídají kontraktu `docs/reklamace-a-zruseni.md` §4.
 */

export type ClaimKind = "reklamace" | "vraceni" | "odstoupeni"

export type ClaimStatus =
  | "pending"
  | "approved"
  | "received"
  | "resolved"
  | "rejected"
  | "cancelled"

/** Co ŽÁDÁ zákazník (jen reklamace, §19/1 ZOS). */
export type ClaimRequestedResolution = "repair" | "replace" | "refund"

/** Co ROZHODLA majitelka při schválení (§2169–2172). */
export type ClaimResolution = "repair" | "replace" | "discount" | "refund"

export type ClaimRefund = {
  amount: number
  method: "comgate" | "manual"
  at: string
  note?: string | null
}

/** Příčina poškození (§11.3) — zatím jen přeprava. */
export type ClaimDamageCause = "carrier"

/**
 * Položka objednávky nabídnutá k výběru ve formuláři (§11.1, `order_items`).
 * `unit_price`/`total` jsou po slevě, s DPH — tak, jak je zákazník zaplatil.
 */
export type ClaimOrderItem = {
  id: string
  title: string
  variant_title?: string | null
  thumbnail?: string | null
  quantity: number
  unit_price: number
  total: number
}

/** Položka uložená u žádosti (§11.1, `line_items`) — snímek z doby podání. */
export type ClaimLineItem = {
  line_item_id?: string
  title: string
  variant_title?: string | null
  thumbnail?: string | null
  quantity: number
  unit_price: number
  total: number
  currency_code?: string | null
}

export type OrderClaim = {
  id: string
  kind: ClaimKind
  status: ClaimStatus
  created_at: string
  resolve_by: string | null
  requested_resolution: ClaimRequestedResolution | null
  resolution: ClaimResolution | null
  protocol_url: string | null
  refund_amount: number | null
  refunds: ClaimRefund[] | null
  goods_received_at: string | null
  goods_tracking: string | null
  resolved_at: string | null
  /** Jen u `rejected` — písemné odůvodnění (§19/3 ZOS). */
  decision_note?: string | null
  reason: string | null
  /** Vybrané položky (§11.1). Starší žádosti je nemají → nic se nevypíše. */
  line_items?: ClaimLineItem[] | null
  /** `"carrier"` = balík dorazil poškozený přepravou (§11.3). */
  damage_cause?: ClaimDamageCause | null
}

export type OrderClaims = {
  can_withdraw: boolean
  withdrawal_deadline: string | null
  withdraw_block_reason: string | null
  return_address: string
  return_instructions: string | null
  all_made_to_order: boolean
  requests: OrderClaim[]
  /** Položky objednávky pro výběr ve formuláři (§11.1). Bez nich se výběr skryje. */
  order_items?: ClaimOrderItem[]
}

export const CLAIM_KINDS: ClaimKind[] = ["reklamace", "vraceni", "odstoupeni"]

export const isClaimKind = (value: unknown): value is ClaimKind =>
  value === "reklamace" || value === "vraceni" || value === "odstoupeni"

export const FINAL_CLAIM_STATUSES: ClaimStatus[] = [
  "resolved",
  "rejected",
  "cancelled",
]

export const isFinalClaimStatus = (status: ClaimStatus) =>
  FINAL_CLAIM_STATUSES.includes(status)

/** První NEUZAVŘENÁ žádost — server povolí max. jednu otevřenou na objednávku. */
export const findOpenClaim = (claims: OrderClaims | null | undefined) =>
  claims?.requests.find((request) => !isFinalClaimStatus(request.status)) ??
  null

export const CLAIM_KIND_LABEL: Record<ClaimKind, string> = {
  reklamace: "Reklamace",
  vraceni: "Vrácení zboží",
  odstoupeni: "Odstoupení od smlouvy",
}

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  pending: "Čeká na posouzení",
  approved: "Schváleno",
  received: "Zboží přijato",
  resolved: "Vyřízeno",
  rejected: "Zamítnuto",
  cancelled: "Stornováno",
}

export const REQUESTED_RESOLUTION_LABEL: Record<
  ClaimRequestedResolution,
  string
> = {
  repair: "Oprava",
  replace: "Výměna",
  refund: "Vrácení peněz",
}

export const RESOLUTION_LABEL: Record<ClaimResolution, string> = {
  repair: "Oprava",
  replace: "Výměna",
  discount: "Sleva z ceny",
  refund: "Vrácení peněz",
}

export const DAMAGE_CAUSE_LABEL: Record<ClaimDamageCause, string> = {
  carrier: "Poškozeno přepravou",
}

/** Položky žádosti bez děr — staré řádky `line_items` nemají vůbec. */
export const claimLineItems = (claim: OrderClaim): ClaimLineItem[] =>
  (claim.line_items ?? []).filter(
    (item) => item && typeof item === "object" && Number(item.quantity) > 0
  )

/**
 * „Cena vybraných položek" = Σ `line_items.total` (§11.2). `null`, když žádost
 * položky nenese — pak se částka nevypisuje, nic se tu nedopočítává z objednávky.
 */
export const claimItemsTotal = (claim: OrderClaim): number | null => {
  const items = claimLineItems(claim)
  if (!items.length) return null
  return items.reduce((sum, item) => sum + (Number(item.total) || 0), 0)
}

/**
 * Zda se u žádosti čeká na zboží zpět: vrácení a odstoupení vždy, reklamace jen
 * když majitelka rozhodla o opravě/výměně (sleva a vrácení peněz u reklamace
 * zboží zpět nepotřebují — viz pravidla refundace v kontraktu §3).
 */
export const claimExpectsGoods = (claim: OrderClaim) =>
  claim.kind !== "reklamace" ||
  claim.resolution === "repair" ||
  claim.resolution === "replace"

export const formatClaimDate = (value: string | null | undefined) => {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date)
}

/** Lhůta už uplynula? `false`, když lhůta není (ještě neodesláno → bez lhůty). */
export const isDeadlinePast = (deadline: string | null | undefined) => {
  if (!deadline) return false
  const time = new Date(deadline).getTime()
  return !Number.isNaN(time) && time < Date.now()
}

/**
 * Proč nejde odstoupit / vrátit — přednost má věta ze serveru; když ji nepošle,
 * složíme ji z toho, co víme (zakázka §1837, uplynulá lhůta, otevřená žádost).
 */
export const withdrawBlockText = (claims: OrderClaims) => {
  if (claims.can_withdraw) return null
  if (claims.withdraw_block_reason) return claims.withdraw_block_reason
  if (claims.all_made_to_order) {
    return "Zboží na míru — ze zákona od něj nelze odstoupit (§1837 písm. d)."
  }
  if (isDeadlinePast(claims.withdrawal_deadline)) {
    return `Lhůta 14 dnů pro odstoupení uplynula dne ${formatClaimDate(
      claims.withdrawal_deadline
    )}.`
  }
  if (findOpenClaim(claims)) {
    return "K objednávce už máte otevřenou žádost — počkejte prosím, až ji vyřídíme."
  }
  return "Odstoupení ani vrácení teď u této objednávky nejde podat."
}
