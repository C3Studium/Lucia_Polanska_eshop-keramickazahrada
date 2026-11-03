import {
  ButtonRow,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  Greeting,
  LedgerEnd,
  LedgerRow,
  MultiLine,
  Note,
  P,
  Signature,
} from "../components/email-ui"
import { useCopy, useEmailLocale } from "../components/email-i18n"
import { storeLink } from "../../../lib/storefront-url"
import type { Localized } from "../../../lib/email-locale"

interface ReturnApprovedEmailProps {
  customerName?: string;
  orderNumber?: string;
  returnNumber?: string;
  /** „reklamace" | „vraceni" | „odstoupeni". */
  kind?: string | null;
  /** Rozhodnutí: „repair" | „replace" | „discount" | „refund" (odstoupení/vrácení = refund). */
  resolution?: string | null;
  /** Popisek rozhodnutí v jazyce e-mailu („oprava", „výměna za nový kus", …). */
  resolutionLabel?: string;
  /** Položky — řádek za položku („název · varianta · N ks · částka"), nebo slova zákazníka. */
  approvedItems?: string;
  /** Totéž ze společného základu e-mailů (`claimEmailBase`) — záloha za `approvedItems`. */
  items?: string;
  /** Balík dorazil poškozený (§11.3). */
  carrierDamage?: boolean;
  /** Poškozený kus (§13.7). */
  damagedItem?: boolean;
  returnReason?: string;
  returnMethod?: string;
  returnDeadline?: string;
  /** Adresa z nastavení (víceřádkově). Bez ní se řádek nevykreslí. */
  returnAddress?: string;
  /** Pokyny z nastavení (volitelné). */
  returnInstructions?: string;
  /** Musí zboží cestovat zpět? (ne u slevy — zboží zůstává zákazníkovi) */
  goodsReturnRequired?: boolean;
  /** Odstoupení před odesláním — zboží nikdy neodešlo, nic se neposílá. */
  nothingToReturn?: boolean;
  orderLink?: string;
  claimsUrl?: string;
  /** Odkaz na PDF reklamační protokol s rozhodnutím. */
  protocolUrl?: string;
}

