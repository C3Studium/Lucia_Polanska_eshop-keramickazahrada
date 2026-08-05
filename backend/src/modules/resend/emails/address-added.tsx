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

interface AddressAddedEmailProps {
  customerName?: string;
  addressType?: string;
  addressDetails?: string;
  addTime?: string;
  accountLink?: string;
  editLink?: string;
}

function AddressAddedEmailComponent({
  customerName = "Vážený zákazník",
  addressType = "Doručovací adresa",
  addressDetails = "Jan Novák\nVáclavské náměstí 123\n110 00 Praha 1\nČeská republika",
  addTime = new Date().toLocaleString('cs-CZ'),
  accountLink = "https://keramickazahrada.cz/account",
  editLink = "https://keramickazahrada.cz/account/addresses"
}: AddressAddedEmailProps) {
  /* Adresa přichází jako víceřádkový řetězec — v HTML by se slila do
     jednoho řádku, proto ji lámeme ručně. */
  const addressLines = addressDetails.split("\n").map((line, i) => (
    <span key={i}>
      {i > 0 ? <br /> : null}
      {line}
    </span>
  ))

  return (
    <EmailLayout preview="Do vašeho účtu jsme uložili novou adresu.">
      <Eyebrow>Váš účet</Eyebrow>
      <EmailH1 accent="uložena.">Nová adresa</EmailH1>

      <Greeting name={customerName} />
      <P>
        do vašeho účtu jsme uložili novou adresu. Při příští objednávce ji
        budete mít připravenou.
      </P>

      <LedgerRow label="Typ" value={addressType} />
      <LedgerRow label="Adresa" value={addressLines} />
      <LedgerRow label="Přidána" value={addTime} />
      <LedgerEnd />

      <ButtonRow>
        <EmailButton href={editLink}>Upravit adresy</EmailButton>
        <span style={{ display: "inline-block", width: "12px" }} />
        <EmailButton href={accountLink} variant="ghost">
          Zobrazit účet
        </EmailButton>
      </ButtonRow>

      <P small>
        Pokud jste tuto adresu nepřidali vy, napište nám prosím na{" "}
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

export const AddressAddedEmail = (props: AddressAddedEmailProps) => (
  <AddressAddedEmailComponent {...props} />
);

// Mock data for preview/development
const mockAddressAdded: AddressAddedEmailProps = {
  customerName: "Vážený zákazník",
  addressType: "Doručovací adresa",
  addressDetails: "Jan Novák\nVáclavské náměstí 123\n110 00 Praha 1\nČeská republika",
  addTime: new Date().toLocaleString('cs-CZ'),
  accountLink: "https://keramickazahrada.cz/account",
  editLink: "https://keramickazahrada.cz/account/addresses",
};

export default () => <AddressAddedEmailComponent {...mockAddressAdded} />;
