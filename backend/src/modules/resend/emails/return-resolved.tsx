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
import type { Localized } from "../../../lib/email-locale"

interface ReturnResolvedEmailProps {
  customerName?: string;
  orderNumber?: string;
  /** „reklamace" | „vraceni" | „odstoupeni". */
  kind?: string | null;
  /** „repair" | „replace" | „discount" | „refund". */
  resolution?: string | null;
  resolutionLabel?: string;
  /** Položky žádosti — řádek za položku („název · varianta · N ks · částka"). */
  items?: string;
  /** Vada vznikla přepravou (§11.3) — do potvrzení patří. */
  carrierDamage?: boolean;
  /** Poškozený kus (§13.7). */
  damagedItem?: boolean;
  /** Datum vyřízení (formátované) — povinná náležitost potvrzení (§19/3 ZOS). */
  resolvedAt?: string;
  /** Vrácená částka celkem (formátovaná) — jen když se peníze vracely. */
  refundAmount?: string;
  /** „stejnou cestou, jakou jste platili (přes ComGate) — na účtu do 3–5 pracovních dnů" / „ručně". */
  refundMethod?: string;
  /** Košík vrácení (§13.2) — řádek za řádek („název · N ks · částka"). */
  refundLines?: string;
  /** Dobropis (§13.3): číslo + odkaz na PDF, nebo věta, proč zatím není. */
  creditNoteNumber?: string;
  creditNoteUrl?: string;
  creditNoteNote?: string;
  /** Text majitelky do potvrzení (volitelný). */
  note?: string;
  orderLink?: string;
  claimsUrl?: string;
  /** PDF „potvrzení o vyřízení". */
  protocolUrl?: string;
}

