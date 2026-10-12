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

/**
 * Všechny hodnoty, které se v `requested_resolution` mohou objevit — i ve
 * starých žádostech (popisky, admin, protokol). Pro NOVOU žádost platí užší
 * `NEW_CLAIM_RESOLUTIONS`.
 */
export const REQUESTED_RESOLUTIONS: readonly RequestedResolution[] = [
  "repair",
  "replace",
  "refund",
]

/**
 * Co smí zákazník požadovat v NOVÉ reklamaci (12. 10. 2026, Matěj: „Oprava"
 * z formuláře pryč — keramiku neopravujeme, jen vyměníme nebo vrátíme peníze).
 * `repair` zůstává v typu i v popiscích, ať staré žádosti v adminu, protokolu
 * a e-mailech čtou dál správně; nová žádost s ním neprojde (`checkClaimRules`).
 */
export const NEW_CLAIM_RESOLUTIONS: readonly RequestedResolution[] = [
  "replace",
  "refund",
]

export const isNewClaimResolution = (value: unknown): value is RequestedResolution =>
  typeof value === "string" &&
  (NEW_CLAIM_RESOLUTIONS as readonly string[]).includes(value)

/**
 * Výchozí „důvod" žádosti, když ho zákazník nepíše (12. 10. 2026, Matěj:
 * odstoupení i vrácení jsou bez textu a bez fotek — důvod se ze zákona udávat
 * nemusí). Uloží se místo prázdného řetězce, ať admin, protokol i e-maily
 * dál čtou celou větu, ne prázdný řádek.
 */
export const DEFAULT_CLAIM_REASON: Record<ClaimKind, string> = {
  reklamace: "Reklamace",
  vraceni: "Vrácení zboží",
  odstoupeni: "Odstoupení od smlouvy",
}

/**
 * Důvod k uložení: text zákazníka, a když žádný není, výchozí věta podle
 * druhu. U reklamace text povinný je (hlídá `checkClaimRules`), sem se tedy
 * prázdný dostane jen u odstoupení / vrácení.
 */
export const claimReasonFor = (
  kind: string | null | undefined,
  reason: string | null | undefined
): string => {
  const text = (reason ?? "").trim()
  if (text) return text
  return isClaimKind(kind) ? DEFAULT_CLAIM_REASON[kind] : "Žádost o vrácení"
}

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

/**
 * Vrácení rozdílu po zákaznické úpravě objednávky (docs/uprava-objednavky-plan.md
 * §3c.6). Záměrně MIMO `CLAIM_KINDS`: zákazník ho nepodává formulářem
 * (`isClaimKind` hlídá příjem žádostí) — zakládá ho server sám, schválený,
 * s rozdílem jako jediným řádkem (lib/order-edit/edit-refund-claim.ts).
 */
export const EDIT_REFUND_KIND = "uprava" as const

export const isEditRefundKind = (kind: unknown): boolean => kind === EDIT_REFUND_KIND

/**
 * Blokuje otevřená žádost podání další? Ano — kromě vrácení rozdílu po úpravě:
 * to zákazník nepodával a čekání na refundaci mu nesmí zavřít reklamaci.
 */
export const blocksNewClaim = (request: {
  status?: string | null
  kind?: string | null
}): boolean => isOpenStatus(request.status) && !isEditRefundKind(request.kind)

export const kindLabel = (kind: string | null | undefined): string =>
  isClaimKind(kind)
    ? KIND_LABEL[kind]
    : isEditRefundKind(kind)
      ? "Vrácení rozdílu po úpravě objednávky"
      : "Žádost o vrácení"

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
 * Příčina poškození (§11.3, §13.7):
 * - `"carrier"` = zásilka dorazila poškozená → u České pošty reklamuje
 *   příjemce (zákazník) do 2 pracovních dnů od doručení; u nás běží reklamace
 *   dál (12. 10. 2026, Matěj — viz `CP_CUSTOMER_CLAIM_TEXT`);
 * - `"damaged"` = poškozený kus (viditelné poškození) — bez dopravce, ale
 *   fotky jsou povinné stejně, protože bez nich se poškození nedá posoudit;
 * - `null` = vada (praskliny, protéká, odprýsknutá glazura…; fotky dobrovolné).
 */
