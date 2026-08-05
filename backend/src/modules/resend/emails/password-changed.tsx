import { Link } from "@react-email/components"
import {
  brand,
  CONTACT_EMAIL,
  EmailH1,
  EmailLayout,
  Eyebrow,
  Greeting,
  Note,
  P,
  Signature,
} from "../components/email-ui"

interface PasswordChangedEmailProps {
  customerName?: string;
}

function PasswordChangedEmailComponent({ customerName = "Vážený zákazník" }: PasswordChangedEmailProps) {
  return (
    <EmailLayout preview="Heslo k vašemu účtu bylo změněno.">
      <Eyebrow>Zabezpečení účtu</Eyebrow>
      <EmailH1 accent="změněno.">Heslo bylo</EmailH1>

      <Greeting name={customerName} />
      <P>
        heslo k vašemu účtu bylo právě změněno. Od této chvíle se
        přihlásíte pouze novým heslem — nic dalšího není potřeba.
      </P>

      <Note tone="clay">
        Pokud jste heslo neměnili vy, ozvěte se nám prosím co nejdříve.
      </Note>

      <P small>
        Stačí napsat na{" "}
        <Link
          href={`mailto:${CONTACT_EMAIL}`}
          style={{ color: brand.ink, textDecoration: "underline" }}
        >
          {CONTACT_EMAIL}
        </Link>{" "}
        a účet společně zabezpečíme. Doporučujeme volit heslo, které
        nepoužíváte nikde jinde.
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const PasswordChangedEmail = (props: PasswordChangedEmailProps) => (
  <PasswordChangedEmailComponent {...props} />
)

// Mock data for preview/development
const mockPasswordChanged: PasswordChangedEmailProps = {
  customerName: "Jan Novák"
}

export default () => <PasswordChangedEmailComponent {...mockPasswordChanged} />
