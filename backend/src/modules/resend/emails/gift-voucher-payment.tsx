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
  buyerName = "Jana Nováková",
  value = "1 000 Kč",
  recipientName = "Aničce",
  kind = "electronic",
  sendTo = "anicka@example.com",
  validUntil = "24. 10. 2027",
  paymentUrl = "https://payments.comgate.cz/client/instructions/index?id=ABC",
  voucherUrl = "https://keramickazahrada.cz/cz/poukaz/gv_123?token=abc",
}: GiftVoucherPaymentEmailProps) {
  return (
    <EmailLayout preview={`Dárkový poukaz na ${value} — zaplatíte jedním kliknutím.`}>
      <Eyebrow>Dárkový poukaz</Eyebrow>
      <EmailH1 accent="zbývá jen zaplatit.">Poukaz je připravený,</EmailH1>

      <Greeting name={buyerName} />
      <P>
        děkuji za objednávku dárkového poukazu{recipientName ? ` pro ${recipientName}` : ""}.
        Zaplatit ho můžete kartou, převodem nebo přes Apple Pay a Google Pay — tlačítko vás
        přesměruje na zabezpečenou platební bránu ComGate.
      </P>

      {recipientName ? <LedgerRow label="Pro" value={recipientName} /> : null}
      <LedgerRow label="Hodnota" value={value} strong />
      <LedgerRow label="Platí do" value={validUntil} />
      <LedgerRow label="Podoba" value={kind === "electronic" ? "Elektronický, e-mailem" : "Vytištěný"} />
      <LedgerEnd />

      <ButtonRow>
        <EmailButton href={paymentUrl}>Zaplatit {value}</EmailButton>
      </ButtonRow>

      <Note>
        {kind === "electronic"
          ? `Hned po zaplacení odejde poukaz s kódem e-mailem${sendTo ? ` na ${sendTo}` : ""}.`
          : "Po zaplacení poukaz vytisknu a pošlu poštou, nebo si ho vyzvednete u mě v dílně — jak jsme se domluvili."}
      </Note>

      <P small>
        Kdyby odkaz nefungoval, otevřete{" "}
        {voucherUrl ? <a href={voucherUrl}>stránku poukazu</a> : "stránku poukazu"} a zaplaťte
        odtud. S čímkoli dalším mi napište na {CONTACT_EMAIL} — odpovídám sama.
      </P>
      <Signature closing="Děkuji a těším se," />
    </EmailLayout>
  )
}

export const GiftVoucherPaymentEmail = (props: GiftVoucherPaymentEmailProps) => (
  <GiftVoucherPaymentEmailComponent {...props} />
)

export default () => <GiftVoucherPaymentEmailComponent />
