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
  Note,
  P,
  Signature,
} from "../components/email-ui"

interface SignInNotificationEmailProps {
  customerName?: string;
  email?: string;
  signInTime?: string;
  signInLocation?: string;
  deviceInfo?: string;
  accountLink?: string;
}

function SignInNotificationEmailComponent({
  customerName = "Vážený zákazník",
  email = "your@email.com",
  signInTime = new Date().toLocaleString('cs-CZ'),
  signInLocation = "Česká republika",
  deviceInfo = "Chrome na macOS",
  accountLink = "https://keramickazahrada.cz/account"
}: SignInNotificationEmailProps) {
  return (
    <EmailLayout preview="Nové přihlášení k vašemu účtu — jen pro přehled.">
      <Eyebrow>Zabezpečení účtu</Eyebrow>
      <EmailH1 accent="přihlášení.">Nové</EmailH1>

      <Greeting name={customerName} />
      <P>
        k vašemu účtu proběhlo nové přihlášení. Tuto zprávu posíláme
        automaticky, abyste měli o svém účtu přehled.
      </P>

      <LedgerRow label="Účet" value={email} />
      <LedgerRow label="Kdy" value={signInTime} />
      <LedgerRow label="Odkud" value={signInLocation} />
      <LedgerRow label="Zařízení" value={deviceInfo} />
      <LedgerEnd />

      <Note tone="olive">
        Pokud jste se přihlásili vy, můžete tuto zprávu s klidem zavřít.
      </Note>

      <ButtonRow>
        <EmailButton href={accountLink}>Spravovat účet</EmailButton>
      </ButtonRow>

      <P small>
        Pokud přihlášení nepoznáváte, změňte si prosím heslo a napište nám
        na{" "}
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

export const SignInNotificationEmail = (props: SignInNotificationEmailProps) => (
  <SignInNotificationEmailComponent {...props} />
)

// Mock data for preview/development
const mockSignInNotification: SignInNotificationEmailProps = {
  customerName: "Jan Novák",
  email: "jan.novak@email.com",
  signInTime: new Date().toLocaleString('cs-CZ'),
  signInLocation: "Česká republika",
  deviceInfo: "Chrome na macOS",
  accountLink: "https://keramickazahrada.cz/account"
}

export default () => <SignInNotificationEmailComponent {...mockSignInNotification} />
