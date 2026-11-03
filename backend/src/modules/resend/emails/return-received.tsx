import {
  ButtonRow,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  Greeting,
  LedgerEnd,
  LedgerRow,
  Note,
  P,
  Signature,
} from "../components/email-ui"
import { useCopy, useEmailLocale } from "../components/email-i18n"
import type { Localized } from "../../../lib/email-locale"

interface ReturnReceivedEmailProps {
  customerName?: string;
  orderNumber?: string;
  /** „reklamace" | „vraceni" | „odstoupeni". */
  kind?: string | null;
  /** Rozhodnutí při schválení („repair" | „replace" | „discount" | „refund"). */
  resolution?: string | null;
  resolutionLabel?: string;
  /** Datum přijetí zásilky (formátované). */
  receivedAt?: string;
  /** Poznámka majitelky k přijetí (volitelná, zákazník ji vidí). */
  note?: string;
  orderLink?: string;
  claimsUrl?: string;
  protocolUrl?: string;
}

/** Texty po jazycích (lib/email-locale) — čeština je původní znění. */
const COPY: Localized<{
  /** Co se děje dál — podle rozhodnutí. */
  next: Record<"repair" | "replace" | "discount" | "refund", string>
  preview: (order: string) => string
  eyebrowClaim: string
  eyebrowReturn: string
  title: string
  accent: string
  intro: string
  order: string
  received: string
  resolution: string
  note: string
  trackClaim: string
  viewOrder: string
  protocol: string
  outro: string
  closing: string
}> = {
  cs: {
    next: {
      repair: "Kousek teď opravím a pošlu vám ho zpět. Jakmile bude na cestě, dám vám vědět.",
      replace: "Připravuji pro vás nový kus. Jakmile bude na cestě, dám vám vědět.",
      discount: "Prohlédnu si ho a vrátím vám dohodnutou část ceny.",
      refund: "Prohlédnu si ho a vrátím vám peníze stejnou cestou, jakou ke mně platba přišla.",
    },
    preview: (order) => `Zásilka k objednávce ${order} ke mně dorazila.`,
    eyebrowClaim: "Reklamace",
    eyebrowReturn: "Vrácení",
    title: "Zboží ke mně",
    accent: "dorazilo.",
    intro:
      "vrácená zásilka ke mně v pořádku dorazila — nic se neztratilo. Kousek si teď prohlédnu a pokračuji ve vyřízení.",
    order: "Objednávka",
    received: "Přijato",
    resolution: "Způsob vyřízení",
    note: "Poznámka",
    trackClaim: "Sledovat stav žádosti",
    viewOrder: "Zobrazit objednávku",
    protocol: "Protokol (PDF)",
    outro:
      "O vyřízení vám pošlu písemné potvrzení e-mailem. Kdyby cokoli, napište mi na info@keramickazahrada.cz — odpovídám sama.",
    closing: "Děkuji za trpělivost,",
  },
  sk: {
    next: {
      repair: "Kúsok teraz opravím a pošlem vám ho späť. Hneď ako bude na ceste, dám vám vedieť.",
      replace: "Pripravujem pre vás nový kus. Hneď ako bude na ceste, dám vám vedieť.",
      discount: "Prezriem si ho a vrátim vám dohodnutú časť ceny.",
      refund: "Prezriem si ho a vrátim vám peniaze rovnakou cestou, akou ku mne platba prišla.",
    },
    preview: (order) => `Zásielka k objednávke ${order} ku mne dorazila.`,
    eyebrowClaim: "Reklamácia",
    eyebrowReturn: "Vrátenie",
    title: "Tovar ku mne",
    accent: "dorazil.",
    intro:
      "vrátená zásielka ku mne v poriadku dorazila — nič sa nestratilo. Kúsok si teraz prezriem a pokračujem vo vybavovaní.",
    order: "Objednávka",
    received: "Prijaté",
    resolution: "Spôsob vybavenia",
    note: "Poznámka",
    trackClaim: "Sledovať stav žiadosti",
    viewOrder: "Zobraziť objednávku",
    protocol: "Protokol (PDF)",
    outro:
      "O vybavení vám pošlem písomné potvrdenie e-mailom. Keby čokoľvek, napíšte mi na info@keramickazahrada.cz — odpovedám sama.",
    closing: "Ďakujem za trpezlivosť,",
  },
  pl: {
    next: {
      repair: "Teraz naprawię egzemplarz i odeślę go Państwu. Gdy będzie w drodze, dam znać.",
      replace: "Przygotowuję dla Państwa nowy egzemplarz. Gdy będzie w drodze, dam znać.",
      discount: "Obejrzę go i zwrócę uzgodnioną część ceny.",
      refund: "Obejrzę go i zwrócę pieniądze tą samą drogą, którą dotarła do mnie płatność.",
    },
    preview: (order) => `Przesyłka do zamówienia ${order} do mnie dotarła.`,
    eyebrowClaim: "Reklamacja",
    eyebrowReturn: "Zwrot",
    title: "Towar do mnie",
    accent: "dotarł.",
    intro:
      "Zwrócona przesyłka dotarła do mnie w porządku — nic nie zginęło. Teraz obejrzę egzemplarz i dalej zajmuję się sprawą.",
    order: "Zamówienie",
    received: "Otrzymano",
    resolution: "Sposób załatwienia",
    note: "Uwaga",
    trackClaim: "Sprawdź status zgłoszenia",
    viewOrder: "Zobacz zamówienie",
    protocol: "Protokół (PDF)",
    outro:
      "Gdy sprawa będzie załatwiona, wyślę Państwu pisemne potwierdzenie e-mailem. W razie pytań proszę pisać na info@keramickazahrada.cz — odpowiadam osobiście.",
    closing: "Dziękuję za cierpliwość",
  },
  de: {
    next: {
      repair: "Ich repariere das Stück jetzt und schicke es Ihnen zurück. Sobald es unterwegs ist, gebe ich Ihnen Bescheid.",
      replace: "Ich bereite ein neues Stück für Sie vor. Sobald es unterwegs ist, gebe ich Ihnen Bescheid.",
      discount: "Ich sehe es mir an und erstatte Ihnen den vereinbarten Teil des Preises.",
      refund:
        "Ich sehe es mir an und erstatte Ihnen den Betrag auf demselben Weg, auf dem Ihre Zahlung bei mir eingegangen ist.",
    },
    preview: (order) => `Die Sendung zur Bestellung ${order} ist bei mir angekommen.`,
    eyebrowClaim: "Reklamation",
    eyebrowReturn: "Rücksendung",
    title: "Die Ware ist",
    accent: "bei mir angekommen.",
    intro:
      "Ihre Rücksendung ist gut bei mir angekommen – nichts ist verloren gegangen. Ich sehe mir das Stück jetzt an und kümmere mich um den nächsten Schritt.",
    order: "Bestellung",
    received: "Eingegangen",
    resolution: "Art der Erledigung",
    note: "Anmerkung",
    trackClaim: "Status der Anfrage ansehen",
    viewOrder: "Bestellung ansehen",
    protocol: "Protokoll (PDF)",
    outro:
      "Über die Erledigung schicke ich Ihnen eine schriftliche Bestätigung per E-Mail. Bei Fragen schreiben Sie mir an info@keramickazahrada.cz – ich antworte selbst.",
    closing: "Danke für Ihre Geduld",
  },
  en: {
    next: {
      repair: "I'll now repair the piece and send it back to you. I'll let you know as soon as it's on its way.",
      replace: "I'm preparing a new piece for you. I'll let you know as soon as it's on its way.",
      discount: "I'll take a look at it and refund the agreed part of the price.",
      refund: "I'll take a look at it and refund your money the same way your payment reached me.",
    },
    preview: (order) => `The parcel for order ${order} has reached me.`,
    eyebrowClaim: "Complaint",
    eyebrowReturn: "Return",
    title: "Your parcel",
    accent: "has arrived.",
    intro:
      "Your returned parcel has reached me safe and sound — nothing went missing. I'll now take a look at the piece and carry on sorting things out.",
    order: "Order",
    received: "Received",
    resolution: "How it will be settled",
    note: "Note",
    trackClaim: "Check the status of your request",
    viewOrder: "View order",
    protocol: "Record (PDF)",
    outro:
      "Once it's all settled, I'll send you written confirmation by e-mail. If anything comes up, write to me at info@keramickazahrada.cz — I answer every message myself.",
    closing: "Thank you for your patience,",
  },
}