export type DamageCause = "carrier" | "damaged"

export const DAMAGE_CAUSES: readonly DamageCause[] = ["carrier", "damaged"]

export const isDamageCause = (value: unknown): value is DamageCause =>
  typeof value === "string" &&
  (DAMAGE_CAUSES as readonly string[]).includes(value)

export const DAMAGE_CAUSE_LABEL: Record<DamageCause, string> = {
  carrier: "Poškozeno přepravou",
  damaged: "Poškozený kus",
}

export const damageCauseLabel = (value: unknown): string | null =>
  isDamageCause(value) ? DAMAGE_CAUSE_LABEL[value] : null

/**
 * Věta do protokolu („Příčina poškození"). U dopravce musí být vidět, že
 * reklamaci u České pošty uplatňuje příjemce (podle podmínek ČP to odesílatel
 * za něj udělat nemůže — 12. 10. 2026, Matěj); u poškozeného kusu, že důkazem
 * jsou fotky z žádosti. Protokol ji tiskne doslova — žádné skládání v PDF.
 */
export const damageCauseSentence = (value: unknown): string | null => {
  if (value === "carrier") {
    return "Poškozeno přepravou — zásilka dorazila poškozená; reklamaci u České pošty uplatňuje příjemce do 2 pracovních dnů od doručení."
  }
  if (value === "damaged") {
    return "Poškozený kus — viditelné poškození zboží (fotky přiloženy k žádosti)."
  }
  return null
}

/** Fotky jsou povinné u obou příčin poškození (§11.3, §13.7). */
export const photosRequiredFor = (value: unknown): boolean =>
  value === "carrier" || value === "damaged"

/**
 * Reklamace zásilky u České pošty (§11.3) — oficiální stránka „Reklamace
 * a stížnosti": kdo reklamuje (poškozený obsah = adresát), lhůty (2 pracovní
 * dny), online podání (aplikace Sledovat zásilku / Pošta Online) a formuláře
 * ke stažení.
 *
 * Ověřeno 12. 10. 2026: dřívější `ceskaposta.cz/reklamace` i
 * `ceskaposta.cz/ereklamace` vrací 404; samotná eReklamace
 * (`postaonline.cz/ereklamace`) chce přihlášení a hlásila „aplikace je
 * momentálně nedostupná" — proto odkaz na rozcestník ČP, ne přímo na aplikaci.
 * Stejnou adresu nese storefront (`CP_CLAIM_URL` v `@lib/util/claims`).
 */
export const CP_CLAIM_FORM_URL =
  "https://www.ceskaposta.cz/rady-a-tipy/jine/reklamace-a-stiznosti"

/** Lhůta pro hlášení poškození dopravci — do e-mailu majitelce. */
export const CP_DAMAGE_REPORT_DEADLINE_TEXT =
  "Poškození se České poště hlásí neprodleně, nejpozději do 2 pracovních dnů od dodání — jinak nárok na náhradu propadá."

/**
 * Pokyn zákazníkovi u „Balík dorazil poškozený" (12. 10. 2026, Matěj):
 * reklamaci u přepravce podává příjemce, a to do 2 pracovních dnů. Do
 * potvrzovacích e-mailů; odkaz `CP_CLAIM_FORM_URL` vykreslí šablona hned za
 * větou.
 */
export const CP_CUSTOMER_CLAIM_TEXT =
  "Poškození zásilky je potřeba nahlásit také České poště — reklamaci u přepravce podává příjemce, tedy vy, nejpozději do 2 pracovních dnů od doručení (na pobočce nebo online). Postup a formulář najdete na stránce České pošty:"
