import { Link } from "@react-email/components"
import {
  brand,
  ButtonRow,
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

type PasswordResetEmailProps = {
  reset_url: string
  email?: string
}

function PasswordResetEmailComponent({ reset_url, email }: PasswordResetEmailProps) {
  return (
    <EmailLayout preview="Nastavte si nové heslo jedním kliknutím.">
      <Eyebrow>Váš účet</Eyebrow>
      <EmailH1 accent="hesla.">Obnovení</EmailH1>

      <Greeting />
      <P>
        obdrželi jsme žádost o obnovení hesla k vašemu účtu. Nové heslo si
        nastavíte tlačítkem níže.
      </P>

      {email ? (
        <>
          <LedgerRow label="Účet" value={email} />
          <LedgerEnd />
        </>
      ) : null}

      <ButtonRow>
        <EmailButton href={reset_url}>Nastavit nové heslo</EmailButton>
      </ButtonRow>

      <P small>
        Pokud tlačítko nefunguje, zkopírujte do prohlížeče tuto adresu:
        <br />
        <Link
          href={reset_url}
          style={{
            color: brand.olive,
            textDecoration: "underline",
            wordBreak: "break-all",
          }}
        >
          {reset_url}
        </Link>
      </P>

      <P small>
        Odkaz z bezpečnostních důvodů brzy vyprší a je určen jen vám — nikomu
        jej prosím nepředávejte. Pokud jste o obnovení hesla nežádali, můžete
        tento e-mail v klidu ignorovat; vaše heslo zůstane beze změny.
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const passwordResetEmail = (props: PasswordResetEmailProps) => (
  <PasswordResetEmailComponent {...props} />
)

// Mock data for preview/development
const mockPasswordReset: PasswordResetEmailProps = {
  reset_url: "https://keramickazahrada.cz/reset-password?token=sample-reset-token-123",
  email: "jana.novakova@example.cz",
}

export default () => <PasswordResetEmailComponent {...mockPasswordReset} />
