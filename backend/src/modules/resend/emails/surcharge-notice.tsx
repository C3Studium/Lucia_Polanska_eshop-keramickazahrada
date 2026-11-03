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
import { useCopy } from "../components/email-i18n"
import type { Localized } from "../../../lib/email-locale"

interface SurchargeNoticeEmailProps {
  customerName?: string;
  orderNumber?: string;
  /** Příplatek (naformátovaný) — částka navíc nad původní cenu. */
  surchargeAmount?: string;
  /** Kolik po připočtení příplatku zbývá doplatit (naformátované). */
  newBalance?: string;
  /** Důvod příplatku, který majitelka napsala — volitelný (jde, jak ho napsala). */
  reason?: string;
  orderLink?: string;
}

/** Texty po jazycích (lib/email-locale) — čeština je původní znění. */
const COPY: Localized<{
  preview: (orderNumber: string) => string
  eyebrow: string
  title: string
  accent: string
  intro: string
  order: string
  surcharge: string
  balance: string
  next: string
  viewOrder: string
}> = {
  cs: {
    preview: (n) => `K zakázce ${n} přibyl příplatek — píšu vám, co a proč.`,
    eyebrow: "Zakázka",
    title: "Příplatek",
    accent: "k vaší zakázce.",
    intro:
      "při výrobě vašeho kousku se objevily práce navíc, a tak k ceně přibyl příplatek. Chci, abyste o tom věděli dřív, než vám pošlu výzvu k doplatku.",
    order: "Objednávka",
    surcharge: "Příplatek",
    balance: "Zbývá doplatit",
    next:
      "Doplatek vám pošlu k zaplacení zvlášť, příplatek v něm bude jako samostatná položka. Kdyby vám cokoli nehrálo, napište mi na info@keramickazahrada.cz — ráda to vysvětlím.",
    viewOrder: "Zobrazit objednávku",
  },
  sk: {
    preview: (n) => `K zákazke ${n} pribudol príplatok — píšem vám, čo a prečo.`,
    eyebrow: "Zákazka",
    title: "Príplatok",
    accent: "k vašej zákazke.",
    intro:
      "pri výrobe vášho kúska sa objavila práca navyše, a tak k cene pribudol príplatok. Chcem, aby ste o tom vedeli skôr, než vám pošlem výzvu na doplatok.",
    order: "Objednávka",
    surcharge: "Príplatok",
    balance: "Zostáva doplatiť",
    next:
      "Doplatok vám pošlem na zaplatenie zvlášť, príplatok v ňom bude ako samostatná položka. Keby vám čokoľvek nesedelo, napíšte mi na info@keramickazahrada.cz — rada to vysvetlím.",
    viewOrder: "Zobraziť objednávku",
  },
  pl: {
    preview: (n) =>
      `Do zamówienia indywidualnego ${n} doszła dopłata — piszę, za co i dlaczego.`,
    eyebrow: "Zamówienie indywidualne",
    title: "Dopłata",
    accent: "do Państwa zamówienia.",
    intro:
      "Przy wykonywaniu Państwa wyrobu pojawiła się dodatkowa praca, dlatego do ceny doszła dopłata. Chcę, żeby wiedzieli Państwo o tym, zanim wyślę prośbę o zapłatę pozostałej kwoty.",
    order: "Zamówienie",
    surcharge: "Dopłata",
    balance: "Pozostało do zapłaty",
    next:
      "Prośbę o zapłatę pozostałej kwoty wyślę osobno, dopłata będzie w niej osobną pozycją. Gdyby coś się nie zgadzało, proszę napisać na info@keramickazahrada.cz — chętnie wyjaśnię.",
    viewOrder: "Zobacz zamówienie",
  },
  de: {
    preview: (n) => `Zu Ihrer Auftragsarbeit ${n} kommt ein Aufpreis hinzu – ich erkläre Ihnen, wofür.`,
    eyebrow: "Auftragsarbeit",
    title: "Aufpreis",
    accent: "für Ihre Auftragsarbeit.",
    intro:
      "bei der Herstellung Ihres Stücks ist zusätzliche Arbeit angefallen, deshalb kommt ein Aufpreis hinzu. Ich möchte, dass Sie davon wissen, bevor ich Ihnen die Aufforderung zur Restzahlung schicke.",
    order: "Bestellung",
    surcharge: "Aufpreis",
    balance: "Noch offen",
    next:
      "Die Restzahlung schicke ich Ihnen separat, der Aufpreis steht darin als eigene Position. Wenn etwas für Sie nicht passt, schreiben Sie mir an info@keramickazahrada.cz – ich erkläre es gern.",
    viewOrder: "Bestellung ansehen",
  },
  en: {
    preview: (n) => `A surcharge has been added to your commission ${n} — here's what it's for.`,
    eyebrow: "Commission",
    title: "A surcharge",
    accent: "on your commission.",
    intro:
      "While making your piece, some extra work turned out to be needed, so a surcharge has been added to the price. I'd like you to know about it before I send you the request for the balance payment.",
    order: "Order",
    surcharge: "Surcharge",
    balance: "Balance to pay",
    next:
      "I'll send you the balance payment separately, with the surcharge shown as a separate item. If anything doesn't seem right to you, just write to me at info@keramickazahrada.cz — I'll be glad to explain.",
    viewOrder: "View order",
  },
}

/**
 * „K zakázce přibyl příplatek" — posílá se jen z ručního tlačítka
 * („Informovat o příplatku"), nikdy samo. Příplatek je navýšení nad cenu, na
 * kterou zákazník kývnul u objednávky, takže se o něm dozví dřív, než mu přijde
 * výzva k doplacení. Platí se pak běžnou výzvou k doplacení, ne odtud.
 */
function SurchargeNoticeEmailComponent({
  customerName,
  orderNumber = "",
  surchargeAmount,
  newBalance,
  reason,
  orderLink = "",
}: SurchargeNoticeEmailProps) {
  const t = useCopy(COPY)
  return (
    <EmailLayout preview={t.preview(orderNumber)}>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting name={customerName} />
      <P>{t.intro}</P>

      {reason ? <Note tone="clay">{reason}</Note> : null}

      {orderNumber ? <LedgerRow label={t.order} value={orderNumber} /> : null}
      {surchargeAmount ? (
        <LedgerRow label={t.surcharge} value={surchargeAmount} />
      ) : null}
      {newBalance ? (
        <LedgerRow label={t.balance} value={newBalance} strong tone="olive" />
      ) : null}
      <LedgerEnd />

      <P>{t.next}</P>

      {orderLink ? (
        <ButtonRow>
          <EmailButton href={orderLink}>{t.viewOrder}</EmailButton>
        </ButtonRow>
      ) : null}
      <Signature />
    </EmailLayout>
  )
}

export const SurchargeNoticeEmail = (props: SurchargeNoticeEmailProps) => (
  <SurchargeNoticeEmailComponent {...props} />
)

// Mock data for preview/development (důvod je text majitelky — jde, jak ho napíše).
const mockSurchargeNotice: SurchargeNoticeEmailProps = {
  customerName: "Jana Nováková",
  orderNumber: "#12345",
  surchargeAmount: "250 Kč",
  newBalance: "3 475 Kč",
  reason: "Ruční zdobení navíc",
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed",
}

export default () => <SurchargeNoticeEmailComponent {...mockSurchargeNotice} />