/** Texty po jazycích (lib/email-locale) — čeština je původní znění. */
const COPY: Localized<{
  /** Co bude následovat — podle rozhodnutí (docs/reklamace-a-zruseni.md §6). */
  nextStep: Record<"repair" | "replace" | "discount" | "refund", string>
  defaultReturnMethod: string
  eyebrowClaim: string
  eyebrowReturn: string
  h1Claim: string
  h1Cancelled: string
  h1Return: string
  accentClaim: string
  accentCancelled: string
  accentReturn: string
  introClaim: string
  introCancelled: string
  introReturn: string
  deadlineClaim: string
  deadlineReturn: string
  previewClaim: (order: string) => string
  previewReturn: (order: string) => string
  order: string
  returnNo: string
  goods: string
  reason: string
  cause: string
  carrierDamage: string
  damagedItem: string
  resolution: string
  method: string
  address: string
  deadline: string
  nothingToReturn: string
  carrierNote: string
  trackClaim: string
  viewOrder: string
  protocol: string
  downloadProtocol: string
  packing: string
}> = {
  cs: {
    nextStep: {
      repair:
        "Kousek opravím a pošlu vám ho zpět. O přijetí zásilky i o odeslání opraveného kusu vám dám vědět e-mailem.",
      replace:
        "Jakmile ke mně kousek dorazí, pošlu vám nový. O přijetí zásilky i o odeslání výměny vám dám vědět e-mailem.",
      discount:
        "Kousek zůstává u vás a část ceny vám vrátím stejnou cestou, jakou ke mně platba přišla. Nic posílat nemusíte.",
      refund:
        "Jakmile ke mně výrobky dorazí a prohlédnu si je, vrátím vám peníze stejnou cestou, jakou ke mně platba přišla.",
    },
    defaultReturnMethod: "Zásilka na adresu dílny",
    eyebrowClaim: "Reklamace",
    eyebrowReturn: "Vrácení",
    h1Claim: "Reklamace",
    h1Cancelled: "Objednávka",
    h1Return: "Vrácení",
    accentClaim: "uznána.",
    accentCancelled: "zrušena.",
    accentReturn: "schváleno.",
    introClaim:
      "vaši reklamaci jsem posoudila a uznávám ji. Níže najdete, jak ji vyřídím a co bude následovat.",
    introCancelled:
      "vaší žádosti vyhovuji. Objednávka k vám ještě neodešla, takže nic posílat nemusíte — ruším ji.",
    introReturn:
      "vaší žádosti o vrácení vyhovuji. Níže najdete vše potřebné — kam kousky poslat a dokdy.",
    deadlineClaim: "vyřídím do 30 dnů od uplatnění",
    deadlineReturn: "peníze vrátím do 14 dnů od přijetí zboží",
    previewClaim: (order) => `Reklamaci k objednávce ${order} uznávám.`,
    previewReturn: (order) => `Vrácení k objednávce ${order} je schválené.`,
    order: "Objednávka",
    returnNo: "Vrácení",
    goods: "Zboží",
    reason: "Důvod",
    cause: "Příčina",
    carrierDamage: "Poškozeno přepravou",
    damagedItem: "Poškozený kus",
    resolution: "Způsob vyřízení",
    method: "Způsob vrácení",
    address: "Adresa",
    deadline: "Lhůta",
    nothingToReturn:
      "Nic posílat nemusíte. Pokud jste už něco zaplatili, vrátím to stejnou cestou, jakou ke mně platba přišla; jinak je tím vše vyřízené.",
    carrierNote: " Poškození při přepravě řeším s dopravcem já — vy nic dalšího podávat nemusíte.",
    trackClaim: "Sledovat stav žádosti",
    viewOrder: "Zobrazit objednávku",
    protocol: "Protokol (PDF)",
    downloadProtocol: "Stáhnout protokol (PDF)",
    packing:
      "Kousky prosím pečlivě zabalte, ať cestu zpět přečkají ve zdraví, a přiložte číslo objednávky. Číslo zásilky mi můžete zapsat na stránce žádosti. Jakmile zásilka dorazí, dám vám vědět e-mailem.",
  },
  sk: {
    nextStep: {
      repair:
        "Kúsok opravím a pošlem vám ho späť. O prijatí zásielky aj o odoslaní opraveného kusu vám dám vedieť e-mailom.",
      replace:
        "Hneď ako ku mne kúsok dorazí, pošlem vám nový. O prijatí zásielky aj o odoslaní výmeny vám dám vedieť e-mailom.",
      discount:
        "Kúsok zostáva u vás a časť ceny vám vrátim rovnakou cestou, akou ku mne platba prišla. Nič posielať nemusíte.",
      refund:
        "Hneď ako ku mne výrobky dorazia a prezriem si ich, vrátim vám peniaze rovnakou cestou, akou ku mne platba prišla.",
    },
    defaultReturnMethod: "Zásielka na adresu dielne",
    eyebrowClaim: "Reklamácia",
    eyebrowReturn: "Vrátenie",
    h1Claim: "Reklamácia",
    h1Cancelled: "Objednávka",
    h1Return: "Vrátenie",
    accentClaim: "uznaná.",
    accentCancelled: "zrušená.",
    accentReturn: "schválené.",
    introClaim:
      "vašu reklamáciu som posúdila a uznávam ju. Nižšie nájdete, ako ju vybavím a čo bude nasledovať.",
    introCancelled:
      "vašej žiadosti vyhovujem. Objednávka k vám ešte neodišla, takže nič posielať nemusíte — ruším ju.",
    introReturn:
      "vašej žiadosti o vrátenie vyhovujem. Nižšie nájdete všetko potrebné — kam kúsky poslať a dokedy.",
    deadlineClaim: "vybavím do 30 dní od uplatnenia",
    deadlineReturn: "peniaze vrátim do 14 dní od prijatia tovaru",
    previewClaim: (order) => `Reklamáciu k objednávke ${order} uznávam.`,
    previewReturn: (order) => `Vrátenie k objednávke ${order} je schválené.`,
    order: "Objednávka",
    returnNo: "Vrátenie",
    goods: "Tovar",
    reason: "Dôvod",
    cause: "Príčina",
    carrierDamage: "Poškodené pri preprave",
    damagedItem: "Poškodený kus",
    resolution: "Spôsob vybavenia",
    method: "Spôsob vrátenia",
    address: "Adresa",
    deadline: "Lehota",
    nothingToReturn:
      "Nič posielať nemusíte. Ak ste už niečo zaplatili, vrátim to rovnakou cestou, akou ku mne platba prišla; inak je tým všetko vybavené.",
    carrierNote: " Poškodenie pri preprave riešim s prepravcom ja — vy nič ďalšie podávať nemusíte.",
    trackClaim: "Sledovať stav žiadosti",
    viewOrder: "Zobraziť objednávku",
    protocol: "Protokol (PDF)",
    downloadProtocol: "Stiahnuť protokol (PDF)",
    packing:
      "Kúsky, prosím, starostlivo zabaľte, aby cestu späť prečkali v zdraví, a priložte číslo objednávky. Číslo zásielky mi môžete zapísať na stránke žiadosti. Hneď ako zásielka dorazí, dám vám vedieť e-mailom.",
  },
  pl: {
    nextStep: {
      repair:
        "Naprawię egzemplarz i odeślę go Państwu. O otrzymaniu przesyłki i wysłaniu naprawionego egzemplarza poinformuję e-mailem.",
      replace:
        "Gdy tylko egzemplarz do mnie dotrze, wyślę Państwu nowy. O otrzymaniu przesyłki i wysłaniu wymiany poinformuję e-mailem.",
      discount:
        "Egzemplarz zostaje u Państwa, a część ceny zwrócę tą samą drogą, którą dotarła do mnie płatność. Nie trzeba niczego odsyłać.",
      refund:
        "Gdy tylko wyroby do mnie dotrą i je obejrzę, zwrócę pieniądze tą samą drogą, którą dotarła do mnie płatność.",
    },
    defaultReturnMethod: "Przesyłka na adres pracowni",
    eyebrowClaim: "Reklamacja",
    eyebrowReturn: "Zwrot",
    h1Claim: "Reklamacja",
    h1Cancelled: "Zamówienie",
    h1Return: "Zwrot",
    accentClaim: "uznana.",
    accentCancelled: "anulowane.",
    accentReturn: "zaakceptowany.",
    introClaim:
      "Rozpatrzyłam Państwa reklamację i uznaję ją. Poniżej opisuję, jak ją załatwię i co będzie dalej.",
    introCancelled:
      "Uwzględniam Państwa wniosek. Zamówienie nie zostało jeszcze wysłane, więc nie trzeba niczego odsyłać — anuluję je.",
    introReturn:
      "Uwzględniam Państwa wniosek o zwrot. Poniżej jest wszystko, co potrzebne — dokąd odesłać egzemplarze i do kiedy.",
    deadlineClaim: "rozpatrzę w ciągu 30 dni od złożenia",
    deadlineReturn: "pieniądze zwrócę w ciągu 14 dni od otrzymania towaru",
    previewClaim: (order) => `Uznaję reklamację do zamówienia ${order}.`,
    previewReturn: (order) => `Zwrot do zamówienia ${order} został zaakceptowany.`,
    order: "Zamówienie",
    returnNo: "Zwrot",
    goods: "Towar",
    reason: "Powód",
    cause: "Przyczyna",
    carrierDamage: "Uszkodzone w transporcie",
    damagedItem: "Uszkodzony egzemplarz",
    resolution: "Sposób załatwienia",
    method: "Sposób zwrotu",
    address: "Adres",
    deadline: "Termin",
    nothingToReturn:
      "Nie trzeba niczego odsyłać. Jeśli coś już Państwo zapłacili, zwrócę to tą samą drogą, którą dotarła do mnie płatność; w przeciwnym razie sprawa jest zakończona.",
    carrierNote:
      " Uszkodzenie w transporcie wyjaśniam z przewoźnikiem sama — nie muszą Państwo niczego dodatkowo składać.",
    trackClaim: "Sprawdź status zgłoszenia",
    viewOrder: "Zobacz zamówienie",
    protocol: "Protokół (PDF)",
    downloadProtocol: "Pobierz protokół (PDF)",
    packing:
      "Proszę starannie zapakować egzemplarze, żeby bezpiecznie przetrwały drogę powrotną, i dołączyć numer zamówienia. Numer przesyłki mogą Państwo wpisać na stronie zgłoszenia. Gdy przesyłka dotrze, dam znać e-mailem.",
  },
  de: {
    nextStep: {
      repair:
        "Ich repariere das Stück und schicke es Ihnen zurück. Über den Eingang der Sendung und den Versand des reparierten Stücks informiere ich Sie per E-Mail.",
      replace:
        "Sobald das Stück bei mir ist, schicke ich Ihnen ein neues. Über den Eingang der Sendung und den Versand des Ersatzes informiere ich Sie per E-Mail.",
      discount:
        "Das Stück bleibt bei Ihnen, und einen Teil des Preises erstatte ich auf demselben Weg, auf dem Ihre Zahlung bei mir eingegangen ist. Sie müssen nichts zurückschicken.",
      refund:
        "Sobald die Stücke bei mir angekommen sind und ich sie geprüft habe, erstatte ich Ihnen den Betrag auf demselben Weg, auf dem Ihre Zahlung bei mir eingegangen ist.",
    },
    defaultReturnMethod: "Versand an die Adresse der Werkstatt",
    eyebrowClaim: "Reklamation",
    eyebrowReturn: "Rücksendung",
    h1Claim: "Reklamation",
    h1Cancelled: "Bestellung",
    h1Return: "Rücksendung",
    accentClaim: "anerkannt.",
    accentCancelled: "storniert.",
    accentReturn: "genehmigt.",
    introClaim:
      "ich habe Ihre Reklamation geprüft und erkenne sie an. Unten finden Sie, wie ich sie erledige und wie es weitergeht.",
    introCancelled:
      "ich entspreche Ihrer Anfrage. Die Bestellung ist noch nicht an Sie verschickt worden, Sie müssen also nichts zurückschicken – ich storniere sie.",
    introReturn:
      "ich entspreche Ihrer Rücksendeanfrage. Unten finden Sie alles Nötige – wohin Sie die Stücke schicken und bis wann.",
    deadlineClaim: "Erledigung innerhalb von 30 Tagen nach Eingang",
    deadlineReturn: "Erstattung innerhalb von 14 Tagen nach Eingang der Ware",
    previewClaim: (order) => `Ihre Reklamation zur Bestellung ${order} erkenne ich an.`,
    previewReturn: (order) => `Die Rücksendung zur Bestellung ${order} ist genehmigt.`,
    order: "Bestellung",
    returnNo: "Rücksendung",
    goods: "Ware",
    reason: "Grund",
    cause: "Ursache",
    carrierDamage: "Transportschaden",
    damagedItem: "Beschädigtes Stück",
    resolution: "Art der Erledigung",
    method: "Rücksendeweg",
    address: "Adresse",
    deadline: "Frist",
    nothingToReturn:
      "Sie müssen nichts zurückschicken. Falls Sie schon etwas bezahlt haben, erstatte ich es auf demselben Weg, auf dem Ihre Zahlung bei mir eingegangen ist; ansonsten ist damit alles erledigt.",
    carrierNote:
      " Den Transportschaden kläre ich selbst mit dem Versanddienst – Sie müssen nichts weiter einreichen.",
    trackClaim: "Status der Anfrage ansehen",
    viewOrder: "Bestellung ansehen",
    protocol: "Protokoll (PDF)",
    downloadProtocol: "Protokoll herunterladen (PDF)",
    packing:
      "Bitte verpacken Sie die Stücke sorgfältig, damit sie den Rückweg heil überstehen, und legen Sie die Bestellnummer bei. Die Sendungsnummer können Sie auf der Seite Ihrer Anfrage eintragen. Sobald die Sendung ankommt, gebe ich Ihnen per E-Mail Bescheid.",
  },
  en: {
    nextStep: {
      repair:
        "I'll repair the piece and send it back to you. I'll e-mail you when your parcel arrives and again when the repaired piece is on its way.",
      replace:
        "As soon as the piece reaches me, I'll send you a new one. I'll e-mail you when your parcel arrives and again when the replacement is on its way.",
      discount:
        "You keep the piece, and I'll refund part of the price the same way your payment reached me. You don't need to send anything back.",
      refund:
        "As soon as the pieces reach me and I've checked them over, I'll refund your money the same way your payment reached me.",
    },
    defaultReturnMethod: "By post to the studio's address",
    eyebrowClaim: "Complaint",
    eyebrowReturn: "Return",
    h1Claim: "Complaint",
    h1Cancelled: "Order",
    h1Return: "Return",
    accentClaim: "accepted.",
    accentCancelled: "cancelled.",
    accentReturn: "approved.",
    introClaim:
      "I've looked into your complaint and I accept it. Below you'll find how I'll put things right and what happens next.",
    introCancelled:
      "I'm happy to grant your request. Your order hasn't been sent to you yet, so there's nothing to send back — I'm cancelling it.",
    introReturn:
      "I'm happy to grant your return request. Below you'll find everything you need — where to send the pieces and by when.",
    deadlineClaim: "settled within 30 days of the complaint being made",
    deadlineReturn: "refund within 14 days of receiving the goods",
    previewClaim: (order) => `I accept your complaint about order ${order}.`,
    previewReturn: (order) => `The return for order ${order} has been approved.`,
    order: "Order",
    returnNo: "Return",
    goods: "Goods",
    reason: "Reason",
    cause: "Cause",
    carrierDamage: "Damaged in transit",
    damagedItem: "Damaged piece",
    resolution: "How it will be settled",
    method: "How to return",
    address: "Address",
    deadline: "Deadline",
    nothingToReturn:
      "You don't need to send anything. If you've already paid something, I'll refund it the same way your payment reached me; otherwise, that's everything settled.",
    carrierNote:
      " I'll deal with the carrier about the transit damage myself — you don't need to file anything else.",
    trackClaim: "Check the status of your request",
    viewOrder: "View order",
    protocol: "Record (PDF)",
    downloadProtocol: "Download the record (PDF)",
    packing:
      "Please pack the pieces carefully so they survive the journey back in one piece, and include your order number. You can enter the tracking number on your request page. I'll let you know by e-mail as soon as the parcel arrives.",
  },
}

