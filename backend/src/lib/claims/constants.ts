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

/**
 * Blokuje otevřená žádost NOVÉ ODSTOUPENÍ? Jen když už běží odstoupení nebo
 * vrácení zboží (i starý řádek bez druhu — takové byly „vrácení peněz").
 * Otevřená reklamace ani vrácení rozdílu po úpravě odstoupení neblokují:
 * odstoupení je jednostranné právo spotřebitele (§ 1829 OZ) a tlačítko musí
 * být k dispozici po celou lhůtu (§ 1830a) — fronta žádostí to nesmí zastavit.
 */
export const blocksWithdrawal = (request: {
  status?: string | null
  kind?: string | null
}): boolean =>
  isOpenStatus(request.status) &&
  (request.kind === "odstoupeni" ||
    request.kind === "vraceni" ||
    (!isClaimKind(request.kind) && !isEditRefundKind(request.kind)))

/**
 * Kudy žádost přišla (`return_request.channel`). Obě zákaznické routy jsou
 * online rozhraní obchodu: tokenová stránka (tlačítko „Odstoupit od smlouvy",
 * formulář reklamace) i záložní formulář číslo + e-mail.
 */
export type ClaimChannel = "online"

export const CLAIM_CHANNEL_ONLINE: ClaimChannel = "online"

export const CLAIM_CHANNEL_LABEL: Record<ClaimChannel, string> = {
  online: "online na webu obchodu",
}

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
 * - `"carrier"` = zásilka dorazila poškozená → pro zákazníka běžná reklamace
 *   u nás; škodu u České pošty řeší prodávající (14. 10. 2026, právní audit
 *   §4.1 — viz `CARRIER_DAMAGE_CUSTOMER_TEXT`);
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
 * Věta do protokolu („Příčina poškození"). U dopravce: za vadu při převzetí
 * odpovídá prodávající (§ 2161 odst. 1 OZ) a nebezpečí škody přechází na
 * spotřebitele až převzetím (§ 2159 odst. 2 OZ) — škodu u dopravce proto řeší
 * prodávající, pro zákazníka je to běžná reklamace bez lhůty České pošty
 * (14. 10. 2026, právní audit §4.1; dřívější věta „reklamaci u ČP uplatňuje
 * příjemce do 2 pracovních dnů" přenášela vztah prodávající–dopravce na
 * zákazníka). U poškozeného kusu, že důkazem jsou fotky z žádosti. Protokol
 * ji tiskne doslova — žádné skládání v PDF.
 */
export const damageCauseSentence = (value: unknown): string | null => {
  if (value === "carrier") {
    return "Poškozeno přepravou — zásilka dorazila poškozená. Za poškození odpovídá prodávající; škodu u dopravce řeší sám."
  }
  if (value === "damaged") {
    return "Poškozený kus — viditelné poškození zboží (fotky přiloženy k žádosti)."
  }
  return null
}

/**
 * Fotky jsou povinné u poškozeného kusu (§13.7). U „Balík dorazil poškozený"
 * ne: fotky obalu a zboží nám pomohou se škodou u České pošty, podmínkou
 * reklamace ale nejsou (14. 10. 2026 — reklamaci nesmí zastavit vztah
 * prodávající–dopravce).
 */
export const photosRequiredFor = (value: unknown): boolean => value === "damaged"

/**
 * Reklamace zásilky u České pošty (§11.3) — oficiální stránka „Reklamace
 * a stížnosti": kdo reklamuje, lhůty (2 pracovní dny), online podání
 * (aplikace Sledovat zásilku / Pošta Online) a formuláře ke stažení. Od
 * 14. 10. 2026 jen pro MAJITELKU (upozornění při poškození přepravou) —
 * zákazníkovi se lhůta dopravce ani formulář ČP jako povinnost neukazuje.
 *
 * Ověřeno 12. 10. 2026: dřívější `ceskaposta.cz/reklamace` i
 * `ceskaposta.cz/ereklamace` vrací 404; samotná eReklamace
 * (`postaonline.cz/ereklamace`) chce přihlášení a hlásila „aplikace je
 * momentálně nedostupná" — proto odkaz na rozcestník ČP, ne přímo na aplikaci.
 * Stejnou adresu nese storefront (`CP_CLAIM_URL` v `@lib/util/claims`).
 */
export const CP_CLAIM_INFO_URL =
  "https://www.ceskaposta.cz/rady-a-tipy/jine/reklamace-a-stiznosti"

/**
 * Formulář České pošty „Reklamace poškození" (PDF) a pokyny k němu — přímé
 * odkazy. Ověřeno 12. 10. 2026: oba vrací PDF. Od 14. 10. 2026 je dostává
 * majitelka v upozornění na poškození přepravou (`carrierDamageDescription`);
 * zákaznické e-maily je jako povinný krok neuvádí (právní audit §4.1).
 */
export const CP_CLAIM_FORM_URL =
  "https://www.ceskaposta.cz/documents/d/guest/formular-reklamace-pdf?download=true"
export const CP_CLAIM_GUIDE_URL =
  "https://www.ceskaposta.cz/documents/d/guest/pokyny-pro-podani-reklamace-pri-poskozeni?download=true"

/**
 * Lhůta pro hlášení poškození dopravci — JEN do e-mailu majitelce. Je to
 * lhůta mezi prodávající a Českou poštou; zákazníkovy reklamace se netýká.
 */
export const CP_DAMAGE_REPORT_DEADLINE_TEXT =
  "Poškození se České poště hlásí neprodleně, nejpozději do 2 pracovních dnů od dodání — jinak nárok na náhradu od pošty propadá. Zákazníkovy reklamace u vás se tato lhůta netýká."

/**
 * Věta zákazníkovi u „Balík dorazil poškozený" (14. 10. 2026, právní audit
 * §4.1): poškození řeší s dopravcem prodávající, zákazník nic dalšího podávat
 * nemusí. Obal a fotky jsou PROSBA, ne podmínka. Nahrazuje dřívější
 * `CP_CUSTOMER_CLAIM_TEXT` („reklamaci u přepravce podává příjemce, do
 * 2 pracovních dnů"), která z lhůty dopravce dělala podmínku reklamace.
 */
export const CARRIER_DAMAGE_CUSTOMER_TEXT =
  "Poškození při přepravě řešíme s Českou poštou my — vy kvůli tomu nikam chodit ani nic podávat nemusíte. Pokud můžete, nechte si prosím obal a výplň, dokud se vám neozveme; fotky obalu i zboží nám pomohou. Kdyby Česká pošta potřebovala vaši součinnost (například sepsat záznam o poškození), dáme vám vědět — vaši reklamaci to nijak nepodmiňuje."
