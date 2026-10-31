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
  /** Co se platí až na místě; `null`, když je objednávka zaplacená. */
  amountDue?: string | null;
  /** Číslo účtu z Právních údajů — jen když ho majitelka vyplnila. */
  bankAccount?: string | null;
  /** V objednávce je vytištěný dárkový poukaz — ten se jen vyzvedává. */
  printedVoucher?: boolean;
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
  pickupInstructions,
  amountDue,
  bankAccount,
  printedVoucher = false
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
        {printedVoucher
          ? `vaše objednávka ${orderNumber} je vyřízená — dárkový poukaz mám vytištěný a čeká na vás u mě v dílně. Kde a kdy si ho můžete vyzvednout, najdete níže.`
          : `vaši objednávku ${orderNumber} mám zabalenou a čeká na vás u mě v dílně. Kde a kdy si ji můžete vyzvednout, najdete níže.`}
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
      {amountDue ? (
        <LedgerRow label="Zaplatíte na místě" value={amountDue} tone="clay" strong />
      ) : null}
      <LedgerEnd />

      {/*
        Osobní odběr se platí až u pultu, a ateliér není obchod s terminálem:
        bez téhle věty zákazník přijel s kartou a nebylo čím zaplatit
        (30. 10. 2026). Účet jen tehdy, když je v Právních údajích vyplněný.
      */}
      {amountDue ? (
        <Note tone="clay">
          Objednávku budete platit až při vyzvednutí — připravte si prosím{" "}
          {amountDue} v hotovosti
          {bankAccount
            ? `, nebo mi částku pošlete převodem na účet ${bankAccount} ještě před vyzvednutím (do zprávy pro příjemce napište ${orderNumber}).`
            : ", nebo se se mnou předem domluvte na převodu na účet."}
        </Note>
      ) : (
        <Note tone="olive">
          Objednávka je zaplacená, stačí si pro ni přijít.
        </Note>
      )}

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
  // Náhled ukazuje ten horší případ — nezaplacenou objednávku.
  amountDue: "1 290 Kč",
  bankAccount: "1234567890/2010",
}

export default () => <OrderReadyPickupEmailComponent {...mockOrderReadyPickup} />