/**
 * Číslo vrácení a seznam objektů se vykreslí jen s reálnými daty — vymyšlená
 * výchozí hodnota by v ostrém e-mailu tvrdila, že se vrací něco jiného.
 * Adresa a pokyny přicházejí z nastavení obchodu; šablona žádnou nevymýšlí.
 */
function ReturnApprovedEmailComponent({
  customerName,
  orderNumber = "",
  returnNumber,
  kind,
  resolution,
  resolutionLabel,
  approvedItems,
  items,
  carrierDamage = false,
  damagedItem = false,
  returnReason,
  returnMethod,
  returnDeadline,
  returnAddress,
  returnInstructions,
  goodsReturnRequired,
  nothingToReturn = false,
  orderLink = "",
  claimsUrl,
  protocolUrl,
}: ReturnApprovedEmailProps) {
  const t = useCopy(COPY)
  const orderUrl = orderLink || storeLink()
  const isClaim = kind === "reklamace"
  const outcome = resolution ?? "refund"
  const objects = approvedItems || items
  // Zboží se vrací vždy, kromě slevy; starší volající bez vlajky = vrací se.
  const goodsBack = !nothingToReturn && (goodsReturnRequired ?? outcome !== "discount")
  const eyebrow = isClaim ? t.eyebrowClaim : t.eyebrowReturn
  const h1 = isClaim ? t.h1Claim : nothingToReturn ? t.h1Cancelled : t.h1Return
  const accent = isClaim ? t.accentClaim : nothingToReturn ? t.accentCancelled : t.accentReturn
  const intro = isClaim ? t.introClaim : nothingToReturn ? t.introCancelled : t.introReturn
  const deadline = returnDeadline || (isClaim ? t.deadlineClaim : t.deadlineReturn)
  const nextStep =
    t.nextStep[outcome as keyof typeof t.nextStep] ?? t.nextStep.refund

  return (
    <EmailLayout
      preview={isClaim ? t.previewClaim(orderNumber) : t.previewReturn(orderNumber)}
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <EmailH1 accent={accent}>{h1}</EmailH1>

      <Greeting name={customerName} />
      <P>{intro}</P>

      {orderNumber ? <LedgerRow label={t.order} value={orderNumber} /> : null}
      {returnNumber ? <LedgerRow label={t.returnNo} value={returnNumber} /> : null}
      {objects ? <LedgerRow label={t.goods} value={<MultiLine value={objects} />} /> : null}
      {returnReason ? <LedgerRow label={t.reason} value={returnReason} /> : null}
      {carrierDamage ? (
        <LedgerRow label={t.cause} value={t.carrierDamage} tone="clay" />
      ) : null}
      {damagedItem ? (
        <LedgerRow label={t.cause} value={t.damagedItem} tone="clay" />
      ) : null}
      {resolutionLabel ? (
        <LedgerRow label={t.resolution} value={resolutionLabel} strong tone="olive" />
      ) : null}
      {goodsBack ? (
        <LedgerRow label={t.method} value={returnMethod || t.defaultReturnMethod} />
      ) : null}
      {goodsBack && returnAddress ? (
        <LedgerRow
          label={t.address}
          value={returnAddress.split("\n").map((line, index) => (
            <span key={index}>
              {line}
              <br />
            </span>
          ))}
        />
      ) : null}
      <LedgerRow label={t.deadline} value={deadline} strong tone="clay" />
      <LedgerEnd />

      <Note tone="olive">
        {nothingToReturn ? t.nothingToReturn : nextStep}
        {/* 15. 10. 2026 (právní audit §4.1): za vadu při převzetí odpovídá
            prodávající (§ 2161, § 2159 odst. 2 OZ) — škodu u dopravce řešíme
            my, zákazník nic dalšího podávat nemusí. Ruší rozhodnutí z 12. 10.,
            podle kterého reklamoval u České pošty příjemce. */}
        {carrierDamage ? t.carrierNote : ""}
      </Note>

      {claimsUrl || orderUrl ? (
        <ButtonRow>
          <EmailButton href={claimsUrl || orderUrl}>
            {claimsUrl ? t.trackClaim : t.viewOrder}
          </EmailButton>
          {protocolUrl ? (
            <>
              <span style={{ display: "inline-block", width: "12px" }} />
              <EmailButton href={protocolUrl} variant="ghost">
                {t.protocol}
              </EmailButton>
            </>
          ) : null}
        </ButtonRow>
      ) : protocolUrl ? (
        <ButtonRow>
          <EmailButton href={protocolUrl}>{t.downloadProtocol}</EmailButton>
        </ButtonRow>
      ) : null}

      {goodsBack ? (
        <P small>
          {returnInstructions ? `${returnInstructions} ` : ""}
          {t.packing}
        </P>
      ) : null}
      <Signature />
    </EmailLayout>
  )
}

