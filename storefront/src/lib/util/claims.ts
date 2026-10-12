/**
 * Reklamace a zrušení — typy a čisté pomocníky SDÍLENÉ serverem i klientem.
 *
 * Datová vrstva (`@lib/data/claims`) je `"use server"` a smí vyvážet jen
 * asynchronní funkce, takže popisky, překlady stavů a formátování žijí tady,
 * aby je klientské komponenty (formulář, časová osa) mohly importovat bez
 * `server-only`. Tvary odpovídají kontraktu `docs/reklamace-a-zruseni.md` §4.
 */

/**
 * `uprava` = vrácení rozdílu po zákaznické úpravě objednávky — zakládá ho
 * server sám (docs/uprava-objednavky-plan.md §3c.6), formulářem se nepodává
 * (`isClaimKind` ho proto nezná). Zboží se u něj nevrací.
 */
export type ClaimKind = "reklamace" | "vraceni" | "odstoupeni" | "uprava"

export type ClaimStatus =
  | "pending"
  | "approved"
  | "received"
  | "resolved"
  | "rejected"
  | "cancelled"

/**
 * Co ŽÁDÁ zákazník (jen reklamace, §19/1 ZOS). `repair` jen u starých žádostí
 * — nová reklamace nabízí `NEW_CLAIM_RESOLUTIONS`.
 */
export type ClaimRequestedResolution = "repair" | "replace" | "refund"

/**
 * Co jde požadovat v NOVÉ reklamaci (12. 10. 2026, Matěj: oprava z formuláře
 * pryč — jen výměna nebo vrácení peněz). Zrcadlo serveru
 * (`NEW_CLAIM_RESOLUTIONS` v `backend/src/lib/claims/constants.ts`), který
 * opravu u nové žádosti odmítne.
 */
export const NEW_CLAIM_RESOLUTIONS: ClaimRequestedResolution[] = [
  "replace",
  "refund",
]

/**
 * Reklamace zásilky u České pošty — oficiální stránka „Reklamace a stížnosti"
 * (kdo reklamuje, lhůta 2 pracovní dny, online podání, formuláře). Ověřeno
 * 12. 10. 2026; dřívější `ceskaposta.cz/reklamace` i `/ereklamace` vrací 404.
 * Stejná adresa jako v e-mailech (`CP_CLAIM_FORM_URL` na backendu).
 */
export const CP_CLAIM_URL =
  "https://www.ceskaposta.cz/rady-a-tipy/jine/reklamace-a-stiznosti"

/**
 * Formulář České pošty „Reklamace poškození" (PDF) a pokyny k podání —
 * přímé odkazy pro „Balík dorazil poškozený" (Matěj 12. 10. 2026). Ověřeno
 * 12. 10. 2026, oba vrací PDF. Stejné jako `CP_CLAIM_FORM_URL` /
 * `CP_CLAIM_GUIDE_URL` na backendu.
 */
export const CP_CLAIM_FORM_PDF_URL =
  "https://www.ceskaposta.cz/documents/d/guest/formular-reklamace-pdf?download=true"
export const CP_CLAIM_GUIDE_PDF_URL =
  "https://www.ceskaposta.cz/documents/d/guest/pokyny-pro-podani-reklamace-pri-poskozeni?download=true"

/** Co ROZHODLA majitelka při schválení (§2169–2172). */
export type ClaimResolution = "repair" | "replace" | "discount" | "refund"

export type ClaimRefundMethod = "comgate" | "manual"

/**
 * Řádek košíku vrácení (§13.2) — co přesně se v jedné refundaci vrací. Částku
 * (`amount`) a název (`title`/`label`) server ukládá jako snímek; když chybí,
 * název se dohledá v položkách žádosti / objednávky.
 */
export type ClaimRefundLine =
  | {
      type: "item"
      line_item_id: string
      quantity: number
      title?: string | null
      amount?: number | null
    }
  | {
      type: "component"
      line_item_id: string
      product_id: string
      quantity: number
      title?: string | null
      amount?: number | null
    }
  | { type: "shipping"; amount?: number | null; label?: string | null }
  | { type: "custom"; amount: number; label?: string | null }

/** Dobropis k jedné refundaci (§13.3). `pdf_url` chybí ve zkušebním režimu. */
export type ClaimCreditNote = {
  status?: string | null
  number?: string | null
  pdf_url?: string | null
}