/**
 * „Zboží k nám dorazilo, kontrolujeme" (docs/reklamace-a-zruseni.md §6).
 * Krátký mezikrok — zákazník ví, že zásilka došla a že se nic neztratilo.
 */
function ReturnReceivedEmailComponent({
  customerName,
  orderNumber = "",
  kind,
  resolution,
  resolutionLabel,
  receivedAt,
  note,
  orderLink = "",
  claimsUrl,
  protocolUrl,
}: ReturnReceivedEmailProps) {
  const t = useCopy(COPY)
  const isClaim = kind === "reklamace"
  const next = t.next[(resolution ?? "refund") as keyof typeof t.next] ?? t.next.refund
  return (
    <EmailLayout preview={t.preview(orderNumber)}>
      <Eyebrow>{isClaim ? t.eyebrowClaim : t.eyebrowReturn}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting name={customerName} />
      <P>{t.intro}</P>

      {orderNumber ? <LedgerRow label={t.order} value={orderNumber} /> : null}
      {receivedAt ? <LedgerRow label={t.received} value={receivedAt} /> : null}
      {resolutionLabel ? (
        <LedgerRow label={t.resolution} value={resolutionLabel} />
      ) : null}
      {note ? <LedgerRow label={t.note} value={note} /> : null}
      <LedgerEnd />

      <Note tone="olive">{next}</Note>

      {claimsUrl || orderLink ? (
        <ButtonRow>
          <EmailButton href={claimsUrl || orderLink}>
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
      ) : null}

      <P small>{t.outro}</P>
      <Signature closing={t.closing} />
    </EmailLayout>
  )
}

