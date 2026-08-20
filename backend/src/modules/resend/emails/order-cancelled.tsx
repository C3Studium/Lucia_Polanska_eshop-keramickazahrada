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

interface OrderCancelledEmailProps {
  customerName?: string;
  orderNumber?: string;
  /** Only when somebody actually stated one — no fabricated default. */
  reason?: string;
}

/**
 * Důvod se vykreslí jen s reálnou hodnotou — výchozí „na žádost zákazníka"
 * by u zrušení z jiného důvodu tvrdilo zákazníkovi, že si ho vyžádal sám.
 */
function OrderCancelledEmailComponent({
  customerName,
  orderNumber = "",
  reason
}: OrderCancelledEmailProps) {
  const shopUrl = storeLink()
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

      {orderNumber ? <LedgerRow label="Objednávka" value={orderNumber} /> : null}
      {reason ? <LedgerRow label="Důvod zrušení" value={reason} /> : null}
      <LedgerEnd />

      <Note tone="danger">Objednávka byla zrušena.</Note>

      <P>
        Pokud už byla objednávka uhrazena, částku vám vrátíme zpět na účet
        během 3–5 pracovních dnů.
      </P>

      {shopUrl ? (
        <ButtonRow>
          <EmailButton href={shopUrl} variant="ghost">
            Prohlédnout nabídku
          </EmailButton>
        </ButtonRow>
      ) : null}

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
