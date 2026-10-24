import { Link } from "@react-email/components"
import {
  brand,
  ButtonRow,
  CONTACT_EMAIL,
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

interface OrderDelayedEmailProps {
  customerName?: string;
  orderNumber?: string;
  originalDeliveryDate?: string;
  newDeliveryDate?: string;
  delayReason?: string;
  compensationOffer?: string;
  trackingLink?: string;
  orderLink?: string;
  supportEmail?: string;
  /** Výrobky, které se dodělávají a kvůli kterým se objednávka zdrží („Hrnek · 2 ks"). */
  delayedItems?: string[];
  /** Zdrží se celá objednávka (všechny výrobky), ne jen část. */
  wholeOrder?: boolean;
  /** Zpoždění zakázky (smluvní termín výroby) — „zakázka", ne „objednávka". */
  isCommission?: boolean;
}

/**
 * Původní termín, kompenzace a sledovací odkaz se vykreslí jen s reálnými
 * daty — výchozí hodnota, která slibuje kupón nebo termín, jenž nikdy nebyl
 * domluvený, by byla slibem, který nikdo nedal.
 */
function OrderDelayedEmailComponent({
  customerName,
  orderNumber = "",
  originalDeliveryDate,
  newDeliveryDate = "co nevidět",
  delayReason,
  compensationOffer,
  trackingLink,
  orderLink = "",
  supportEmail = CONTACT_EMAIL,
  delayedItems,
  wholeOrder = false,
  isCommission = false,
}: OrderDelayedEmailProps) {
  const orderUrl = orderLink || storeLink()
  const noun = isCommission ? "zakázka" : "objednávka"
  const Noun = isCommission ? "Zakázka" : "Objednávka"
  const items = delayedItems ?? []
  return (
    <EmailLayout
      preview={`${Noun} ${orderNumber} se zdrží — omlouvám se a děkuji za trpělivost.`}
    >
      <Eyebrow>
        {Noun} {orderNumber}
      </Eyebrow>
      <EmailH1 accent={`${noun} se zdrží.`}>Omlouvám se,</EmailH1>

      <Greeting name={customerName} />
      <P>
        omlouvám se — vaše {noun} {orderNumber} se zdrží. Ruční výroba má svůj
        rytmus a tentokrát si vyžádala víc času, než jsem počítala. Nový termín
        najdete níže; kdyby vám nevyhovoval, napište mi a domluvíme se, co dál.
      </P>

      {items.length && !isCommission ? (
        <>
          <P>
            {items.length === 1
              ? "Ještě dodělávám tenhle kousek:"
              : "Ještě dodělávám tyhle kousky:"}
          </P>
          <ul style={{ margin: "0 0 16px", paddingLeft: "20px", color: brand.body, fontFamily: brand.sans, fontSize: "15px", lineHeight: "24px" }}>
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {!wholeOrder ? (
            <P>
              Objednávku vám pošlu celou, jakmile{" "}
              {items.length === 1 ? "bude hotový" : "budou hotové"}. Kdybyste
              chtěli zbytek poslat dřív, napište mi.
            </P>
          ) : null}
        </>
      ) : null}

      {orderNumber ? <LedgerRow label={Noun} value={orderNumber} /> : null}
      {isCommission && items.length ? <LedgerRow label="Výrobek" value={items.join(", ")} /> : null}
      {originalDeliveryDate ? (
        <LedgerRow label="Původní termín" value={originalDeliveryDate} />
      ) : null}
      <LedgerRow label="Nový termín" value={newDeliveryDate} strong />
      {delayReason ? <LedgerRow label="Důvod" value={delayReason} /> : null}
      <LedgerEnd />

      <Note tone="clay">Raději pořádně než rychle — děkuji, že mi dáte ten čas.</Note>

      {compensationOffer ? (
        <P>
          Jako poděkování za trpělivost jsem pro vás připravila:{" "}
          {compensationOffer}.
        </P>
      ) : null}

      <ButtonRow>
        {trackingLink ? (
          <>
            <EmailButton href={trackingLink}>Sledovat objednávku</EmailButton>
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
        Kdybyste chtěli cokoli vědět, napište mi na{" "}
        <Link
          href={`mailto:${supportEmail}`}
          style={{ color: brand.ink, textDecoration: "underline" }}
        >
          {supportEmail}
        </Link>
        .
      </P>
      <Signature closing="Děkuji za trpělivost," />
    </EmailLayout>
  )
}

export const OrderDelayedEmail = (props: OrderDelayedEmailProps) => (
  <OrderDelayedEmailComponent {...props} />
)

// Mock data for preview/development
const mockOrderDelayed: OrderDelayedEmailProps = {
  customerName: "Marie Svobodová",
  orderNumber: "#12345",
  originalDeliveryDate: "15. 10. 2026",
  newDeliveryDate: "22. 10. 2026",
  delayReason: "Ruční výroba si vyžádala více času",
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed",
  supportEmail: "info@keramickazahrada.cz",
  delayedItems: ["Pítko pro ptáky — List velký 44 cm", "Vlčí mák červeno oranžový · 3 ks"],
  wholeOrder: false,
}

export default () => <OrderDelayedEmailComponent {...mockOrderDelayed} />