/** Texty po jazycích (lib/email-locale) — čeština je původní znění. */
const COPY: Localized<{
  outcome: Record<"repair" | "replace" | "discount" | "refund", string>
  previewClaim: (order: string) => string
  previewEdit: (order: string) => string
  previewReturn: (order: string) => string
  eyebrowClaim: string
  eyebrowEdit: string
  eyebrowReturn: string
  h1Edit: string
  accentEdit: string
  h1Claim: string
  h1Return: string
  accentDone: string
  /** Shoda s rodem slova „reklamace" (SK/PL); česky neutrální „vyřízeno". */
  accentDoneClaim: string
  introClaim: string
  introEdit: string
  introReturn: string
  order: string
  goods: string
  cause: string
  carrierDamage: string
  damagedItem: string
  resolvedAt: string
  resolution: string
  refundLines: string
  refundAmount: string
  refundedVia: string
  creditNote: string
  creditNoteNo: (number: string) => string
  note: string
  downloadConfirmation: string
  trackClaim: string
  viewOrder: string
  creditNotePdf: string
  cardTiming: string
  manualRefund: string
  adr: string
  contact: string
}> = {
  cs: {
    outcome: {
      repair: "Kousek je opravený a míří k vám zpět.",
      replace: "Posílám vám nový kus.",
      discount: "Část ceny vám vracím — kousek zůstává u vás.",
      refund: "Peníze vám vracím stejnou cestou, jakou ke mně platba přišla.",
    },
    previewClaim: (order) => `Reklamace k objednávce ${order} je vyřízená.`,
    previewEdit: (order) => `Rozdíl po úpravě objednávky ${order} jsem vám vrátila.`,
    previewReturn: (order) => `Vrácení k objednávce ${order} je vyřízené.`,
    eyebrowClaim: "Reklamace",
    eyebrowEdit: "Úprava objednávky",
    eyebrowReturn: "Vrácení",
    h1Edit: "Rozdíl",
    accentEdit: "vrácen.",
    h1Claim: "Reklamace",
    h1Return: "Vrácení",
    accentDone: "vyřízeno.",
    accentDoneClaim: "vyřízeno.",
    introClaim:
      "vaše reklamace je vyřízená. Toto je písemné potvrzení o datu a způsobu vyřízení.",
    introEdit:
      "po vaší úpravě vyšla objednávka levněji — rozdíl jsem vám vrátila. Níže je shrnutí.",
    introReturn: "vaše vrácení je vyřízené. Níže je shrnutí, jak jsem je uzavřela.",
    order: "Objednávka",
    goods: "Zboží",
    cause: "Příčina",
    carrierDamage: "Poškozeno přepravou",
    damagedItem: "Poškozený kus",
    resolvedAt: "Vyřízeno dne",
    resolution: "Způsob vyřízení",
    refundLines: "Vrácené položky",
    refundAmount: "Vrácená částka",
    refundedVia: "Vráceno",
    creditNote: "Dobropis",
    creditNoteNo: (number) => `č. ${number}`,
    note: "Poznámka",
    downloadConfirmation: "Stáhnout potvrzení (PDF)",
    trackClaim: "Sledovat stav žádosti",
    viewOrder: "Zobrazit objednávku",
    creditNotePdf: "Dobropis (PDF)",
    cardTiming: "Připsání peněz na účet záleží na vaší bance, obvykle do 3–5 pracovních dnů. ",
    manualRefund:
      "Peníze vracím ručně (převodem na účet nebo hotově); pokud od vás budu potřebovat číslo účtu, ozvu se. ",
    adr: "Nesouhlasíte-li s vyřízením, máte právo obrátit se na Českou obchodní inspekci (www.coi.cz), případně na soud. ",
    contact: "Kdyby cokoli, napište mi na info@keramickazahrada.cz — odpovídám sama.",
  },
  sk: {
    outcome: {
      repair: "Kúsok je opravený a mieri späť k vám.",
      replace: "Posielam vám nový kus.",
      discount: "Časť ceny vám vraciam — kúsok zostáva u vás.",
      refund: "Peniaze vám vraciam rovnakou cestou, akou ku mne platba prišla.",
    },
    previewClaim: (order) => `Reklamácia k objednávke ${order} je vybavená.`,
    previewEdit: (order) => `Rozdiel po úprave objednávky ${order} som vám vrátila.`,
    previewReturn: (order) => `Vrátenie k objednávke ${order} je vybavené.`,
    eyebrowClaim: "Reklamácia",
    eyebrowEdit: "Úprava objednávky",
    eyebrowReturn: "Vrátenie",
    h1Edit: "Rozdiel",
    accentEdit: "vrátený.",
    h1Claim: "Reklamácia",
    h1Return: "Vrátenie",
    accentDone: "vybavené.",
    accentDoneClaim: "vybavená.",
    introClaim:
      "vaša reklamácia je vybavená. Toto je písomné potvrdenie o dátume a spôsobe vybavenia.",
    introEdit:
      "po vašej úprave vyšla objednávka lacnejšie — rozdiel som vám vrátila. Nižšie je zhrnutie.",
    introReturn: "vaše vrátenie je vybavené. Nižšie je zhrnutie, ako som ho uzavrela.",
    order: "Objednávka",
    goods: "Tovar",
    cause: "Príčina",
    carrierDamage: "Poškodené pri preprave",
    damagedItem: "Poškodený kus",
    resolvedAt: "Vybavené dňa",
    resolution: "Spôsob vybavenia",
    refundLines: "Vrátené položky",
    refundAmount: "Vrátená suma",
    refundedVia: "Vrátené",
    creditNote: "Dobropis",
    creditNoteNo: (number) => `č. ${number}`,
    note: "Poznámka",
    downloadConfirmation: "Stiahnuť potvrdenie (PDF)",
    trackClaim: "Sledovať stav žiadosti",
    viewOrder: "Zobraziť objednávku",
    creditNotePdf: "Dobropis (PDF)",
    cardTiming: "Pripísanie peňazí na účet závisí od vašej banky, zvyčajne do 3–5 pracovných dní. ",
    manualRefund:
      "Peniaze vraciam ručne (prevodom na účet alebo v hotovosti); ak od vás budem potrebovať číslo účtu, ozvem sa. ",
    adr: "Ak nesúhlasíte s vybavením, máte právo obrátiť sa na Českú obchodnú inšpekciu (www.coi.cz), prípadne na súd. Pri cezhraničnom spore vám bezplatne pomôže aj Európske spotrebiteľské centrum. ",
    contact: "Keby čokoľvek, napíšte mi na info@keramickazahrada.cz — odpovedám sama.",
  },
  pl: {
    outcome: {
      repair: "Egzemplarz jest naprawiony i wraca do Państwa.",
      replace: "Wysyłam Państwu nowy egzemplarz.",
      discount: "Zwracam część ceny — egzemplarz zostaje u Państwa.",
      refund: "Zwracam pieniądze tą samą drogą, którą dotarła do mnie płatność.",
    },
    previewClaim: (order) => `Reklamacja do zamówienia ${order} została rozpatrzona.`,
    previewEdit: (order) => `Zwróciłam różnicę po zmianie zamówienia ${order}.`,
    previewReturn: (order) => `Zwrot do zamówienia ${order} został zakończony.`,
    eyebrowClaim: "Reklamacja",
    eyebrowEdit: "Zmiana zamówienia",
    eyebrowReturn: "Zwrot",
    h1Edit: "Różnica",
    accentEdit: "zwrócona.",
    h1Claim: "Reklamacja",
    h1Return: "Zwrot",
    accentDone: "zakończony.",
    accentDoneClaim: "rozpatrzona.",
    introClaim:
      "Państwa reklamacja została rozpatrzona. To jest pisemne potwierdzenie daty i sposobu jej załatwienia.",
    introEdit:
      "Po wprowadzonej przez Państwa zmianie zamówienie wyszło taniej — różnicę już zwróciłam. Poniżej podsumowanie.",
    introReturn: "Państwa zwrot został zakończony. Poniżej podsumowanie, jak go zamknęłam.",
    order: "Zamówienie",
    goods: "Towar",
    cause: "Przyczyna",
    carrierDamage: "Uszkodzone w transporcie",
    damagedItem: "Uszkodzony egzemplarz",
    resolvedAt: "Data załatwienia",
    resolution: "Sposób załatwienia",
    refundLines: "Zwrócone pozycje",
    refundAmount: "Zwrócona kwota",
    refundedVia: "Zwrot",
    creditNote: "Faktura korygująca",
    creditNoteNo: (number) => `nr ${number}`,
    note: "Uwaga",
    downloadConfirmation: "Pobierz potwierdzenie (PDF)",
    trackClaim: "Sprawdź status zgłoszenia",
    viewOrder: "Zobacz zamówienie",
    creditNotePdf: "Faktura korygująca (PDF)",
    cardTiming: "Termin zaksięgowania pieniędzy zależy od Państwa banku, zwykle 3–5 dni roboczych. ",
    manualRefund:
      "Pieniądze zwracam ręcznie (przelewem na konto lub gotówką); jeśli będę potrzebować numeru konta, odezwę się. ",
    adr: "Jeśli nie zgadzają się Państwo z rozstrzygnięciem, mogą Państwo zwrócić się do Czeskiej Inspekcji Handlowej (www.coi.cz) lub do sądu. W sporze transgranicznym bezpłatnie pomoże też Europejskie Centrum Konsumenckie. ",
    contact: "W razie pytań proszę pisać na info@keramickazahrada.cz — odpowiadam osobiście.",
  },
  de: {
    outcome: {
      repair: "Das Stück ist repariert und auf dem Weg zurück zu Ihnen.",
      replace: "Ich schicke Ihnen ein neues Stück.",
      discount: "Einen Teil des Preises erstatte ich Ihnen – das Stück bleibt bei Ihnen.",
      refund: "Den Betrag erstatte ich auf demselben Weg, auf dem Ihre Zahlung bei mir eingegangen ist.",
    },
    previewClaim: (order) => `Ihre Reklamation zur Bestellung ${order} ist erledigt.`,
    previewEdit: (order) =>
      `Die Differenz nach der Änderung Ihrer Bestellung ${order} habe ich Ihnen erstattet.`,
    previewReturn: (order) => `Ihre Rücksendung zur Bestellung ${order} ist erledigt.`,
    eyebrowClaim: "Reklamation",
    eyebrowEdit: "Bestelländerung",
    eyebrowReturn: "Rücksendung",
    h1Edit: "Differenz",
    accentEdit: "erstattet.",
    h1Claim: "Reklamation",
    h1Return: "Rücksendung",
    accentDone: "erledigt.",
    accentDoneClaim: "erledigt.",
    introClaim:
      "Ihre Reklamation ist erledigt. Dies ist die schriftliche Bestätigung über Datum und Art der Erledigung.",
    introEdit:
      "nach Ihrer Änderung ist die Bestellung günstiger geworden – die Differenz habe ich Ihnen erstattet. Unten finden Sie die Zusammenfassung.",
    introReturn: "Ihre Rücksendung ist erledigt. Unten finden Sie eine Zusammenfassung.",
    order: "Bestellung",
    goods: "Ware",
    cause: "Ursache",
    carrierDamage: "Transportschaden",
    damagedItem: "Beschädigtes Stück",
    resolvedAt: "Erledigt am",
    resolution: "Art der Erledigung",
    refundLines: "Erstattete Positionen",
    refundAmount: "Erstatteter Betrag",
    refundedVia: "Erstattet",
    creditNote: "Gutschrift",
    creditNoteNo: (number) => `Nr. ${number}`,
    note: "Anmerkung",
    downloadConfirmation: "Bestätigung herunterladen (PDF)",
    trackClaim: "Status der Anfrage ansehen",
    viewOrder: "Bestellung ansehen",
    creditNotePdf: "Gutschrift (PDF)",
    cardTiming: "Wann der Betrag auf Ihrem Konto eingeht, hängt von Ihrer Bank ab – in der Regel innerhalb von 3–5 Werktagen. ",
    manualRefund:
      "Den Betrag erstatte ich manuell (per Überweisung oder bar); falls ich Ihre Kontonummer brauche, melde ich mich. ",
    adr: "Wenn Sie mit der Erledigung nicht einverstanden sind, können Sie sich an die Tschechische Handelsinspektion (www.coi.cz) oder an ein Gericht wenden. Bei grenzüberschreitenden Streitfällen hilft Ihnen auch das Europäische Verbraucherzentrum kostenlos. ",
    contact: "Bei Fragen schreiben Sie mir an info@keramickazahrada.cz – ich antworte selbst.",
  },
  en: {
    outcome: {
      repair: "The piece has been repaired and is on its way back to you.",
      replace: "I'm sending you a new piece.",
      discount: "I'm refunding part of the price — the piece stays with you.",
      refund: "I'm refunding your money the same way your payment reached me.",
    },
    previewClaim: (order) => `Your complaint about order ${order} has been settled.`,
    previewEdit: (order) => `I've refunded the difference after the change to order ${order}.`,
    previewReturn: (order) => `Your return for order ${order} has been completed.`,
    eyebrowClaim: "Complaint",
    eyebrowEdit: "Order change",
    eyebrowReturn: "Return",
    h1Edit: "Difference",
    accentEdit: "refunded.",
    h1Claim: "Complaint",
    h1Return: "Return",
    accentDone: "completed.",
    accentDoneClaim: "settled.",
    introClaim:
      "Your complaint has been settled. This is written confirmation of the date and the way it was settled.",
    introEdit:
      "After your change, the order came out cheaper — I've refunded the difference to you. Here's a summary.",
    introReturn: "Your return has been completed. Below is a summary of how I've closed it.",
    order: "Order",
    goods: "Goods",
    cause: "Cause",
    carrierDamage: "Damaged in transit",
    damagedItem: "Damaged piece",
    resolvedAt: "Settled on",
    resolution: "How it was settled",
    refundLines: "Refunded items",
    refundAmount: "Amount refunded",
    refundedVia: "Refunded",
    creditNote: "Credit note",
    creditNoteNo: (number) => `No. ${number}`,
    note: "Note",
    downloadConfirmation: "Download the confirmation (PDF)",
    trackClaim: "Check the status of your request",
    viewOrder: "View order",
    creditNotePdf: "Credit note (PDF)",
    cardTiming: "How soon the money shows in your account depends on your bank — usually within 3–5 working days. ",
    manualRefund:
      "I'm refunding the money manually (by bank transfer or in cash); if I need your account number, I'll be in touch. ",
    adr: "If you disagree with the outcome, you have the right to contact the Czech Trade Inspection Authority (www.coi.cz) or the courts. For cross-border disputes, the European Consumer Centre can also help you free of charge. ",
    contact: "If anything comes up, write to me at info@keramickazahrada.cz — I answer every message myself.",
  },
}

