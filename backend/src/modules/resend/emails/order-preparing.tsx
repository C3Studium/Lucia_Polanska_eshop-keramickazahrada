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
import { storeLink } from "../../../lib/storefront-url"

interface OrderPreparingEmailProps {
  customerName?: string;
  orderNumber?: string;
  orderLink?: string;
}

/**
 * Sent when a merchant moves an ordinary (in-stock) order into the
 * „Připravujeme" stage — the objects are being packed for dispatch. This is
 * NOT the made-to-order „Výroba začíná" (that is order-processing); here
 * nothing is being made, the order is simply taken in hand and readied to ship.
 */
function OrderPreparingEmailComponent({
  customerName,
  orderNumber = "",
  orderLink = ""
}: OrderPreparingEmailProps) {
  const orderUrl = orderLink || storeLink()
  return (
    <EmailLayout
      preview={`Objednávku ${orderNumber} připravujeme.`}
    >
      <Eyebrow>Objednávka</Eyebrow>
      <EmailH1 accent="vaši objednávku.">Připravujeme</EmailH1>

      <Greeting name={customerName} />
      <P>
        vaši objednávku {orderNumber} jsme vzali do ruky a připravujeme ji
        pro vás. Jakmile bude hotová, dáme vám hned vědět.
      </P>

      {orderNumber ? (
        <>
          <LedgerRow label="Objednávka" value={orderNumber} strong />
          <LedgerEnd />
        </>
      ) : null}

      <Note tone="olive">Objednávku připravujeme.</Note>

      {orderUrl ? (
        <ButtonRow>
          <EmailButton href={orderUrl}>Zobrazit objednávku</EmailButton>
        </ButtonRow>
      ) : null}

      <Signature />
    </EmailLayout>
  )
}

export const OrderPreparingEmail = (props: OrderPreparingEmailProps) => (
  <OrderPreparingEmailComponent {...props} />
);

// Mock data for preview/development
const mockOrderPreparing: OrderPreparingEmailProps = {
  customerName: "Jana Nováková",
  orderNumber: "#12345",
  orderLink: "https://keramickazahrada.cz/orders/12345",
};

export default () => <OrderPreparingEmailComponent {...mockOrderPreparing} />;
