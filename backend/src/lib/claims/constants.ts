/**
 * Modul „Reklamace a zrušení" — sdílené názvosloví (docs/reklamace-a-zruseni.md).
 *
 * Jedno místo pro druhy, stavy, lhůty a české popisky, ať routy, e-maily,
 * protokol i job říkají totéž. Čistý soubor bez závislostí — importuje se i
 * z unit testů a z e-mailových šablon.
 */

export type ClaimKind = "reklamace" | "vraceni" | "odstoupeni"

export type ClaimStatus =
  | "pending"
  | "approved"
  | "received"
  | "resolved"
  | "rejected"
  | "cancelled"

/** Co ŽÁDÁ zákazník u reklamace (§19/1 ZOS — „požadovaný způsob vyřízení"). */
export type RequestedResolution = "repair" | "replace" | "refund"

/** Co ROZHODLA majitelka (§2169–2172 OZ). Odstoupení/vrácení = vždy `refund`. */
export type Resolution = "repair" | "replace" | "discount" | "refund"

export const CLAIM_KINDS: readonly ClaimKind[] = [
  "reklamace",
  "vraceni",
  "odstoupeni",
]

export const CLAIM_STATUSES: readonly ClaimStatus[] = [
  "pending",
  "approved",
  "received",
  "resolved",
  "rejected",
  "cancelled",
]

/** Nefinální stavy — žádost „běží" (blokuje další žádost, hlídá ji job). */
export const OPEN_STATUSES: readonly ClaimStatus[] = [
  "pending",
  "approved",
  "received",
]

/** Finální stavy — odsud se nikam nejde. */
export const FINAL_STATUSES: readonly ClaimStatus[] = [
  "resolved",
  "rejected",
  "cancelled",
]

export const REQUESTED_RESOLUTIONS: readonly RequestedResolution[] = [
  "repair",
  "replace",
  "refund",
]

export const RESOLUTIONS: readonly Resolution[] = [
  "repair",
  "replace",
  "discount",
  "refund",
]

export const isClaimKind = (value: unknown): value is ClaimKind =>
  typeof value === "string" && (CLAIM_KINDS as readonly string[]).includes(value)

export const isFinalStatus = (status: unknown): boolean =>
  typeof status === "string" &&
  (FINAL_STATUSES as readonly string[]).includes(status)

export const isOpenStatus = (status: unknown): boolean =>
  typeof status === "string" &&
  (OPEN_STATUSES as readonly string[]).includes(status)

/**
 * Zákonná lhůta na vyřízení podle druhu: reklamace do 30 dnů (§19 ZOS),
 * odstoupení a vrácení = vrátit peníze do 14 dnů (§1832). Počítá se ode dne
 * žádosti. Neznámý druh → bez lhůty (admin ji doplní ručně).
 */
export const RESOLVE_DAYS: Record<ClaimKind, number> = {
  reklamace: 30,
  vraceni: 14,
  odstoupeni: 14,
}

/** Lhůta pro odstoupení od smlouvy bez udání důvodu (§1829 OZ). */
export const WITHDRAWAL_DAYS = 14

const DAY_MS = 24 * 60 * 60 * 1000

export const resolveByFor = (
  kind: string | null | undefined,
  from: Date = new Date()
): Date | null => {
  const days = isClaimKind(kind) ? RESOLVE_DAYS[kind] : undefined
  return days ? new Date(from.getTime() + days * DAY_MS) : null
}

/** „do 30 dnů od uplatnění" / „do 14 dnů" — do e-mailů. */
export const deadlineTextFor = (kind: string | null | undefined): string =>
  kind === "reklamace"
    ? "do 30 dnů od uplatnění reklamace"
    : "do 14 dnů"

export const KIND_LABEL: Record<ClaimKind, string> = {
  reklamace: "Reklamace",
  vraceni: "Vrácení zboží",
  odstoupeni: "Odstoupení od smlouvy",
}

export const kindLabel = (kind: string | null | undefined): string =>
  isClaimKind(kind) ? KIND_LABEL[kind] : "Žádost o vrácení"

export const REQUESTED_RESOLUTION_LABEL: Record<RequestedResolution, string> = {
  repair: "oprava",
  replace: "výměna za nový kus",
  refund: "vrácení peněz",
}

export const RESOLUTION_LABEL: Record<Resolution, string> = {
  repair: "oprava",
  replace: "výměna za nový kus",
  discount: "přiměřená sleva z ceny",
  refund: "vrácení peněz",
}

export const resolutionLabel = (value: string | null | undefined): string =>
  value && value in RESOLUTION_LABEL
    ? RESOLUTION_LABEL[value as Resolution]
    : value && value in REQUESTED_RESOLUTION_LABEL
      ? REQUESTED_RESOLUTION_LABEL[value as RequestedResolution]
      : ""

/**
 * Příčina poškození (§11.3). Zatím jediná typovaná hodnota: `"carrier"` =
 * zásilka dorazila poškozená → majitelka reklamuje u dopravce.
 */
export type DamageCause = "carrier"

export const DAMAGE_CAUSES: readonly DamageCause[] = ["carrier"]

export const isDamageCause = (value: unknown): value is DamageCause =>
  typeof value === "string" &&
  (DAMAGE_CAUSES as readonly string[]).includes(value)

export const DAMAGE_CAUSE_LABEL: Record<DamageCause, string> = {
  carrier: "Poškozeno přepravou",
}

export const damageCauseLabel = (value: unknown): string | null =>
  isDamageCause(value) ? DAMAGE_CAUSE_LABEL[value] : null

/**
 * Formulář České pošty pro reklamaci zásilky (§11.3).
 *
 * OVĚŘIT: adresa je z dokumentu (`https://www.ceskaposta.cz/reklamace`) a ČP
 * stránky občas přesouvá; než se na ni majitelka poprvé spolehne, otevřít a
 * případně přepsat (jediné místo, odkud se bere).
 */
export const CP_CLAIM_FORM_URL = "https://www.ceskaposta.cz/reklamace"

/** Lhůta pro hlášení poškození dopravci — do e-mailu majitelce. */
export const CP_DAMAGE_REPORT_DEADLINE_TEXT =
  "Poškození hlaste České poště neprodleně, nejpozději do 2 pracovních dnů od dodání — jinak nárok na náhradu propadá."
