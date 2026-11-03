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
  Note,
  P,
  Signature,
} from "../components/email-ui"
import { useCopy } from "../components/email-i18n"
import type { Localized } from "../../../lib/email-locale"

/**
 * Texty po jazycích (lib/email-locale) — čeština je původní znění. Jméno
 * obdarovaného ve slovenské a polské větě chybí schválně (pád cizího jména
 * se odhadnout nedá) — stojí v řádku „Pre/Dla" pod textem.
 */
const COPY: Localized<{
  preview: (value: string) => string
  eyebrow: string
  title: string
  accent: string
  intro: (recipient: string | null) => string
  forLabel: string
  valueLabel: string
  validLabel: string
  kindLabel: string
  electronic: string
  physical: string
  pay: (value: string) => string
  afterElectronic: (sendTo: string | null) => string
  afterPhysical: string
  fallbackBefore: string
  voucherPage: string
  fallbackAfter: (contact: string) => string
  closing: string
}> = {
  cs: {
    preview: (value) => `Dárkový poukaz na ${value} — zaplatíte jedním kliknutím.`,
    eyebrow: "Dárkový poukaz",
    title: "Poukaz je připravený,",
    accent: "zbývá jen zaplatit.",
    intro: (recipient) =>
      `děkuji za objednávku dárkového poukazu${recipient ? ` pro ${recipient}` : ""}. Zaplatit ho můžete kartou, převodem nebo přes Apple Pay a Google Pay — tlačítko vás přesměruje na zabezpečenou platební bránu ComGate.`,
    forLabel: "Pro",
    valueLabel: "Hodnota",
    validLabel: "Platí do",
    kindLabel: "Podoba",
    electronic: "Elektronický, e-mailem",
    physical: "Vytištěný",
    pay: (value) => `Zaplatit ${value}`,
    afterElectronic: (sendTo) =>
      `Hned po zaplacení odejde poukaz s kódem e-mailem${sendTo ? ` na ${sendTo}` : ""}.`,
    afterPhysical:
      "Po zaplacení poukaz vytisknu a pošlu poštou, nebo si ho vyzvednete u mě v dílně — jak jsme se domluvili.",
    fallbackBefore: "Kdyby odkaz nefungoval, otevřete",
    voucherPage: "stránku poukazu",
    fallbackAfter: (contact) => ` a zaplaťte odtud. S čímkoli dalším mi napište na ${contact} — odpovídám sama.`,
    closing: "Děkuji a těším se,",
  },
  sk: {
    preview: (value) => `Darčekový poukaz na ${value} — zaplatíte jedným kliknutím.`,
    eyebrow: "Darčekový poukaz",
    title: "Poukaz je pripravený,",
    accent: "zostáva ho už len zaplatiť.",
    intro: () =>
      "ďakujem za objednávku darčekového poukazu. Zaplatiť ho môžete kartou, prevodom alebo cez Apple Pay a Google Pay — tlačidlo vás presmeruje na zabezpečenú platobnú bránu ComGate.",
    forLabel: "Pre",
    valueLabel: "Hodnota",
    validLabel: "Platí do",
    kindLabel: "Podoba",
    electronic: "Elektronický, e-mailom",
    physical: "Vytlačený",
    pay: (value) => `Zaplatiť ${value}`,
    afterElectronic: (sendTo) =>
      `Hneď po zaplatení odíde poukaz s kódom e-mailom${sendTo ? ` na ${sendTo}` : ""}.`,
    afterPhysical:
      "Po zaplatení poukaz vytlačím a pošlem poštou, alebo si ho vyzdvihnete u mňa v dielni — ako sme sa dohodli.",
    fallbackBefore: "Keby odkaz nefungoval, otvorte",
    voucherPage: "stránku poukazu",
    fallbackAfter: (contact) => ` a zaplaťte odtiaľ. S čímkoľvek ďalším mi napíšte na ${contact} — odpovedám sama.`,
    closing: "Ďakujem a teším sa,",
  },
  pl: {
    preview: (value) => `Bon podarunkowy na ${value} — zapłacą Państwo jednym kliknięciem.`,
    eyebrow: "Bon podarunkowy",
    title: "Bon jest gotowy,",
    accent: "wystarczy zapłacić.",
    intro: () =>
      "Dziękuję za zamówienie bonu podarunkowego. Można za niego zapłacić kartą, przelewem albo przez Apple Pay i Google Pay — przycisk przekieruje Państwa do bezpiecznej bramki płatniczej ComGate.",
    forLabel: "Dla",
    valueLabel: "Wartość",
    validLabel: "Ważny do",
    kindLabel: "Forma",
    electronic: "Elektroniczny, e-mailem",
    physical: "Drukowany",
    pay: (value) => `Zapłać ${value}`,
    afterElectronic: (sendTo) =>
      `Zaraz po zapłacie bon z kodem zostanie wysłany e-mailem${sendTo ? ` na adres ${sendTo}` : ""}.`,
    afterPhysical:
      "Po zapłacie wydrukuję bon i wyślę go pocztą albo odbiorą go Państwo w mojej pracowni — tak, jak się umówiliśmy.",
    fallbackBefore: "Gdyby link nie działał, proszę otworzyć",
    voucherPage: "stronę bonu",
    fallbackAfter: (contact) =>
      ` i zapłacić stamtąd. We wszystkich innych sprawach proszę pisać na ${contact} — odpowiadam osobiście.`,
    closing: "Dziękuję i pozdrawiam",
  },
  de: {
    preview: (value) => `Geschenkgutschein über ${value} – mit einem Klick bezahlt.`,
    eyebrow: "Geschenkgutschein",
    title: "Der Gutschein ist fertig,",
    accent: "es fehlt nur noch die Zahlung.",
    intro: (recipient) =>
      `vielen Dank für Ihre Bestellung eines Geschenkgutscheins${recipient ? ` für ${recipient}` : ""}. Sie können per Karte, Überweisung oder über Apple Pay und Google Pay bezahlen – die Schaltfläche führt Sie zum sicheren Zahlungsportal ComGate.`,
    forLabel: "Für",
    valueLabel: "Wert",
    validLabel: "Gültig bis",
    kindLabel: "Form",
    electronic: "Elektronisch, per E-Mail",
    physical: "Gedruckt",
    pay: (value) => `${value} bezahlen`,
    afterElectronic: (sendTo) =>
      `Gleich nach der Zahlung geht der Gutschein mit dem Code per E-Mail${sendTo ? ` an ${sendTo}` : ""} hinaus.`,
    afterPhysical:
      "Nach der Zahlung drucke ich den Gutschein aus und schicke ihn per Post, oder Sie holen ihn bei mir in der Werkstatt ab – wie besprochen.",
    fallbackBefore: "Falls der Link nicht funktioniert, öffnen Sie",
    voucherPage: "die Seite des Gutscheins",
    fallbackAfter: (contact) =>
      ` und bezahlen Sie dort. Bei allen anderen Fragen schreiben Sie mir an ${contact} – ich antworte selbst.`,
    closing: "Vielen Dank und herzliche Grüße",
  },
  en: {
    preview: (value) => `Your ${value} gift voucher — pay in one click.`,
    eyebrow: "Gift voucher",
    title: "Your voucher is ready,",
    accent: "it just needs paying for.",
    intro: (recipient) =>
      `Thank you for ordering a gift voucher${recipient ? ` for ${recipient}` : ""}. You can pay by card, bank transfer, Apple Pay or Google Pay — the button will take you to the secure ComGate payment gateway.`,
    forLabel: "For",
    valueLabel: "Value",
    validLabel: "Valid until",
    kindLabel: "Format",
    electronic: "Electronic, by e-mail",
    physical: "Printed",
    pay: (value) => `Pay ${value}`,
    afterElectronic: (sendTo) =>
      `As soon as it's paid, the voucher with its code will be sent by e-mail${sendTo ? ` to ${sendTo}` : ""}.`,
    afterPhysical:
      "Once it's paid, I'll print the voucher and post it to you, or you can collect it from my studio — whichever we agreed.",
    fallbackBefore: "If the link doesn't work, open",
    voucherPage: "the voucher page",
    fallbackAfter: (contact) =>
      ` and pay from there. For anything else, write to me at ${contact} — I answer every message myself.`,
    closing: "Thank you, and warm wishes,",
  },
}

