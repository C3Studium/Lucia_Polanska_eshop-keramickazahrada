import {
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

interface ReturnRejectedEmailProps {
  customerName?: string;
  orderNumber?: string;
  returnNumber?: string;
  rejectedItems?: string;
  rejectionReason?: string;
  appealInstructions?: string;
  orderLink?: string;
  supportEmail?: string;
}

function ReturnRejectedEmailComponent({
  customerName = "Vážený zákazník",
  orderNumber = "#12345",
  returnNumber = "RTN12345",
  rejectedItems = "Keramický hrnek — modrý",
  rejectionReason = "Objekt nese stopy používání",
  appealInstructions = "Ozvat se nám můžete do 14 dní od obdržení tohoto e-mailu",
  orderLink = "https://keramickazahrada.cz/orders/12345",
  supportEmail = CONTACT_EMAIL,
}: ReturnRejectedEmailProps) {
  return (
    <EmailLayout
      preview={`Žádosti o vrácení k objednávce ${orderNumber} bohužel nemůžeme vyhovět.`}
    >
      <Eyebrow>Vrácení</Eyebrow>
      <EmailH1 accent="nemůžeme přijmout.">Vrácení</EmailH1>

      <Greeting name={customerName} />
      <P>
        vaši žádost o vrácení jsme pečlivě posoudili. Je nám líto, ale
        tentokrát jí nemůžeme vyhovět — důvod uvádíme níže.
      </P>

      <LedgerRow label="Objednávka" value={orderNumber} />
      <LedgerRow label="Vrácení" value={returnNumber} />
      <LedgerRow label="Objekty" value={rejectedItems} />
      <LedgerRow label="Důvod zamítnutí" value={rejectionReason} tone="danger" />
      <LedgerEnd />

      <P>
        Objekt zůstává váš. Pokud už k nám doputoval, pošleme vám ho zpět na
        adresu z objednávky.
      </P>

      <Note tone="danger">
        Žádosti jsme tentokrát nemohli vyhovět — pokud to vidíte jinak,
        ozvěte se nám a společně to probereme.
      </Note>

      <ButtonRow>
        <EmailButton href={`mailto:${supportEmail}`}>Napsat nám</EmailButton>
        <span style={{ display: "inline-block", width: "12px" }} />
        <EmailButton href={orderLink} variant="ghost">
          Zobrazit objednávku
        </EmailButton>
      </ButtonRow>

      <P small>
        {appealInstructions}. Připomínáme, že vrácené objekty přijímáme
        nepoužité a v původním stavu, do 30 dnů od doručení.
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const ReturnRejectedEmail = (props: ReturnRejectedEmailProps) => (
  <ReturnRejectedEmailComponent {...props} />
)

// Mock data for preview/development
const mockReturnRejected: ReturnRejectedEmailProps = {
  customerName: "Jan Novák",
  orderNumber: "#12345",
  returnNumber: "RTN12345",
  rejectedItems: "Keramický hrnek — modrý",
  rejectionReason: "Objekt nese stopy používání",
  appealInstructions: "Ozvat se nám můžete do 14 dní od obdržení tohoto e-mailu",
  orderLink: "https://keramickazahrada.cz/orders/12345",
  supportEmail: CONTACT_EMAIL,
}

export default () => <ReturnRejectedEmailComponent {...mockReturnRejected} />
