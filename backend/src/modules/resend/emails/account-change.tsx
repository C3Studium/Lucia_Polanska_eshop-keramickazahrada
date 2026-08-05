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

interface AccountChangeEmailProps {
  customerName?: string;
  changeType?: string;
  changeDetails?: string;
  changeTime?: string;
  accountLink?: string;
  securityNote?: boolean;
}

function AccountChangeEmailComponent({
  customerName = "Vážený zákazník",
  changeType = "Změna osobních údajů",
  changeDetails = "Bylo aktualizováno jméno a příjmení",
  changeTime = new Date().toLocaleString('cs-CZ'),
  accountLink = "https://keramickazahrada.cz/account",
  securityNote = true
}: AccountChangeEmailProps) {
  return (
    <EmailLayout preview={`Změna v účtu — ${changeType}.`}>
      <Eyebrow>Váš účet</Eyebrow>
      <EmailH1 accent="v účtu.">Změna</EmailH1>

      <Greeting name={customerName} />
      <P>
        ve vašem účtu jsme právě uložili změnu. Vše platí okamžitě — pro
        jistotu posíláme přehled.
      </P>

      <LedgerRow label="Změna" value={changeType} />
      <LedgerRow label="Detail" value={changeDetails} />
      <LedgerRow label="Kdy" value={changeTime} />
      <LedgerEnd />

      {securityNote && (
        <Note tone="clay">
          Pokud jste tuto změnu neprovedli vy, doporučujeme si co nejdříve
          změnit heslo.
        </Note>
      )}

      <ButtonRow>
        <EmailButton href={accountLink}>Zobrazit účet</EmailButton>
      </ButtonRow>

      <P small>
        Pokud změnu nepoznáváte, napište nám na{" "}
        <Link
          href={`mailto:${CONTACT_EMAIL}`}
          style={{ color: brand.ink, textDecoration: "underline" }}
        >
          {CONTACT_EMAIL}
        </Link>{" "}
        — rádi vše prověříme.
      </P>
      <Signature />
    </EmailLayout>
  );
}

export const AccountChangeEmail = (props: AccountChangeEmailProps) => (
  <AccountChangeEmailComponent {...props} />
);

// Mock data for preview/development
const mockAccountChange: AccountChangeEmailProps = {
  customerName: "Vážený zákazník",
  changeType: "Změna osobních údajů",
  changeDetails: "Bylo aktualizováno jméno a příjmení",
  changeTime: new Date().toLocaleString('cs-CZ'),
  accountLink: "https://keramickazahrada.cz/account",
  securityNote: true,
};

export default () => <AccountChangeEmailComponent {...mockAccountChange} />;
