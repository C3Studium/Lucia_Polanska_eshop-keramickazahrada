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
    <EmailLayout preview="Nové heslo si nastavíte jedním kliknutím. Odkaz platí 15 minut.">
      <Eyebrow>Váš účet</Eyebrow>
      <EmailH1 accent="heslo.">Nastavte si nové</EmailH1>

      <Greeting />
      <P>
        někdo — nejspíš vy — požádal o nové heslo k vašemu účtu. Nastavíte si
        ho tlačítkem níže; odkaz platí 15 minut, potom si můžete nechat
        poslat nový.
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
        Odkaz je určený jen vám, nikomu ho prosím nepředávejte. Pokud jste
        o nové heslo nežádali, nic se neděje — vaše heslo zůstává, jak je.
        Kdyby vás to znepokojilo, napište mi na info@keramickazahrada.cz.
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
