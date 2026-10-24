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

interface OrderShipmentEmailProps {
  customerName?: string;
  orderNumber?: string;
  trackingNumber?: string;
  carrierName?: string;
  /** Only when somebody actually promised one — no fabricated estimate. */
  estimatedDelivery?: string;
  trackingLink?: string;
  orderLink?: string;
  /**
   * Podepsaný odkaz na „Odstoupit od smlouvy" (`/order/:id/odstoupeni`,
   * § 1830a OZ). Prázdný u čisté zakázky (§ 1837 písm. d) — pak se odstavec
   * nevykreslí.
   */
  withdrawalUrl?: string;
}

/**
 * Sledování, dopravce i odhad doručení se vykreslí jen s reálnými daty —
 * dřívější výchozí hodnoty („CZ123456789", „2-3 pracovní dny") by v ostrém
 * e-mailu tvrdily číslo zásilky a termín, které nikdo neslíbil.
 *
 * ## Převzetí zásilky (14. 10. 2026, právní audit §4.1)
 *
 * Prohlédnout obal při převzetí je PROSBA, ne podmínka: za vadu při převzetí
 * odpovídá prodávající (§ 2161 OZ) a škodu s dopravcem řeší ona. Dřívější
 * blok `CarrierDamageWarning` („do dvou pracovních dnů — potom už reklamaci
 * Česká pošta nepřijme") přenášel lhůtu dopravce na zákazníka.
 */
function OrderShipmentEmailComponent({
  customerName,
  orderNumber = "",
  trackingNumber,
  carrierName,
  estimatedDelivery,
  trackingLink = "",
  orderLink = "",
  withdrawalUrl = "",
}: OrderShipmentEmailProps) {
  // Subscriber may pass empty strings when the carrier runs in record-only
  // mode — then the e-mail goes without the tracking row and button.
  const hasTracking = Boolean(trackingLink)
  const orderUrl = orderLink || storeLink()

  return (
    <EmailLayout
      preview={`Objednávku ${orderNumber} jsem předala dopravci — je na cestě k vám.`}
    >
      <Eyebrow>Zásilka</Eyebrow>
      <EmailH1 accent="je na cestě k vám.">Vaše objednávka</EmailH1>

      <Greeting name={customerName} />
      <P>
        objednávku {orderNumber} jsem předala dopravci. Každý kousek jsem
        zabalila ručně, aby k vám dorazil tak, jak odešel z dílny.
      </P>

      {orderNumber ? <LedgerRow label="Objednávka" value={orderNumber} /> : null}
      {carrierName ? <LedgerRow label="Dopravce" value={carrierName} /> : null}
      {trackingNumber ? (
        <LedgerRow label="Číslo zásilky" value={trackingNumber} strong />
      ) : null}
      {estimatedDelivery ? (
        <LedgerRow label="Odhad doručení" value={estimatedDelivery} />
      ) : null}
      <LedgerEnd />

      <ButtonRow>
        {hasTracking ? (
          <>
            <EmailButton href={trackingLink}>Sledovat zásilku</EmailButton>
            {orderUrl ? (
              <>
                <span style={{ display: "inline-block", width: "12px" }} />
                <EmailButton href={orderUrl} variant="ghost">
                  Zobrazit objednávku
                </EmailButton>
              </>
            ) : null}
          </>
        ) : orderUrl ? (
          <EmailButton href={orderUrl}>Zobrazit objednávku</EmailButton>
        ) : null}
      </ButtonRow>

      <Note tone="olive">Keramika je křehká, proto cestuje v pořádném balení.</Note>

      {/* Prosba, ne podmínka — škodu s dopravcem řeší prodávající (§ 2161 OZ). */}
      <Note tone="clay">
        Až zásilka dorazí, prohlédněte si prosím obal ještě při převzetí. Je-li
        promáčklý, protržený nebo prosakuje, můžete balík rozbalit rovnou před
        doručovatelem a poškození s ním sepsat — mně to pak usnadní vyřízení
        s dopravcem. Podmínkou to ale není: když poškození najdete až doma,
        napište mi a přiložte fotky, obal si prosím schovejte. Poškozený kousek
        vyměním nebo vám vrátím peníze a s dopravcem si to vyřídím sama.
      </Note>

      <P small>
        O doručení vám dá dopravce vědět SMS nebo e-mailem. Když vás
        nezastihne, zásilku uloží k vyzvednutí.
      </P>

      {/* § 1830a OZ — tlačítko pro odstoupení i pro hosta bez účtu. */}
      {withdrawalUrl ? (
        <P small>
          Kdybyste si to rozmysleli: od kupní smlouvy můžete odstoupit bez udání
          důvodu do 14 dnů od převzetí zboží, online přes tlačítko{" "}
          <Link href={withdrawalUrl} style={{ color: brand.clay }}>
            Odstoupit od smlouvy
          </Link>
          .
        </P>
      ) : null}
      <Signature />
    </EmailLayout>
  )
}

export const OrderShipmentEmail = (props: OrderShipmentEmailProps) => (
  <OrderShipmentEmailComponent {...props} />
)

// Mock data for preview/development
const mockOrderShipment: OrderShipmentEmailProps = {
  customerName: "Jan Novák",
  orderNumber: "#12345",
  trackingNumber: "CZ123456789",
  carrierName: "Česká pošta",
  estimatedDelivery: "2-3 pracovní dny",
  trackingLink: "https://www.postaonline.cz/trackandtrace/-/zasilka/cislo?parcelNumbers=CZ123456789",
  orderLink: "https://keramickazahrada.cz/orders/12345",
  withdrawalUrl: "https://keramickazahrada.cz/cz/order/order_12345/odstoupeni?token=abc",
}

export default () => <OrderShipmentEmailComponent {...mockOrderShipment} />