export const ReturnApprovedEmail = (props: ReturnApprovedEmailProps) => (
  <ReturnApprovedEmailComponent {...props} />
)

// Mock data for preview/development — hodnoty řádků (způsob vyřízení,
// lhůta…) skládá odesílatel v jazyce zákazníka, proto náhled po jazycích.
const mockBase: ReturnApprovedEmailProps = {
  orderNumber: "#12345",
  kind: "vraceni",
  resolution: "refund",
  returnAddress: "Keramická zahrada\nPutim 229\n397 01 Písek",
  orderLink: "https://keramickazahrada.cz/orders/12345",
}

const mockReturnApproved: Localized<ReturnApprovedEmailProps> = {
  cs: {
    ...mockBase,
    customerName: "Jan Novák",
    resolutionLabel: "vrácení peněz",
    approvedItems: "Keramický hrnek — modrý, Keramický talíř — bílý",
    returnReason: "Požadavek zákazníka",
    returnMethod: "Zásilka na adresu dílny",
    returnDeadline: "peníze vrátím do 14 dnů od přijetí zboží",
    returnInstructions: "Přiložte prosím číslo objednávky.",
  },
  sk: {
    ...mockBase,
    customerName: "Ján Novák",
    resolutionLabel: "vrátenie peňazí",
    approvedItems: "Keramický hrnček — modrý, Keramický tanier — biely",
    returnReason: "Nesedí mi farba",
    returnMethod: "Zásielka na adresu ateliéru",
    returnDeadline: "peniaze vrátime do 14 dní od prijatia tovaru",
  },
  pl: {
    ...mockBase,
    customerName: "Anna Nowak",
    resolutionLabel: "zwrot pieniędzy",
    approvedItems: "Kubek ceramiczny — niebieski, Talerz ceramiczny — biały",
    returnReason: "Kolor nie pasuje",
    returnMethod: "Przesyłka na adres pracowni",
    returnDeadline: "pieniądze zwrócimy w ciągu 14 dni od otrzymania towaru",
  },
  de: {
    ...mockBase,
    customerName: "Jana Neumann",
    resolutionLabel: "Erstattung des Kaufpreises",
    approvedItems: "Keramiktasse — blau, Keramikteller — weiß",
    returnReason: "Die Farbe passt nicht",
    returnMethod: "Versand an die Adresse der Werkstatt",
    returnDeadline: "den Betrag erstatten wir innerhalb von 14 Tagen nach Eingang der Ware",
  },
  en: {
    ...mockBase,
    customerName: "Emma Clarke",
    resolutionLabel: "refund of the purchase price",
    approvedItems: "Ceramic mug — blue, Ceramic plate — white",
    returnReason: "The colour isn't quite right",
    returnMethod: "By post to the studio's address",
    returnDeadline: "we will refund the money within 14 days of receiving the goods",
  },
}

const ReturnApprovedPreview = () => (
  <ReturnApprovedEmailComponent {...mockReturnApproved[useEmailLocale()]} />
)

export default () => <ReturnApprovedPreview />
