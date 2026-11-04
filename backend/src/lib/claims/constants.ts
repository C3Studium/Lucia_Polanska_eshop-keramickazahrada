import type { Localized } from "../email-locale"

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
 * Zrušení ZAKÁZKY zákazníkem podle obchodních podmínek (LEGAL_AUDIT.md § 0,
 * Z4–Z6; lib/made-to-order/customer-cancel). Záměrně MIMO `CLAIM_KINDS`:
 * není to odstoupení podle § 1829 (zakázka je z něj vyňata, § 1837 písm. d),
 * ale smluvní zrušení — a zákazník ho nepodává formulářem žádosti, nýbrž
 * tlačítkem „Zrušit zakázku", které zakládá a rovnou vyřizuje server
 * (refund podle fáze, protokol jako potvrzení o vyřízení).
 */
export const COMMISSION_CANCEL_KIND = "zruseni_zakazky" as const

export const isCommissionCancelKind = (kind: unknown): boolean =>
  kind === COMMISSION_CANCEL_KIND

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
      : isCommissionCancelKind(kind)
        ? "Zrušení zakázky"
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
 * Formulář České pošty „Reklamace poškození" (PDF) a pokyny k němu.
 *
 * NIKAM SE NEODKAZUJÍ a nemají. Ověřeno 3. 11. 2026 přímo z toho souboru
 * (patička 09/2024): platí výslovně pro „Balík Do ruky nad 30 kg a Balíkovna
 * plus nad 30 kg". Keramická zásilka takovou hmotnost nemá, takže by to byl
 * formulář k něčemu jinému. Pro běžnou zásilku Česká pošta formulář ke
 * stažení nevydává — reklamace se podává u přepážky nebo elektronicky.
 *
 * Konstanty zůstávají jako zámek: testy e-mailů ověřují, že ani jeden text
 * tyhle adresy neobsahuje. Kdo je sem vrátí, rozsvítí test.
 */
export const CP_CLAIM_FORM_URL =
  "https://www.ceskaposta.cz/documents/d/guest/formular-reklamace-pdf?download=true"
export const CP_CLAIM_GUIDE_URL =
  "https://www.ceskaposta.cz/documents/d/guest/pokyny-pro-podani-reklamace-pri-poskozeni?download=true"

/**
 * Lhůta pro hlášení poškození dopravci — JEN do e-mailu majitelce. Zákazník
 * má v „zásilka doručena" vlastní znění (`CARRIER_DAMAGE_CUSTOMER_TEXT`);
 * tohle je připomínka majitelce, že po dvou dnech nedostane náhradu nikdo.
 * Na reklamaci u nás to nic nemění — reklamační řád, čl. 5.
 */
export const CP_DAMAGE_REPORT_DEADLINE_TEXT =
  "Poškození se České poště hlásí neprodleně, nejpozději do 2 pracovních dnů od dodání — jinak nárok na náhradu od pošty propadá. Zákazníkovy reklamace u vás se tato lhůta netýká."

/**
 * Věta zákazníkovi u „Balík dorazil poškozený".
 *
 * ## Rozhodnutí majitelky (4. 11. 2026)
 *
 * Poškozená krabice jde za dopravcem — zabaleno je dobře, a co se s obalem
 * stalo po cestě, uznává a platí Česká pošta. Zákazník se s tím tedy obrací
 * na poštu, a není to jen pohodlnější cesta: náhradu za poškozenou zásilku
 * vyplácí ČP ADRESÁTOVI, takže ji za něj nikdo jiný uplatnit nemůže
 * (reklamační podmínky ČP). Rozbitý výrobek v nepoškozené krabici je naše
 * věc a řeší se reklamací u nás.
 *
 * ## Co ve větě zůstává a proč
 *
 * Reklamační řád, čl. 5 (vydané znění od 3. 11. 2026) říká, že poškození při
 * přepravě je vada při převzetí, reklamuje se U NÁS a žádná lhůta dopravce
 * zákazníka nezavazuje. Dokud tohle znění platí, nesmí věta tvrdit, že se na
 * nás obrátit nemůže — proto končí tím, že jeho reklamaci vyřídíme, i když
 * na poště neuspěje. Udělat z pošty jedinou cestu znamená nové znění
 * reklamačního řádu, ne jinou větu v e-mailu.
 *
 * Dřívější podoba („vy kvůli tomu nikam chodit ani nic podávat nemusíte",
 * právní audit §4.1) měla jednu nechtěnou cenu: dvoudenní lhůta pošty
 * propadla, než se k zásilce kdokoli dostal, a náhradu pak nedostal nikdo.
 */
export const CARRIER_DAMAGE_CUSTOMER_TEXT =
  "Poškozený obal je škoda dopravce: nahlaste prosím zásilku na kterékoli poště, nejlépe do dvou pracovních dnů od převzetí — náhradu Česká pošta vyplácí adresátovi, tedy vám. Vezměte s sebou zásilku i s obalem a výplní, nebo aspoň fotky obalu a zboží. Napište prosím i nám; pokud vám na poště reklamaci nepřijmou, vyřídíme ji my — vaše práva u nás na dopravci nezávisí."

/**
 * Táž věta v jazyce zákazníka (e-mail „žádost přijata", lib/email-locale).
 * Tady, a ne v šabloně, ať čeština zůstane jedna — sdílí ji i protokol.
 */
export const CARRIER_DAMAGE_CUSTOMER_TEXTS: Localized<string> = {
  cs: CARRIER_DAMAGE_CUSTOMER_TEXT,
  sk: "Poškodený obal je škoda dopravcu: nahláste, prosím, zásielku na ktorejkoľvek pošte, najlepšie do dvoch pracovných dní od prevzatia — náhradu Česká pošta vypláca adresátovi, teda vám. Vezmite s sebou zásielku aj s obalom a výplňou, alebo aspoň fotky obalu a tovaru. Napíšte, prosím, aj nám; ak vám na pošte reklamáciu neprijmú, vyriešime ju my — vaše práva u nás od dopravcu nezávisia.",
  pl: "Uszkodzone opakowanie to szkoda przewoźnika: prosimy zgłosić przesyłkę na dowolnej poczcie, najlepiej w ciągu dwóch dni roboczych od odbioru — odszkodowanie Poczta Czeska wypłaca adresatowi, czyli Państwu. Prosimy zabrać przesyłkę razem z opakowaniem i wypełnieniem, albo przynajmniej zdjęcia opakowania i towaru. Prosimy napisać również do nas; jeśli poczta nie przyjmie reklamacji, rozpatrzymy ją my — Państwa prawa u nas nie zależą od przewoźnika.",
  de: "Eine beschädigte Verpackung ist ein Schaden des Frachtführers: Melden Sie die Sendung bitte in einer beliebigen Postfiliale, am besten innerhalb von zwei Werktagen nach der Übernahme – die Tschechische Post zahlt die Entschädigung an den Empfänger, also an Sie. Bringen Sie die Sendung samt Verpackung und Füllmaterial mit, oder zumindest Fotos von Verpackung und Ware. Schreiben Sie bitte auch uns; nimmt die Post die Reklamation nicht an, bearbeiten wir sie – Ihre Rechte uns gegenüber hängen nicht vom Frachtführer ab.",
  en: "Damaged packaging is the carrier's liability: please report the parcel at any post office, ideally within two working days of receipt — Česká pošta pays the compensation to the addressee, that is to you. Take the parcel with its box and packing material, or at least photos of the packaging and the goods. Please write to us as well; if the post office turns the claim down, we will handle it — your rights with us do not depend on the carrier.",
}
