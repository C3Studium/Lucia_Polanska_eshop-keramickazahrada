import {
  ButtonRow,
  CONTACT_EMAIL,
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

interface ReturnRejectedEmailProps {
  customerName?: string;
  orderNumber?: string;
  returnNumber?: string;
  /** „reklamace" | „vraceni" | „odstoupeni". */
  kind?: string | null;
  /** Položky — řádek za položku („název · varianta · N ks · částka"), nebo slova zákazníka. */
  rejectedItems?: string;
  /** Totéž ze společného základu e-mailů (`claimEmailBase`) — záloha za `rejectedItems`. */
  items?: string;
  rejectionReason?: string;
  appealInstructions?: string;
  orderLink?: string;
  supportEmail?: string;
  /** Odkaz na PDF reklamační protokol (potvrzení o vyřízení / zamítnutí). */
  protocolUrl?: string;
}

/**
 * Texty po jazycích (lib/email-locale). Věta o ČOI zůstává i v cizím
 * jazyce: prodávající je český podnikatel a mimosoudní řešení sporů vede
 * Česká obchodní inspekce — u přeshraničního sporu pomůže i síť ECC.
 */
const COPY: Localized<{
  appeal: string
  eyebrowClaim: string
  eyebrowReturn: string
  h1Claim: string
  h1Return: string
  accent: string
  introClaim: string
  introReturn: string
  previewClaim: (order: string) => string
  previewReturn: (order: string) => string
  order: string
  returnNo: string
  goods: string
  reasonLabel: string
  keep: string
  sorry: string
  write: string
  viewOrder: string
  downloadProtocol: string
  adr: string
}> = {
  cs: {
    appeal: "Ozvat se mi můžete kdykoli — ráda to s vámi proberu",
    eyebrowClaim: "Reklamace",
    eyebrowReturn: "Vrácení",
    h1Claim: "Reklamaci",
    h1Return: "Vrácení",
    accent: "nemohu přijmout.",
    introClaim:
      "vaši reklamaci jsem pečlivě posoudila. Je mi líto, ale tentokrát ji nemohu uznat — proč, píšu níže.",
    introReturn:
      "vaši žádost o vrácení jsem pečlivě posoudila. Je mi líto, ale tentokrát jí nemohu vyhovět — důvod uvádím níže.",
    previewClaim: (order) => `Reklamaci k objednávce ${order} bohužel nemohu uznat.`,
    previewReturn: (order) => `Žádosti o vrácení k objednávce ${order} bohužel nemohu vyhovět.`,
    order: "Objednávka",
    returnNo: "Vrácení",
    goods: "Zboží",
    reasonLabel: "Důvod zamítnutí",
    keep: "Kousek zůstává váš. Pokud už ke mně doputoval, pošlu vám ho zpět na adresu z objednávky.",
    sorry:
      "Vím, že to není zpráva, kterou jste čekali. Pokud to vidíte jinak, napište mi — ráda si vaše důvody ještě vyslechnu.",
    write: "Napsat Lucii",
    viewOrder: "Zobrazit objednávku",
    downloadProtocol: "Stáhnout protokol (PDF)",
    adr: "Nesouhlasíte-li s vyřízením, máte právo obrátit se na Českou obchodní inspekci (www.coi.cz) jako subjekt mimosoudního řešení spotřebitelských sporů, případně na soud.",
  },
  sk: {
    appeal: "Ozvať sa mi môžete kedykoľvek — rada to s vami preberiem",
    eyebrowClaim: "Reklamácia",
    eyebrowReturn: "Vrátenie",
    h1Claim: "Reklamáciu",
    h1Return: "Vrátenie",
    accent: "nemôžem prijať.",
    introClaim:
      "vašu reklamáciu som starostlivo posúdila. Je mi ľúto, ale tentoraz ju nemôžem uznať — prečo, píšem nižšie.",
    introReturn:
      "vašu žiadosť o vrátenie som starostlivo posúdila. Je mi ľúto, ale tentoraz jej nemôžem vyhovieť — dôvod uvádzam nižšie.",
    previewClaim: (order) => `Reklamáciu k objednávke ${order} bohužiaľ nemôžem uznať.`,
    previewReturn: (order) => `Žiadosti o vrátenie k objednávke ${order} bohužiaľ nemôžem vyhovieť.`,
    order: "Objednávka",
    returnNo: "Vrátenie",
    goods: "Tovar",
    reasonLabel: "Dôvod zamietnutia",
    keep: "Kúsok zostáva váš. Ak už ku mne docestoval, pošlem vám ho späť na adresu z objednávky.",
    sorry:
      "Viem, že to nie je správa, ktorú ste čakali. Ak to vidíte inak, napíšte mi — rada si vaše dôvody ešte vypočujem.",
    write: "Napísať Lucii",
    viewOrder: "Zobraziť objednávku",
    downloadProtocol: "Stiahnuť protokol (PDF)",
    adr: "Ak nesúhlasíte s vybavením, máte právo obrátiť sa na Českú obchodnú inšpekciu (www.coi.cz) ako subjekt mimosúdneho riešenia spotrebiteľských sporov, prípadne na súd. Pri cezhraničnom spore vám bezplatne pomôže aj Európske spotrebiteľské centrum.",
  },
  pl: {
    appeal: "Mogą Państwo odezwać się do mnie w każdej chwili — chętnie porozmawiam",
    eyebrowClaim: "Reklamacja",
    eyebrowReturn: "Zwrot",
    h1Claim: "Reklamacji",
    h1Return: "Zwrotu",
    accent: "nie mogę przyjąć.",
    introClaim:
      "Starannie rozpatrzyłam Państwa reklamację. Przykro mi, ale tym razem nie mogę jej uznać — powód opisuję poniżej.",
    introReturn:
      "Starannie rozpatrzyłam Państwa wniosek o zwrot. Przykro mi, ale tym razem nie mogę go uwzględnić — powód podaję poniżej.",
    previewClaim: (order) => `Niestety nie mogę uznać reklamacji do zamówienia ${order}.`,
    previewReturn: (order) => `Niestety nie mogę uwzględnić wniosku o zwrot do zamówienia ${order}.`,
    order: "Zamówienie",
    returnNo: "Zwrot",
    goods: "Towar",
    reasonLabel: "Powód odmowy",
    keep: "Egzemplarz pozostaje Państwa. Jeśli już do mnie dotarł, odeślę go na adres z zamówienia.",
    sorry:
      "Wiem, że nie na taką wiadomość Państwo czekali. Jeśli widzą to Państwo inaczej, proszę do mnie napisać — chętnie jeszcze wysłucham Państwa argumentów.",
    write: "Napisz do Lucie",
    viewOrder: "Zobacz zamówienie",
    downloadProtocol: "Pobierz protokół (PDF)",
    adr: "Jeśli nie zgadzają się Państwo z rozstrzygnięciem, mogą Państwo zwrócić się do Czeskiej Inspekcji Handlowej (www.coi.cz) jako podmiotu pozasądowego rozwiązywania sporów konsumenckich lub do sądu. W sporze transgranicznym bezpłatnie pomoże też Europejskie Centrum Konsumenckie.",
  },
  de: {
    appeal: "Sie können sich jederzeit bei mir melden – ich bespreche es gern mit Ihnen",
    eyebrowClaim: "Reklamation",
    eyebrowReturn: "Rücksendung",
    h1Claim: "Reklamation",
    h1Return: "Rücksendung",
    accent: "leider abgelehnt.",
    introClaim:
      "ich habe Ihre Reklamation sorgfältig geprüft. Es tut mir leid, aber diesmal kann ich sie nicht anerkennen – warum, schreibe ich unten.",
    introReturn:
      "ich habe Ihre Rücksendeanfrage sorgfältig geprüft. Es tut mir leid, aber diesmal kann ich ihr nicht entsprechen – den Grund finden Sie unten.",
    previewClaim: (order) => `Ihre Reklamation zur Bestellung ${order} kann ich leider nicht anerkennen.`,
    previewReturn: (order) =>
      `Ihrer Rücksendeanfrage zur Bestellung ${order} kann ich leider nicht entsprechen.`,
    order: "Bestellung",
    returnNo: "Rücksendung",
    goods: "Ware",
    reasonLabel: "Grund der Ablehnung",
    keep: "Das Stück bleibt Ihres. Falls es schon bei mir ist, schicke ich es an die Adresse aus der Bestellung zurück.",
    sorry:
      "Ich weiß, dass Sie sich eine andere Nachricht gewünscht hätten. Wenn Sie es anders sehen, schreiben Sie mir – ich höre mir Ihre Gründe gern noch einmal an.",
    write: "Lucie schreiben",
    viewOrder: "Bestellung ansehen",
    downloadProtocol: "Protokoll herunterladen (PDF)",
    adr: "Wenn Sie mit der Entscheidung nicht einverstanden sind, können Sie sich an die Tschechische Handelsinspektion (www.coi.cz) als Stelle für die außergerichtliche Beilegung von Verbraucherstreitigkeiten oder an ein Gericht wenden. Bei grenzüberschreitenden Streitfällen hilft Ihnen auch das Europäische Verbraucherzentrum kostenlos.",
  },
  en: {
    appeal: "You're welcome to get in touch with me at any time — I'll gladly talk it through with you",
    eyebrowClaim: "Complaint",
    eyebrowReturn: "Return",
    h1Claim: "Complaint",
    h1Return: "Return",
    accent: "not accepted.",
    introClaim:
      "I've looked carefully into your complaint. I'm sorry, but this time I'm unable to accept it — I explain why below.",
    introReturn:
      "I've looked carefully into your return request. I'm sorry, but this time I'm unable to grant it — you'll find the reason below.",
    previewClaim: (order) => `Unfortunately, I'm unable to accept your complaint about order ${order}.`,
    previewReturn: (order) => `Unfortunately, I'm unable to grant your return request for order ${order}.`,
    order: "Order",
    returnNo: "Return",
    goods: "Goods",
    reasonLabel: "Reason for rejection",
    keep: "The piece remains yours. If it has already reached me, I'll send it back to the address on your order.",
    sorry:
      "I know this isn't the news you were hoping for. If you see things differently, please write to me — I'm happy to hear your reasons.",
    write: "Write to Lucie",
    viewOrder: "View order",
    downloadProtocol: "Download the record (PDF)",
    adr: "If you disagree with the outcome, you have the right to contact the Czech Trade Inspection Authority (www.coi.cz), the body for out-of-court resolution of consumer disputes, or the courts. For cross-border disputes, the European Consumer Centre can also help you free of charge.",
  },
}

/**
 * Číslo vrácení a seznam objektů se vykreslí jen s reálnými daty — vymyšlená
 * výchozí hodnota by v ostrém e-mailu tvrdila, že se zamítá něco jiného.
 *
 * Zamítnutí reklamace musí být písemně odůvodněno (§19/3 ZOS) a spotřebitel
 * má právo na mimosoudní řešení sporu u ČOI — obě věty jsou tu natvrdo, ať na
 * ně žádný volající nezapomene.
 */
function ReturnRejectedEmailComponent({
  customerName,
  orderNumber = "",
  returnNumber,
  kind,
  rejectedItems,
  items,
  rejectionReason,
  appealInstructions,
  orderLink = "",
  supportEmail = CONTACT_EMAIL,
  protocolUrl,
}: ReturnRejectedEmailProps) {
  const t = useCopy(COPY)
  const isClaim = kind === "reklamace"
  const objects = rejectedItems || items
  const eyebrow = isClaim ? t.eyebrowClaim : t.eyebrowReturn
  const h1 = isClaim ? t.h1Claim : t.h1Return
  const intro = isClaim ? t.introClaim : t.introReturn
  return (
    <EmailLayout
      preview={isClaim ? t.previewClaim(orderNumber) : t.previewReturn(orderNumber)}
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent}>{h1}</EmailH1>

      <Greeting name={customerName} />
      <P>{intro}</P>

      {orderNumber ? <LedgerRow label={t.order} value={orderNumber} /> : null}
      {returnNumber ? <LedgerRow label={t.returnNo} value={returnNumber} /> : null}
      {objects ? <LedgerRow label={t.goods} value={<MultiLine value={objects} />} /> : null}
      {rejectionReason ? (
        <LedgerRow label={t.reasonLabel} value={rejectionReason} tone="danger" />
      ) : null}
      <LedgerEnd />

      <P>{t.keep}</P>

      <Note tone="danger">{t.sorry}</Note>

      <ButtonRow>
        <EmailButton href={`mailto:${supportEmail}`}>{t.write}</EmailButton>
        {orderLink ? (
          <>
            <span style={{ display: "inline-block", width: "12px" }} />
            <EmailButton href={orderLink} variant="ghost">
              {t.viewOrder}
            </EmailButton>
          </>
        ) : null}
      </ButtonRow>

      {protocolUrl ? (
        <ButtonRow>
          <EmailButton href={protocolUrl}>{t.downloadProtocol}</EmailButton>
        </ButtonRow>
      ) : null}

      <P small>
        {appealInstructions ?? t.appeal}. {t.adr}
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const ReturnRejectedEmail = (props: ReturnRejectedEmailProps) => (
  <ReturnRejectedEmailComponent {...props} />
)

// Mock data for preview/development — důvod zamítnutí píše majitelka sama,
// v náhledu proto po jazycích.
const mockReturnRejected: Localized<ReturnRejectedEmailProps> = {
  cs: {
    customerName: "Jan Novák",
    orderNumber: "#12345",
    kind: "reklamace",
    rejectedItems: "Keramický hrnek — modrý",
    rejectionReason: "Kousek nese stopy mechanického poškození, nejde o vadu výrobku",
    orderLink: "https://keramickazahrada.cz/orders/12345",
    supportEmail: CONTACT_EMAIL,
  },
  sk: {
    customerName: "Ján Novák",
    orderNumber: "#12345",
    kind: "reklamace",
    rejectedItems: "Keramický hrnček — modrý",
    rejectionReason: "Kúsok nesie stopy mechanického poškodenia, nejde o vadu výrobku",
    orderLink: "https://keramickazahrada.cz/orders/12345",
    supportEmail: CONTACT_EMAIL,
  },
  pl: {
    customerName: "Anna Nowak",
    orderNumber: "#12345",
    kind: "reklamace",
    rejectedItems: "Kubek ceramiczny — niebieski",
    rejectionReason: "Egzemplarz nosi ślady uszkodzenia mechanicznego, to nie jest wada wyrobu",
    orderLink: "https://keramickazahrada.cz/orders/12345",
    supportEmail: CONTACT_EMAIL,
  },
  de: {
    customerName: "Jana Neumann",
    orderNumber: "#12345",
    kind: "reklamace",
    rejectedItems: "Keramiktasse — blau",
    rejectionReason: "Das Stück weist Spuren einer mechanischen Beschädigung auf, es handelt sich nicht um einen Produktmangel",
    orderLink: "https://keramickazahrada.cz/orders/12345",
    supportEmail: CONTACT_EMAIL,
  },
  en: {
    customerName: "Emma Clarke",
    orderNumber: "#12345",
    kind: "reklamace",
    rejectedItems: "Ceramic mug — blue",
    rejectionReason: "The piece shows signs of mechanical damage; this is not a manufacturing defect",
    orderLink: "https://keramickazahrada.cz/orders/12345",
    supportEmail: CONTACT_EMAIL,
  },
}

const ReturnRejectedPreview = () => (
  <ReturnRejectedEmailComponent {...mockReturnRejected[useEmailLocale()]} />
)

export default () => <ReturnRejectedPreview />