export const ReturnReceivedEmail = (props: ReturnReceivedEmailProps) => (
  <ReturnReceivedEmailComponent {...props} />
)

// Mock data for preview/development — způsob vyřízení a datum skládá
// odesílatel v jazyce zákazníka.
const mockBase: ReturnReceivedEmailProps = {
  orderNumber: "#12345",
  kind: "reklamace",
  resolution: "repair",
  orderLink: "https://keramickazahrada.cz/orders/12345",
}

const mockReturnReceived: Localized<ReturnReceivedEmailProps> = {
  cs: { ...mockBase, customerName: "Jan Novák", resolutionLabel: "oprava", receivedAt: "7. 10. 2026" },
  sk: { ...mockBase, customerName: "Ján Novák", resolutionLabel: "oprava", receivedAt: "7. 10. 2026" },
  pl: { ...mockBase, customerName: "Anna Nowak", resolutionLabel: "naprawa", receivedAt: "7.10.2026" },
  de: { ...mockBase, customerName: "Jana Neumann", resolutionLabel: "Reparatur", receivedAt: "7.10.2026" },
  en: { ...mockBase, customerName: "Emma Clarke", resolutionLabel: "repair", receivedAt: "7 October 2026" },
}

const ReturnReceivedPreview = () => (
  <ReturnReceivedEmailComponent {...mockReturnReceived[useEmailLocale()]} />
)

export default () => <ReturnReceivedPreview />
