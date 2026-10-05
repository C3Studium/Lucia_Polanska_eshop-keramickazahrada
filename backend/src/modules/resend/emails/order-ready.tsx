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

interface OrderReadyEmailProps {
  customerName?: string;
  orderNumber?: string;
  orderLink?: string;
}

/**
 * „Objednávka je připravená k odeslání" — mezikrok mezi potvrzením a odesláním.
 * Posílá se, když majitelka přesune objednávku do fáze „K odeslání" (zabaleno,
 * čeká na předání dopravci). U osobního odběru a u čistě zakázkových objednávek
 * se NEposílá — ty mají vlastní e-mail („k vyzvednutí", resp. „zakázka hotová").
 */
function OrderReadyEmailComponent({
  customerName,
  orderNumber = "",
  orderLink = "",
}: OrderReadyEmailProps) {
  const orderUrl = orderLink || storeLink()
  return (
    <EmailLayout
      preview={`Objednávka ${orderNumber} je zabalená a připravená k odeslání.`}
    >
      <Eyebrow>Objednávka</Eyebrow>
      <EmailH1 accent="k odeslání.">Připravená</EmailH1>

      <Greeting name={customerName} />
      <P>
        vaši objednávku {orderNumber} máme zabalenou a připravenou — teď už jen
        čeká na předání dopravci. Jakmile ji podáme, dáme vám vědět a pošleme
        sledování zásilky.
      </P>

      {orderNumber ? (
        <>
          <LedgerRow label="Objednávka" value={orderNumber} strong />
          <LedgerEnd />
        </>
      ) : null}

      <Note tone="olive">Zabaleno a připraveno k odeslání.</Note>

      {orderUrl ? (
        <ButtonRow>
          <EmailButton href={orderUrl}>Zobrazit objednávku</EmailButton>
        </ButtonRow>
      ) : null}

      <Signature />
    </EmailLayout>
  )
}

export const OrderReadyEmail = (props: OrderReadyEmailProps) => (
  <OrderReadyEmailComponent {...props} />
)

// Mock data for preview/development
const mockOrderReady: OrderReadyEmailProps = {
  customerName: "Jana Nováková",
  orderNumber: "#12345",
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed",
}

export default () => <OrderReadyEmailComponent {...mockOrderReady} />
