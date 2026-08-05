import { Link } from "@react-email/components"
import {
  brand,
  CONTACT_EMAIL,
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

interface AccountDeletedEmailProps {
  customerName?: string;
  email?: string;
  deletionDate?: string;
}

function AccountDeletedEmailComponent({
  customerName = "Vážený zákazník",
  email = "your@email.com",
  deletionDate = new Date().toLocaleDateString('cs-CZ')
}: AccountDeletedEmailProps) {
  return (
    <EmailLayout preview="Váš účet byl smazán. Děkujeme za důvěru.">
      <Eyebrow>Váš účet</Eyebrow>
      <EmailH1 accent="a děkujeme.">Na shledanou</EmailH1>

      <Greeting name={customerName} />
      <P>
        váš účet jsme smazali. Osobní údaje jsme odstranili v souladu se
        zásadami ochrany osobních údajů; historii objednávek uchováváme
        jen tam, kde nám to ukládá zákon.
      </P>

      <LedgerRow label="Účet" value={email} />
      <LedgerRow label="Smazán dne" value={deletionDate} />
      <LedgerEnd />

      <P>Děkujeme za důvěru i za čas, který jste u nás strávili.</P>

      <Note tone="olive">
        Dveře ateliéru zůstávají otevřené — nový účet si můžete založit
        kdykoli.
      </Note>

      <P small>
        Pokud jste o smazání účtu nežádali, napište nám prosím na{" "}
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
  );
}

export const AccountDeletedEmail = (props: AccountDeletedEmailProps) => (
  <AccountDeletedEmailComponent {...props} />
);

// Mock data for preview/development
const mockAccountDeleted: AccountDeletedEmailProps = {
  customerName: "Vážený zákazník",
  email: "jana.novakova@example.cz",
  deletionDate: new Date().toLocaleDateString('cs-CZ'),
};

export default () => <AccountDeletedEmailComponent {...mockAccountDeleted} />;
