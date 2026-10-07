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
  /**
   * Jen když je refundace OPRAVDU zapsaná (refund_history). Bez vlajky e-mail o
   * penězích mlčí — slib „vrátíme do 3–5 dnů" u nezaplacené dobírky byl lež a u
   * zaplacené karty slib, který nikdo nehlídal.
   */
  refundRecorded?: boolean;
  /** Formátovaná vrácená částka (jen s `refundRecorded`). */
  refundAmount?: string;
}

/**
 * Důvod se vykreslí jen s reálnou hodnotou — výchozí „na žádost zákazníka"
 * by u zrušení z jiného důvodu tvrdilo zákazníkovi, že si ho vyžádal sám.
 */
function OrderCancelledEmailComponent({
  customerName,
  orderNumber = "",
  reason,
  refundRecorded,
  refundAmount,
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
      {refundRecorded && refundAmount ? (
        <LedgerRow label="Vráceno" value={refundAmount} strong tone="olive" />
      ) : null}
      <LedgerEnd />

      <Note tone="danger">Objednávka byla zrušena.</Note>

      {refundRecorded ? (
        <P>
          Zaplacenou částku{refundAmount ? ` ${refundAmount}` : ""} jsme vám
          vrátili stejnou cestou, jakou k nám platba přišla. Připsání závisí
          na vaší bance, obvykle do několika pracovních dnů.
        </P>
      ) : null}

      {shopUrl ? (
        <ButtonRow>
          <EmailButton href={shopUrl} variant="ghost">
            Prohlédnout nabídku
          </EmailButton>
        </ButtonRow>
      ) : null}

      <P small>
        Omlouváme se za případné nepříjemnosti.
        {refundRecorded
          ? ""
          : " Máte-li k platbě nebo ke zrušení dotaz, stačí odpovědět na tento e-mail."}
      </P>
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
  reason: "na žádost zákazníka",
  refundRecorded: true,
  refundAmount: "1 250 Kč",
}

export default () => <OrderCancelledEmailComponent {...mockOrderCancelled} />
