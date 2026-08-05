import {
  ButtonRow,
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

interface ReturnApprovedEmailProps {
  customerName?: string;
  orderNumber?: string;
  returnNumber?: string;
  approvedItems?: string;
  returnReason?: string;
  returnMethod?: string;
  returnDeadline?: string;
  returnAddress?: string;
  returnInstructions?: string;
  orderLink?: string;
}

/**
 * Číslo vrácení a seznam objektů se vykreslí jen s reálnými daty — vymyšlená
 * výchozí hodnota by v ostrém e-mailu tvrdila, že se vrací něco jiného.
 */
function ReturnApprovedEmailComponent({
  customerName = "Vážený zákazník",
  orderNumber = "#12345",
  returnNumber,
  approvedItems,
  returnReason = "Požadavek zákazníka",
  returnMethod = "Zásilka na adresu ateliéru",
  returnDeadline = "30 dní od schválení",
  returnAddress = "Ateliér Keramická zahrada, Písek",
  returnInstructions = "Přiložte prosím doklad o nákupu a objekty vraťte v původním balení",
  orderLink = "https://keramickazahrada.cz",
}: ReturnApprovedEmailProps) {
  return (
    <EmailLayout
      preview={`Vrácení k objednávce ${orderNumber} jsme schválili.`}
    >
      <Eyebrow>Vrácení</Eyebrow>
      <EmailH1 accent="schváleno.">Vrácení</EmailH1>

      <Greeting name={customerName} />
      <P>
        vaší žádosti o vrácení jsme vyhověli. Níže najdete vše potřebné —
        které kousky se vracejí, kam je poslat a dokdy.
      </P>

      <LedgerRow label="Objednávka" value={orderNumber} />
      {returnNumber ? <LedgerRow label="Vrácení" value={returnNumber} /> : null}
      {approvedItems ? <LedgerRow label="Objekty" value={approvedItems} /> : null}
      <LedgerRow label="Důvod" value={returnReason} />
      <LedgerRow label="Způsob vrácení" value={returnMethod} />
      <LedgerRow label="Adresa" value={returnAddress} />
      <LedgerRow label="Lhůta" value={returnDeadline} strong tone="clay" />
      <LedgerEnd />

      <Note tone="olive">
        Jakmile k nám objekty dorazí a projdou kontrolou, vrátíme vám peníze
        na původní platební metodu.
      </Note>

      <ButtonRow>
        <EmailButton href={orderLink}>Zobrazit objednávku</EmailButton>
      </ButtonRow>

      <P small>
        {returnInstructions}. Kousky prosím pečlivě zabalte, ať cestu zpět
        přečkají ve zdraví. O přijetí zásilky i o vrácení peněz vás budeme
        informovat e-mailem.
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const ReturnApprovedEmail = (props: ReturnApprovedEmailProps) => (
  <ReturnApprovedEmailComponent {...props} />
)

// Mock data for preview/development
const mockReturnApproved: ReturnApprovedEmailProps = {
  customerName: "Jan Novák",
  orderNumber: "#12345",
  returnNumber: "RTN12345",
  approvedItems: "Keramický hrnek — modrý, Keramický talíř — bílý",
  returnReason: "Požadavek zákazníka",
  returnMethod: "Zásilka na adresu ateliéru",
  returnDeadline: "30 dní od schválení",
  returnAddress: "Ateliér Keramická zahrada, Písek",
  returnInstructions: "Přiložte prosím doklad o nákupu a objekty vraťte v původním balení",
  orderLink: "https://keramickazahrada.cz/orders/12345",
}

export default () => <ReturnApprovedEmailComponent {...mockReturnApproved} />
