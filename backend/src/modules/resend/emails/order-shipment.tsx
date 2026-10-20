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
      preview={`Objednávku ${orderNumber} jsme předali dopravci — je na cestě k vám.`}
    >
      <Eyebrow>Zásilka</Eyebrow>
      <EmailH1 accent="na cestě.">Objednávka je</EmailH1>

      <Greeting name={customerName} />
      <P>
        objednávku {orderNumber} jsme předali dopravci. Každý kus balíme
        ručně, aby k vám dorazil tak, jak opustil ateliér.
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

      <Note tone="olive">Křehké objekty cestují v ochranném balení.</Note>

      {/* Prosba, ne podmínka — škodu s dopravcem řešíme my (§ 2161 OZ). */}
      <Note tone="clay">
        Až zásilka dorazí, prohlédněte si prosím obal ještě při převzetí. Je-li
        promáčklý, protržený nebo prosakuje, můžete zásilku rozbalit před
        doručovatelem a poškození s ním rovnou sepsat — usnadní nám to vyřízení
        s dopravcem. Podmínkou to ale není: když poškození najdete až doma,
        napište nám a pošlete fotky, obal si prosím schovejte. Poškozené zboží
        vyměníme nebo vrátíme peníze a s dopravcem si to vyřešíme sami.
      </Note>

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

      <P small>
        O doručení vás bude dopravce informovat SMS nebo e-mailem. Pokud vás
        nezastihne, zásilku uloží k vyzvednutí.
      </P>

      {/* § 1830a OZ — tlačítko pro odstoupení i pro hosta bez účtu. */}
      {withdrawalUrl ? (
        <P small>
          Rozmysleli jste si to? Od kupní smlouvy můžete odstoupit bez udání
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
