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

interface OrderProcessingEmailProps {
  customerName?: string;
  orderNumber?: string;
  estimatedProcessingTime?: string;
  orderLink?: string;
}

/**
 * Sent when a made-to-order specification is confirmed — production begins.
 * The subscriber passes `estimatedProcessingTime` as a whole sentence
 * („Jakmile bude hotovo, dáme vám vědět…"), so it renders as a paragraph,
 * not a ledger value.
 */
function OrderProcessingEmailComponent({
  customerName = "Vážený zákazník",
  orderNumber = "#12345",
  estimatedProcessingTime = "Jakmile bude hotovo, dáme vám vědět a domluvíme se na odeslání.",
  orderLink = "https://keramickazahrada.cz/orders/12345"
}: OrderProcessingEmailProps) {
  return (
    <EmailLayout
      preview={`Zadání objednávky ${orderNumber} je potvrzené — v ateliéru začíná výroba.`}
    >
      <Eyebrow>Zakázková výroba</Eyebrow>
      <EmailH1 accent="začíná.">Výroba</EmailH1>

      <Greeting name={customerName} />
      <P>
        zadání vaší objednávky {orderNumber} máme potvrzené a v ateliéru se
        pouštíme do práce. Každý kousek vzniká rukama — točení, sušení, pálení
        i glazura si žádají svůj čas.
      </P>

      <LedgerRow label="Objednávka" value={orderNumber} strong />
      <LedgerEnd />

      <Note tone="olive">Výroba právě začala.</Note>

      <P>{estimatedProcessingTime}</P>

      <ButtonRow>
        <EmailButton href={orderLink}>Zobrazit objednávku</EmailButton>
      </ButtonRow>

      <Signature />
    </EmailLayout>
  )
}

export const OrderProcessingEmail = (props: OrderProcessingEmailProps) => (
  <OrderProcessingEmailComponent {...props} />
);

// Mock data for preview/development
const mockOrderProcessing: OrderProcessingEmailProps = {
  customerName: "Jana Nováková",
  orderNumber: "#12345",
  estimatedProcessingTime: "Jakmile bude hotovo, dáme vám vědět a domluvíme se na odeslání.",
  orderLink: "https://keramickazahrada.cz/orders/12345",
};

export default () => <OrderProcessingEmailComponent {...mockOrderProcessing} />;
