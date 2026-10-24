import { Link } from "@react-email/components"
import {
  brand,
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

interface OrderDeliveredEmailProps {
  /** Storefront page with the claim block (reklamace z e-mailu). */
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
  /**
   * Podepsaný odkaz na „Odstoupit od smlouvy" (`/order/:id/odstoupeni`,
   * § 1830a OZ) — převzetím začíná 14denní lhůta. Prázdný u čisté zakázky
   * (§ 1837 písm. d) → odstavec se nevykreslí.
   */
  withdrawalUrl?: string;
}

/**
 * Sent when a personal-pickup order's shipment is created — the objects have
 * been handed over, the order is complete. No address talk: nothing was posted.
 *
 * Poškozená zásilka (14. 10. 2026, právní audit §4.1): zákazník hlásí
 * poškození NÁM (fotky vítány, obal schovat); s dopravcem to řeší prodávající.
 * Dřívější `CarrierDamageClaim` („reklamaci u České pošty podává příjemce,
 * jen dva pracovní dny") z lhůty dopravce dělal podmínku reklamace.
 */
function OrderDeliveredEmailComponent({
  customerName,
  orderNumber = "",
  claimUrl,
  shippedByCarrier = false,
  withdrawalUrl = "",
}: OrderDeliveredEmailProps) {
  const shopUrl = storeLink()
  return (
    <EmailLayout
      preview={`Objednávka ${orderNumber} je u vás — děkuji za důvěru.`}
    >
      <Eyebrow>Objednávka {orderNumber}</Eyebrow>
      <EmailH1 accent="jsou u vás.">Vaše kousky</EmailH1>

      <Greeting name={customerName} />
      <P>
        vaše objednávka {orderNumber} je u vás a z mé strany tím vyřízená.
        Přeji si, aby vám kousky dělaly radost — v zahradě i doma.
      </P>

      {orderNumber ? (
        <>
          <LedgerRow label="Objednávka" value={orderNumber} strong />
          <LedgerEnd />
        </>
      ) : null}

      <Note tone="olive">Děkuji, že jste si vybrali keramiku z mé dílny.</Note>

      <P>
        Kdybyste s kousky potřebovali cokoli poradit — třeba jak o ně pečovat —
        napište mi na info@keramickazahrada.cz, odpovídám sama.
      </P>

      {shopUrl ? (
        <ButtonRow>
          <EmailButton href={shopUrl}>Prohlédnout další kousky</EmailButton>
        </ButtonRow>
      ) : null}
      {/* Carrier deliveries only. Poškození hlásí zákazník nám — žádná lhůta
          dopravce, žádný formulář pošty jako podmínka. */}
      {shippedByCarrier ? (
        <>
          <P>
            <strong>Dorazila zásilka poškozená?</strong> Napište mi prosím
            {orderNumber ? ` (objednávka ${orderNumber})` : ""} a přiložte fotky
            obalu i zboží — poškozený kousek vyměním nebo vám vrátím peníze
            a s dopravcem si to vyřídím sama. Obal si prosím schovejte, dokud
            se vám neozvu.
          </P>
          {claimUrl ? (
            <P>
              Reklamaci můžete podat i online:{" "}
              <Link href={claimUrl} style={{ color: brand.clay }}>
                {claimUrl}
              </Link>
            </P>
          ) : null}
        </>
      ) : null}

      {/* § 1830a OZ — odstoupení online i pro hosta bez účtu. */}
      {withdrawalUrl ? (
        <P small>
          Od kupní smlouvy můžete odstoupit bez udání důvodu do 14 dnů od
          převzetí zboží, online přes tlačítko{" "}
          <Link href={withdrawalUrl} style={{ color: brand.clay }}>
            Odstoupit od smlouvy
          </Link>
          .
        </P>
      ) : null}

      <Signature closing="Mějte se krásně," />
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
  claimUrl: "https://keramickazahrada.cz/cz/order/order_12345/refund?token=abc",
  withdrawalUrl: "https://keramickazahrada.cz/cz/order/order_12345/odstoupeni?token=abc",
};

export default () => <OrderDeliveredEmailComponent {...mockOrderDelivered} />;
