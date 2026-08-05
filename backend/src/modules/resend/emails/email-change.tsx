import { Link } from "@react-email/components"
import {
  brand,
  ButtonRow,
  CONTACT_EMAIL,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  Greeting,
  LedgerEnd,
  LedgerRow,
  P,
  Signature,
} from "../components/email-ui"

interface EmailChangeEmailProps {
  customerName?: string;
  oldEmail?: string;
  newEmail?: string;
  confirmationLink?: string;
  expiryTime?: string;
  accountLink?: string;
}

function EmailChangeEmailComponent({
  customerName = "Vážený zákazník",
  oldEmail = "old@email.com",
  newEmail = "new@email.com",
  confirmationLink = "https://keramickazahrada.cz/account/confirm-email?token=abc123",
  expiryTime = "24 hodin",
  accountLink = "https://keramickazahrada.cz/account"
}: EmailChangeEmailProps) {
  return (
    <EmailLayout preview="Potvrďte prosím novou e-mailovou adresu.">
      <Eyebrow>Váš účet</Eyebrow>
      <EmailH1 accent="adresy.">Změna e-mailové</EmailH1>

      <Greeting name={customerName} />
      <P>
        přijali jsme žádost o změnu e-mailové adresy u vašeho účtu. Zbývá
        poslední krok — potvrdit novou adresu.
      </P>

      <LedgerRow label="Současná adresa" value={oldEmail} />
      <LedgerRow label="Nová adresa" value={newEmail} tone="olive" />
      <LedgerRow label="Platnost odkazu" value={expiryTime} />
      <LedgerEnd />

      <ButtonRow>
        <EmailButton href={confirmationLink}>Potvrdit novou adresu</EmailButton>
        <span style={{ display: "inline-block", width: "12px" }} />
        <EmailButton href={accountLink} variant="ghost">
          Zobrazit účet
        </EmailButton>
      </ButtonRow>

      <P>
        Po potvrzení budeme všechny zprávy posílat na novou adresu. Dokud
        ji nepotvrdíte, platí adresa současná.
      </P>

      <P small>
        Pokud jste o změnu nežádali, nemusíte nic dělat — adresa zůstane
        beze změny. Pro jistotu nám můžete napsat na{" "}
        <Link
          href={`mailto:${CONTACT_EMAIL}`}
          style={{ color: brand.ink, textDecoration: "underline" }}
        >
          {CONTACT_EMAIL}
        </Link>
        .
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const EmailChangeEmail = (props: EmailChangeEmailProps) => (
  <EmailChangeEmailComponent {...props} />
)

// Mock data for preview/development
const mockEmailChange: EmailChangeEmailProps = {
  customerName: "Jan Novák",
  oldEmail: "jan.novak@stary-email.cz",
  newEmail: "jan.novak@novy-email.cz",
  confirmationLink: "https://keramickazahrada.cz/account/confirm-email?token=abc123",
  expiryTime: "24 hodin",
  accountLink: "https://keramickazahrada.cz/account"
}

export default () => <EmailChangeEmailComponent {...mockEmailChange} />
