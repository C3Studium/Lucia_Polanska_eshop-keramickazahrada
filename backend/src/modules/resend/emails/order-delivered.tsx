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
import { CarrierDamageClaim } from "../components/carrier-damage"
import { storeLink } from "../../../lib/storefront-url"

interface OrderDeliveredEmailProps {
  /** Storefront page with the claim block and the downloadable document. */
  claimUrl?: string;
  customerName?: string;
  orderNumber?: string;
  /**
   * True only when the objects travelled with a carrier. The one live send
   * site (`delivery.created` in subscribers/customer-emails.ts) fires for
   * personal pickups — the customer held the piece in their hands, so a
   * „poškozená zásilka" claim block would talk about a parcel that never
   * existed. The carrier-damage flow stays available for a future
   * courier-delivery send site via this flag.
   */
  shippedByCarrier?: boolean;
}

/**
 * Sent when a personal-pickup order's shipment is created — the objects have
 * been handed over, the order is complete. No address talk: nothing was posted.
 */
function OrderDeliveredEmailComponent({
  customerName,
  orderNumber = "",
  claimUrl,
  shippedByCarrier = false,
}: OrderDeliveredEmailProps) {
  const shopUrl = storeLink()
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

      {orderNumber ? (
        <>
          <LedgerRow label="Objednávka" value={orderNumber} strong />
          <LedgerEnd />
        </>
      ) : null}

      <Note tone="olive">Děkujeme za důvěru.</Note>

      <P>
        Budete-li se chtít podělit o své dojmy, budeme rádi. A kdybyste
        s kousky potřebovali cokoli poradit, stačí odpovědět na tento e-mail.
      </P>

      {shopUrl ? (
        <ButtonRow>
          <EmailButton href={shopUrl}>Prohlédnout další kousky</EmailButton>
        </ButtonRow>
      ) : null}
      {/* Carrier deliveries only: the two working days for a ČP damage claim
          run from today. A personal pickup has no parcel to claim about. */}
      {shippedByCarrier ? (
        <CarrierDamageClaim orderNumber={orderNumber} claimUrl={claimUrl} />
      ) : null}

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
  shippedByCarrier: true,
  claimUrl: "https://keramickazahrada.cz/cz/reklamacni-protokol",
};

export default () => <OrderDeliveredEmailComponent {...mockOrderDelivered} />;
