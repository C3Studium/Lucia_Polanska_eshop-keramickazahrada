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

interface OrderDeliveredEmailProps {
  customerName?: string;
  orderNumber?: string;
}

/**
 * Sent when a personal-pickup order's shipment is created — the objects have
 * been handed over, the order is complete. No address talk: nothing was posted.
 */
function OrderDeliveredEmailComponent({
  customerName = "Vážený zákazník",
  orderNumber = "#12345"
}: OrderDeliveredEmailProps) {
  return (
    <EmailLayout
      preview={`Objednávka ${orderNumber} je vyřízená — objekty jsou u vás.`}
    >
      <Eyebrow>Objednávka {orderNumber}</Eyebrow>
      <EmailH1 accent="u vás.">Objekty jsou</EmailH1>

      <Greeting name={customerName} />
      <P>
        vaše objednávka {orderNumber} je vyřízená a objekty jsou teď ve vašich
        rukou. Věříme, že vám budou dělat radost — v zahradě i doma.
      </P>

      <LedgerRow label="Objednávka" value={orderNumber} strong />
      <LedgerEnd />

      <Note tone="olive">Děkujeme za důvěru.</Note>

      <P>
        Budete-li se chtít podělit o své dojmy, budeme rádi. A kdybyste
        s kousky potřebovali cokoli poradit, stačí odpovědět na tento e-mail.
      </P>

      <ButtonRow>
        <EmailButton href="https://keramickazahrada.cz">
          Prohlédnout další kousky
        </EmailButton>
      </ButtonRow>

      <Signature />
    </EmailLayout>
  )
}

export const OrderDeliveredEmail = (props: OrderDeliveredEmailProps) => (
  <OrderDeliveredEmailComponent {...props} />
);

// Mock data for preview/development
const mockOrderDelivered: OrderDeliveredEmailProps = {
  customerName: "Jana Nováková",
  orderNumber: "#12345",
};

export default () => <OrderDeliveredEmailComponent {...mockOrderDelivered} />;
