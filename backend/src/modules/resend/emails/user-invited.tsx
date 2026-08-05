import { Link } from "@react-email/components"
import {
  brand,
  ButtonRow,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  LedgerEnd,
  LedgerRow,
  P,
  Signature,
} from "../components/email-ui"

type UserInvitedEmailProps = {
  invite_url: string
  email?: string
}

function UserInvitedEmailComponent({ invite_url, email }: UserInvitedEmailProps) {
  return (
    <EmailLayout preview="Pozvánka do administrace obchodu Keramická zahrada.">
      <Eyebrow>Pozvánka</Eyebrow>
      <EmailH1 accent="do ateliéru.">Pozvánka</EmailH1>

      <P>Dobrý den,</P>
      <P>
        zveme vás do týmu obchodu Keramická zahrada. Tlačítkem níže pozvánku
        přijmete a nastavíte si přístup do administrace.
      </P>

      {email ? (
        <>
          <LedgerRow label="Účet" value={email} />
          <LedgerEnd />
        </>
      ) : null}

      <ButtonRow>
        <EmailButton href={invite_url}>Přijmout pozvánku</EmailButton>
      </ButtonRow>

      <P small>
        Pokud tlačítko nefunguje, zkopírujte si do prohlížeče tuto adresu:{" "}
        <Link
          href={invite_url}
          style={{
            color: brand.ink,
            textDecoration: "underline",
            wordBreak: "break-all",
          }}
        >
          {invite_url}
        </Link>
      </P>
      <P small>
        Odkaz je určen jen vám, prosíme, nesdílejte ho. Pokud jste pozvánku
        nečekali, můžete tento e-mail v klidu ignorovat.
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const userInvitedEmail = (props: UserInvitedEmailProps) => (
  <UserInvitedEmailComponent {...props} />
)

// Mock data for preview/development
const mockInvite: UserInvitedEmailProps = {
  invite_url: "https://keramickazahrada.cz/app/invite/sample-token-123",
  email: "user@example.com",
}

export default () => <UserInvitedEmailComponent {...mockInvite} />