export type ClaimRefund = {
  amount: number
  method: ClaimRefundMethod
  at: string
  note?: string | null
  /** §13.2 — řádky košíku vrácení; starší záznamy je nemají. */
  lines?: ClaimRefundLine[] | null
  /** §13.3 — dobropis vystavený k téhle refundaci. */
  credit_note?: ClaimCreditNote | null
}

/**
 * Příčina poškození (§11.3, §13.7): `"carrier"` = balík dorazil poškozený
 * přepravou, `"damaged"` = poškozený kus (viditelné poškození). `null` = vada
 * nebo nefunkčnost. U obou příčin jsou fotky povinné.
 */
export type ClaimDamageCause = "carrier" | "damaged"

/**
 * Komponenta balíčku (§13.5) — `quantity` je NA JEDEN balíček; kolik kusů
 * komponenty objednávka celkem nese = `quantity × objednané balíčky`.
 */
export type ClaimOrderItemComponent = {
  product_id: string
  variant_id?: string | null
  title: string
  thumbnail?: string | null
  quantity: number
  unit_share?: number | null
  refunded_quantity?: number | null
  refundable_quantity?: number | null
}

/**
 * Položka objednávky nabídnutá k výběru ve formuláři (§11.1, `order_items`).
 * `unit_price`/`total` jsou po slevě, s DPH — tak, jak je zákazník zaplatil.
 * Balíček (§13.5) nese navíc `components`; bez nich se vybírá jen celek.
 */
export type ClaimOrderItem = {
  id: string
  title: string
  variant_title?: string | null
  thumbnail?: string | null
  quantity: number
  unit_price: number
  total: number
  components?: ClaimOrderItemComponent[] | null
}

/** Vybraná komponenta balíčku v žádosti (§13.5) — tělo `items[].components`. */
export type ClaimItemComponentInput = { product_id: string; quantity: number }

