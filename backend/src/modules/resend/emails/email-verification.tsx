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

type EmailVerificationProps = {
  verification_url: string
  email?: string
}

function EmailVerificationComponent({ verification_url, email }: EmailVerificationProps) {
  return (
    <EmailLayout preview="Zbývá jediný krok — potvrdit, že je tahle adresa vaše. Odkaz platí 24 hodin.">
      <Eyebrow>Váš účet</Eyebrow>
      <EmailH1 accent="adresu.">Potvrďte svou</EmailH1>

      <Greeting />
      <P>
        zbývá poslední krok — potvrdit, že tato e-mailová adresa patří vám.
        Stačí jedno kliknutí; odkaz platí 24 hodin.
      </P>

      {email ? (
        <>
          <LedgerRow label="E-mail" value={email} />
          <LedgerEnd />
        </>
      ) : null}

      <ButtonRow>
        <EmailButton href={verification_url}>Potvrdit e-mail</EmailButton>
      </ButtonRow>

      <P small>
        Pokud tlačítko nefunguje, zkopírujte do prohlížeče tuto adresu:
        <br />
        <Link
          href={verification_url}
          style={{
            color: brand.olive,
            textDecoration: "underline",
            wordBreak: "break-all",
          }}
        >
          {verification_url}
        </Link>
      </P>

      <P small>
        Pokud jste si u mě účet nezakládali, nic se neděje — bez potvrzení se
        nic nestane. Kdybyste si nebyli jistí, napište mi na info@keramickazahrada.cz.
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const emailVerificationEmail = (props: EmailVerificationProps) => (
  <EmailVerificationComponent {...props} />
)

// Mock data for preview/development
const mockVerification: EmailVerificationProps = {
  verification_url: "https://keramickazahrada.cz/verify-email?token=sample-verification-token-123",
  email: "jana.novakova@example.cz",
}

export default () => <EmailVerificationComponent {...mockVerification} />
