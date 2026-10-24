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

interface OrderReadyPickupEmailProps {
  customerName?: string;
  orderNumber?: string;
  pickupLocation?: string;
  pickupAddress?: string;
  pickupHours?: string;
  readyDate?: string;
  pickupDeadline?: string;
  orderLink?: string;
  pickupInstructions?: string;
}

/**
 * Řádky s otevírací dobou, termínem a datem se vykreslí jen s reálnými daty —
 * ateliér nemá pevnou otevírací dobu ani lhůtu, vyzvednutí se domlouvá,
 * a vymyšlená výchozí hodnota v e-mailu by byla horší než žádná.
 */
function OrderReadyPickupEmailComponent({
  customerName,
  orderNumber = "",
  pickupLocation = "Dílna Keramická zahrada, Písek",
  pickupAddress = "Putim 229, 397 01 Písek",
  pickupHours,
  readyDate,
  pickupDeadline,
  orderLink = "",
  pickupInstructions
}: OrderReadyPickupEmailProps) {
  const orderUrl = orderLink || storeLink()
  return (
    <EmailLayout
      preview={`Objednávka ${orderNumber} je zabalená a čeká na vás v dílně.`}
    >
      <Eyebrow>Osobní odběr</Eyebrow>
      <EmailH1 accent="čeká na vás v dílně.">Zabaleno,</EmailH1>

      <Greeting name={customerName} />
      <P>
        vaši objednávku {orderNumber} mám zabalenou a čeká na vás u mě
        v dílně. Kde a kdy si ji můžete vyzvednout, najdete níže.
      </P>

      <LedgerRow label="Objednávka" value={orderNumber} />
      <LedgerRow label="Místo" value={pickupLocation} strong />
      <LedgerRow label="Adresa" value={pickupAddress} />
      {pickupHours ? (
        <LedgerRow label="Otevírací doba" value={pickupHours} />
      ) : null}
      {readyDate ? <LedgerRow label="Připraveno od" value={readyDate} /> : null}
      {pickupDeadline ? (
        <LedgerRow label="Vyzvednout do" value={pickupDeadline} tone="clay" />
      ) : null}
      <LedgerEnd />

      <Note tone="olive">Objednávka na vás čeká u mě v dílně.</Note>

      {orderUrl ? (
        <ButtonRow>
          <EmailButton href={orderUrl}>Zobrazit objednávku</EmailButton>
        </ButtonRow>
      ) : null}

      <P small>
        {pickupInstructions
          ? `${pickupInstructions} `
          : "Termín vyzvednutí si prosím domluvíme — napište mi na info@keramickazahrada.cz nebo mi zavolejte. "}
        Kdyby se vám to teď nehodilo, napište mi; objednávka u mě počká.
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const OrderReadyPickupEmail = (props: OrderReadyPickupEmailProps) => (
  <OrderReadyPickupEmailComponent {...props} />
)

// Mock data for preview/development
const mockOrderReadyPickup: OrderReadyPickupEmailProps = {
  customerName: "Jan Novák",
  orderNumber: "#12345",
  pickupLocation: "Dílna Keramická zahrada, Písek",
  pickupAddress: "Putim 229, 397 01 Písek",
  readyDate: new Date().toLocaleDateString('cs-CZ'),
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed",
}

export default () => <OrderReadyPickupEmailComponent {...mockOrderReadyPickup} />