/** Jedna položka těla `items` v `POST /store/orders/:id/claims`. */
export type ClaimItemInput = {
  id: string
  quantity: number
  components?: ClaimItemComponentInput[]
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
  /** Poznámka k vyřízení (např. „Záloha ponechána", „Objednávka zrušena"). */
  resolution_note?: string | null
  reason: string | null
  /** Vybrané položky (§11.1). Starší žádosti je nemají → nic se nevypíše. */
  line_items?: ClaimLineItem[] | null
  /** `"carrier"` = poškozeno přepravou (§11.3), `"damaged"` = poškozený kus (§13.7). */
  damage_cause?: ClaimDamageCause | null
  /** §13.1 — žádost schválena a objednávka zrušena rovnou při podání. */
  auto_cancelled?: boolean | null
  /** Vyřízení skončilo zrušením objednávky (§12.5 „Objednávka zrušena"). */
  order_cancelled?: boolean | null
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
  /**
   * Objednávka nebyla placená kartou (dobírka, platba na místě) → peníze se
   * vrací převodem a formulář chce číslo účtu.
   */
  refund_account_needed?: boolean
  /** Stav objednávky, když ho server přibalí (`"canceled"` = zrušená). */
  order_status?: string | null
  order_cancelled?: boolean | null
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

/**
 * První NEUZAVŘENÁ žádost, která brání podat další — server povolí max. jednu
 * otevřenou na objednávku. Vrácení rozdílu po úpravě (`uprava`) se nepočítá:
 * zákazník ho nepodával a server kvůli němu reklamaci neodmítne
 * (backend `blocksNewClaim`).
 */
export const findOpenClaim = (claims: OrderClaims | null | undefined) =>
  claims?.requests.find(
    (request) => !isFinalClaimStatus(request.status) && request.kind !== "uprava"
  ) ?? null

/** Běží u objednávky jakákoli žádost (i vrácení rozdílu po úpravě)? */
export const hasOpenClaim = (claims: OrderClaims | null | undefined) =>
  Boolean(claims?.requests.some((request) => !isFinalClaimStatus(request.status)))

export const CLAIM_KIND_LABEL: Record<ClaimKind, string> = {
  reklamace: "Reklamace",
  vraceni: "Vrácení zboží",
  odstoupeni: "Odstoupení od smlouvy",
  uprava: "Vrácení rozdílu po úpravě objednávky",
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
  damaged: "Poškozený kus",
}

export const isDamageCause = (value: unknown): value is ClaimDamageCause =>
  value === "carrier" || value === "damaged"

/** Jak peníze dorazí (§13.3) — věta k refundaci na stavové stránce. */
export const REFUND_METHOD_TEXT: Record<ClaimRefundMethod, string> = {
  comgate: "Kartou zpět přes ComGate — na účtu do 3–5 pracovních dnů.",
  manual: "Převodem na účet.",
}

/** Refundace žádosti bez děr — starší žádosti mají `null`, nebo jen `refund_amount`. */
export const claimRefunds = (claim: OrderClaim): ClaimRefund[] =>
  (claim.refunds ?? []).filter(
    (refund) => refund && typeof refund === "object" && Number(refund.amount) > 0
  )

/** Řádky košíku vrácení (§13.2) jedné refundace — jen ty, které dávají smysl. */
export const refundLines = (refund: ClaimRefund): ClaimRefundLine[] =>
  (refund.lines ?? []).filter(
    (line): line is ClaimRefundLine =>
      Boolean(line) &&
      typeof line === "object" &&
      (line.type === "item" ||
        line.type === "component" ||
        line.type === "shipping" ||
        line.type === "custom")
  )

/**
 * Popisek řádku refundace: „Název × 2 ks" / „Poštovné" / „Jiná částka — proč".
 * Název položky bere ze snímku v řádku; když ho server neuložil, dohledá ho
 * ve vybraných položkách žádosti, případně v položkách objednávky.
 */
export const refundLineLabel = (
  line: ClaimRefundLine,
  claim: OrderClaim,
  orderItems?: ClaimOrderItem[] | null
): string => {
  if (line.type === "shipping") return line.label || "Poštovné"
  if (line.type === "custom") {
    return line.label ? `Jiná částka — ${line.label}` : "Jiná částka"
  }
  const fromClaim = claimLineItems(claim).find(
    (item) => item.line_item_id === line.line_item_id
  )
  const fromOrder = (orderItems ?? []).find((item) => item.id === line.line_item_id)
  let title = line.title || fromClaim?.title || fromOrder?.title || "Položka"
  if (line.type === "component" && !line.title) {
    const component = (fromOrder?.components ?? []).find(
      (entry) => entry.product_id === line.product_id
    )
    if (component?.title) title = `${component.title} (z balíčku ${title})`
  }
  const qty = Number(line.quantity) || 0
  return qty > 0 ? `${title} × ${qty} ks` : title
}

/**
 * Skončila žádost zrušením objednávky? Bere, co server pošle (`order_cancelled`
 * na žádosti, nebo stav objednávky v kontextu); když nic z toho nepřibalí,
 * pozná to z poznámky k vyřízení („Objednávka zrušena", auto-zrušení §13.1).
 */
export const claimOrderCancelled = (
  claim: OrderClaim,
  claims?: Pick<OrderClaims, "order_status" | "order_cancelled"> | null
): boolean => {
  if (claim.status !== "resolved") return false
  if (typeof claim.order_cancelled === "boolean") return claim.order_cancelled
  if (claim.auto_cancelled === true) return true
  if (claims?.order_cancelled === true) return true
  if (claims?.order_status === "canceled" || claims?.order_status === "cancelled") {
    return true
  }
  const note = `${claim.resolution_note ?? ""} ${claim.decision_note ?? ""}`
    .toLowerCase()
    .trim()
  return (
    note.includes("objednávka zrušen") ||
    note.includes("objednávku zrušen") ||
    note.includes("nezaplaceno, neodesláno")
  )
}

/** Objednávka je zrušená — podle kontextu, nebo podle kterékoli vyřízené žádosti. */
export const orderCancelled = (claims: OrderClaims | null | undefined): boolean =>
  Boolean(claims) &&
  (claims!.order_cancelled === true ||
    claims!.order_status === "canceled" ||
    claims!.order_status === "cancelled" ||
    claims!.requests.some((claim) => claimOrderCancelled(claim, claims)))

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
  claim.kind !== "uprava" && (
  claim.kind !== "reklamace" ||
  claim.resolution === "repair" ||
  claim.resolution === "replace")

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
