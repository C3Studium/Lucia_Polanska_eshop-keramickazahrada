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

interface OrderCancelledEmailProps {
  customerName?: string;
  orderNumber?: string;
  reason?: string;
}

function OrderCancelledEmailComponent({
  customerName = "Vážený zákazník",
  orderNumber = "#12345",
  reason = "na žádost zákazníka"
}: OrderCancelledEmailProps) {
  return (
    <EmailLayout preview={`Objednávku ${orderNumber} jsme zrušili.`}>
      <Eyebrow>Objednávka {orderNumber}</Eyebrow>
      <EmailH1 accent="zrušena.">Objednávka byla</EmailH1>

      <Greeting name={customerName} />
      <P>
        vaši objednávku {orderNumber} jsme zrušili. Pokud jste o zrušení
        nežádali nebo je vám cokoli nejasné, ozvěte se nám — stačí odpovědět
        na tento e-mail.
      </P>

      <LedgerRow label="Objednávka" value={orderNumber} />
      <LedgerRow label="Důvod zrušení" value={reason} />
      <LedgerEnd />

      <Note tone="danger">Objednávka byla zrušena.</Note>

      <P>
        Pokud už byla objednávka uhrazena, částku vám vrátíme zpět na účet
        během 3–5 pracovních dnů.
      </P>

      <ButtonRow>
        <EmailButton href="https://keramickazahrada.cz" variant="ghost">
          Prohlédnout nabídku
        </EmailButton>
      </ButtonRow>

      <P small>Omlouváme se za případné nepříjemnosti.</P>
      <Signature />
    </EmailLayout>
  )
}

export const OrderCancelledEmail = (props: OrderCancelledEmailProps) => (
  <OrderCancelledEmailComponent {...props} />
)

// Mock data for preview/development
const mockOrderCancelled: OrderCancelledEmailProps = {
  customerName: "Anna Dvořáková",
  orderNumber: "#12345",
  reason: "na žádost zákazníka"
}

export default () => <OrderCancelledEmailComponent {...mockOrderCancelled} />