/**
 * Platební odkaz k dárkovému poukazu (stránka Poukazy → „Pošlu platební
 * odkaz“). Tlačítko vede rovnou do ComGate; po zaplacení
 * (`subscribers/gift-voucher-payment.ts`) elektronický poukaz odejde sám,
 * vytištěný Lucie pošle nebo předá.
 */
export interface GiftVoucherPaymentEmailProps {
  buyerName?: string | null
  value?: string
  recipientName?: string | null
  kind?: "physical" | "electronic"
  /** Kam po zaplacení odejde elektronický poukaz. */
  sendTo?: string | null
  validUntil?: string
  paymentUrl?: string
  voucherUrl?: string
}

function GiftVoucherPaymentEmailComponent({
  buyerName = null,
  value = "",
  recipientName = null,
  kind = "electronic",
  sendTo = null,
  validUntil = "",
  paymentUrl = "",
  voucherUrl = "",
}: GiftVoucherPaymentEmailProps) {
  const t = useCopy(COPY)
  return (
    <EmailLayout preview={t.preview(value)}>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting name={buyerName} />
      <P>{t.intro(recipientName)}</P>

      {recipientName ? <LedgerRow label={t.forLabel} value={recipientName} /> : null}
      <LedgerRow label={t.valueLabel} value={value} strong />
      <LedgerRow label={t.validLabel} value={validUntil} />
      <LedgerRow label={t.kindLabel} value={kind === "electronic" ? t.electronic : t.physical} />
      <LedgerEnd />

      <ButtonRow>
        <EmailButton href={paymentUrl}>{t.pay(value)}</EmailButton>
      </ButtonRow>

      <Note>{kind === "electronic" ? t.afterElectronic(sendTo) : t.afterPhysical}</Note>

      <P small>
        {t.fallbackBefore}{" "}
        {voucherUrl ? <a href={voucherUrl}>{t.voucherPage}</a> : t.voucherPage}
        {t.fallbackAfter(CONTACT_EMAIL)}
      </P>
      <Signature closing={t.closing} />
    </EmailLayout>
  )
}

export const GiftVoucherPaymentEmail = (props: GiftVoucherPaymentEmailProps) => (
  <GiftVoucherPaymentEmailComponent {...props} />
)

/* Náhled — dřív výchozí hodnoty props (e-mail bez pole by nesl vymyšlená data). */
const mockGiftVoucherPayment: GiftVoucherPaymentEmailProps = {
  buyerName: "Jana Nováková",
  value: "1 000 Kč",
  recipientName: "Aničce",
  kind: "electronic",
  sendTo: "anicka@example.com",
  validUntil: "24. 10. 2027",
  paymentUrl: "https://payments.comgate.cz/client/instructions/index?id=ABC",
  voucherUrl: "https://keramickazahrada.cz/cz/poukaz/gv_123?token=abc",
}

export default () => <GiftVoucherPaymentEmailComponent {...mockGiftVoucherPayment} />
