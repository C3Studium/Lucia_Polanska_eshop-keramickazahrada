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
  customerName = "Vážený zákazník",
  orderNumber = "#12345",
  pickupLocation = "Ateliér Keramická zahrada",
  pickupAddress = "Putim 229, 397 01 Písek",
  pickupHours,
  readyDate,
  pickupDeadline,
  orderLink = "https://keramickazahrada.cz",
  pickupInstructions
}: OrderReadyPickupEmailProps) {
  return (
    <EmailLayout
      preview={`Objednávka ${orderNumber} je zabalená a připravená k vyzvednutí.`}
    >
      <Eyebrow>Osobní odběr</Eyebrow>
      <EmailH1 accent="k vyzvednutí.">Připraveno</EmailH1>

      <Greeting name={customerName} />
      <P>
        vaše objednávka {orderNumber} je zabalená a čeká na vás. Vše potřebné
        k vyzvednutí najdete níže.
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

      <Note tone="olive">Objednávka na vás čeká.</Note>

      <ButtonRow>
        <EmailButton href={orderLink}>Zobrazit objednávku</EmailButton>
      </ButtonRow>

      <P small>
        {pickupInstructions
          ? `${pickupInstructions} `
          : "Termín vyzvednutí si prosím domluvíme — stačí odpovědět na tento e-mail nebo zavolat. "}
        Pokud se vám to zrovna nehodí, dejte nám vědět, objednávka počká.
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
  pickupLocation: "Ateliér Keramická zahrada",
  pickupAddress: "Putim 229, 397 01 Písek",
  readyDate: new Date().toLocaleDateString('cs-CZ'),
  orderLink: "https://keramickazahrada.cz/objednavka/12345",
}

export default () => <OrderReadyPickupEmailComponent {...mockOrderReadyPickup} />
