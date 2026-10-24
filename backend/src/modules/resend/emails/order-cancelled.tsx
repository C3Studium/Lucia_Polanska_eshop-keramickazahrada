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
    <EmailLayout preview={`Objednávku ${orderNumber} jsem musela zrušit — omlouvám se.`}>
      <Eyebrow>Objednávka {orderNumber}</Eyebrow>
      <EmailH1 accent="je zrušená.">Objednávka</EmailH1>

      <Greeting name={customerName} />
      <P>
        mrzí mě to, ale vaši objednávku {orderNumber} jsem zrušila. Pokud jste
        o zrušení nežádali nebo vám cokoli není jasné, napište mi na info@keramickazahrada.cz a dáme to do pořádku.
      </P>

      {orderNumber ? <LedgerRow label="Objednávka" value={orderNumber} /> : null}
      {reason ? <LedgerRow label="Důvod zrušení" value={reason} /> : null}
      {refundRecorded && refundAmount ? (
        <LedgerRow label="Vráceno" value={refundAmount} strong tone="olive" />
      ) : null}
      <LedgerEnd />

      <Note tone="danger">Objednávka je zrušená, nic dalšího od vás nepotřebuji.</Note>

      {refundRecorded ? (
        <P>
          Zaplacenou částku{refundAmount ? ` ${refundAmount}` : ""} jsem vám
          vrátila stejnou cestou, jakou ke mně platba přišla. Kdy se peníze
          objeví na účtu, záleží na vaší bance — obvykle do několika
          pracovních dnů.
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
        Omlouvám se za komplikace, které vám tím vznikly.
        {refundRecorded
          ? ""
          : " Kdybyste měli k platbě nebo ke zrušení otázku, napište mi na info@keramickazahrada.cz."}
      </P>
      <Signature closing="Omlouvám se a děkuji za pochopení," />
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