/**
 * Potvrzení o vyřízení (docs/reklamace-a-zruseni.md §6): datum, způsob,
 * částka / oprava / výměna. U reklamace je to zákonná písemnost (§19/3 ZOS),
 * proto se posílá vždy — i když se žádné peníze nevracely.
 */
function ReturnResolvedEmailComponent({
  customerName,
  orderNumber = "",
  kind,
  resolution,
  resolutionLabel,
  items,
  carrierDamage = false,
  damagedItem = false,
  resolvedAt,
  refundAmount,
  refundMethod,
  refundLines,
  creditNoteNumber,
  creditNoteUrl,
  creditNoteNote,
  note,
  orderLink = "",
  claimsUrl,
  protocolUrl,
}: ReturnResolvedEmailProps) {
  const t = useCopy(COPY)
  const isClaim = kind === "reklamace"
  // Rozdíl po zákaznické úpravě objednávky (druh `uprava`) — nic se fyzicky
  // nevracelo, jen peníze; „vrácení zboží" by mátlo.
  const isEdit = kind === "uprava"
  const outcome =
    t.outcome[(resolution ?? "refund") as keyof typeof t.outcome] ?? t.outcome.refund
  // Způsob vrácení řídí i větu o připsání: karta má lhůtu banky, ruční
  // vrácení ne — slibovat „do několika dnů" u převodu, který majitelka teprve
  // zadá, by byla lež. Slovo „ComGate" nese způsob v každém jazyce.
  const byCard = Boolean(refundMethod && /comgate|kart/i.test(refundMethod))
  const linkLabel = claimsUrl ? t.trackClaim : t.viewOrder
  return (
    <EmailLayout
      preview={
        isClaim
          ? t.previewClaim(orderNumber)
          : isEdit
            ? t.previewEdit(orderNumber)
            : t.previewReturn(orderNumber)
      }
    >
      <Eyebrow>{isClaim ? t.eyebrowClaim : isEdit ? t.eyebrowEdit : t.eyebrowReturn}</Eyebrow>
      {isEdit ? (
        <EmailH1 accent={t.accentEdit}>{t.h1Edit}</EmailH1>
      ) : (
        <EmailH1 accent={isClaim ? t.accentDoneClaim : t.accentDone}>
          {isClaim ? t.h1Claim : t.h1Return}
        </EmailH1>
      )}

      <Greeting name={customerName} />
      <P>{isClaim ? t.introClaim : isEdit ? t.introEdit : t.introReturn}</P>

      {orderNumber ? <LedgerRow label={t.order} value={orderNumber} /> : null}
      {items ? <LedgerRow label={t.goods} value={<MultiLine value={items} />} /> : null}
      {carrierDamage ? (
        <LedgerRow label={t.cause} value={t.carrierDamage} tone="clay" />
      ) : null}
      {damagedItem ? (
        <LedgerRow label={t.cause} value={t.damagedItem} tone="clay" />
      ) : null}
      {resolvedAt ? <LedgerRow label={t.resolvedAt} value={resolvedAt} /> : null}
      {resolutionLabel ? (
        <LedgerRow label={t.resolution} value={resolutionLabel} />
      ) : null}
      {refundLines ? (
        <LedgerRow label={t.refundLines} value={<MultiLine value={refundLines} />} />
      ) : null}
      {refundAmount ? (
        <LedgerRow label={t.refundAmount} value={refundAmount} strong tone="olive" />
      ) : null}
      {refundAmount && refundMethod ? (
        <LedgerRow label={t.refundedVia} value={refundMethod} />
      ) : null}
      {creditNoteNumber ? (
        <LedgerRow label={t.creditNote} value={t.creditNoteNo(creditNoteNumber)} />
      ) : null}
      {note ? <LedgerRow label={t.note} value={note} /> : null}
      <LedgerEnd />

      <Note tone="olive">{outcome}</Note>

      {protocolUrl || claimsUrl || orderLink || creditNoteUrl ? (
        <ButtonRow>
          {protocolUrl ? (
            <EmailButton href={protocolUrl}>{t.downloadConfirmation}</EmailButton>
          ) : claimsUrl || orderLink ? (
            <EmailButton href={claimsUrl || orderLink}>{linkLabel}</EmailButton>
          ) : null}
          {protocolUrl && (claimsUrl || orderLink) ? (
            <>
              <span style={{ display: "inline-block", width: "12px" }} />
              <EmailButton href={claimsUrl || orderLink} variant="ghost">
                {linkLabel}
              </EmailButton>
            </>
          ) : null}
          {creditNoteUrl ? (
            <>
              {protocolUrl || claimsUrl || orderLink ? (
                <span style={{ display: "inline-block", width: "12px" }} />
              ) : null}
              <EmailButton
                href={creditNoteUrl}
                variant={protocolUrl || claimsUrl || orderLink ? "ghost" : undefined}
              >
                {t.creditNotePdf}
              </EmailButton>
            </>
          ) : null}
        </ButtonRow>
      ) : null}

      <P small>
        {refundAmount && byCard ? t.cardTiming : refundAmount ? t.manualRefund : ""}
        {creditNoteNote ? `${creditNoteNote} ` : ""}
        {isClaim ? t.adr : ""}
        {t.contact}
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const ReturnResolvedEmail = (props: ReturnResolvedEmailProps) => (
  <ReturnResolvedEmailComponent {...props} />
)

// Mock data for preview/development — hodnoty řádků skládá odesílatel
// v jazyce zákazníka (lib/claims/email-copy).
const mockBase: ReturnResolvedEmailProps = {
  orderNumber: "#12345",
  kind: "odstoupeni",
  resolution: "refund",
  orderLink: "https://keramickazahrada.cz/orders/12345",
}

const mockReturnResolved: Localized<ReturnResolvedEmailProps> = {
  cs: {
    ...mockBase,
    customerName: "Jan Novák",
    resolutionLabel: "vrácení peněz",
    resolvedAt: "7. 10. 2026",
    refundAmount: "1 250 Kč",
    refundMethod: "na platební kartu",
  },
  sk: {
    ...mockBase,
    customerName: "Ján Novák",
    resolutionLabel: "vrátenie peňazí",
    resolvedAt: "7. 10. 2026",
    refundAmount: "50,60 €",
    refundMethod: "rovnakou cestou, akou ste platili (cez ComGate) — na účte do 3–5 pracovných dní",
  },
  pl: {
    ...mockBase,
    customerName: "Anna Nowak",
    resolutionLabel: "zwrot pieniędzy",
    resolvedAt: "7.10.2026",
    refundAmount: "219,00 zł",
    refundMethod: "tą samą drogą, którą Państwo płacili (przez ComGate) — na koncie w ciągu 3–5 dni roboczych",
  },
  de: {
    ...mockBase,
    customerName: "Jana Neumann",
    resolutionLabel: "Erstattung des Kaufpreises",
    resolvedAt: "7.10.2026",
    refundAmount: "50,60 €",
    refundMethod:
      "auf demselben Weg, auf dem Sie bezahlt haben (über ComGate) – auf Ihrem Konto innerhalb von 3–5 Werktagen",
  },
  en: {
    ...mockBase,
    customerName: "Emma Clarke",
    resolutionLabel: "refund of the purchase price",
    resolvedAt: "7 October 2026",
    refundAmount: "€50.60",
    refundMethod: "the same way you paid (via ComGate) — in your account within 3–5 working days",
  },
}

const ReturnResolvedPreview = () => (
  <ReturnResolvedEmailComponent {...mockReturnResolved[useEmailLocale()]} />
)

export default () => <ReturnResolvedPreview />
