import { Img, Section } from "@react-email/components"
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

interface CommissionConfirmedEmailProps {
  customerName?: string;
  orderNumber?: string;
  orderLink?: string;
  /** Co se vyrábí (název položky zakázky). */
  productTitle?: string | null;
  /** Náhled objednaného produktu. */
  productImageUrl?: string | null;
  /** Domluvená cena zakázky vč. příplatku (naformátovaná). */
  totalPrice?: string | null;
  /** Kolik už je zaplaceno (záloha). */
  depositPaid?: string | null;
  /** Kolik zbývá doplatit po dokončení. */
  balanceDue?: string | null;
  /** Předpokládané dokončení („5. 11. 2026"), když ho ateliér zadal. */
  estimatedCompletion?: string | null;
}

/**
 * „Zadání potvrzeno" — potvrzení zadání zakázky (`confirm_specification`).
 *
 * Dřív se při potvrzení zadání posílalo „Výroba začíná" (order-processing),
 * i když se výroba ještě nerozběhla — a při „Začít výrobu" pak nepřišlo nic
 * (14. 10. 2026). Teď: potvrzení zadání = tenhle e-mail (co je domluvené,
 * kolik je zaplaceno a kolik zbude), začátek výroby = order-processing,
 * dokončení = commission-completed.
 */
function CommissionConfirmedEmailComponent({
  customerName,
  orderNumber = "",
  orderLink = "",
  productTitle,
  productImageUrl,
  totalPrice,
  depositPaid,
  balanceDue,
  estimatedCompletion,
}: CommissionConfirmedEmailProps) {
  const orderUrl = orderLink || storeLink()
  return (
    <EmailLayout preview={`Zadání vaší zakázky ${orderNumber} je potvrzené.`}>
      <Eyebrow>Zakázková výroba</Eyebrow>
      <EmailH1 accent="potvrzené.">Zadání je</EmailH1>

      <Greeting name={customerName} />
      <P>
        prošla jsem si vaše zadání{orderNumber ? ` k objednávce ${orderNumber}` : ""} a
        všechno je jasné — zakázku potvrzuji. Jakmile se pustím do výroby, dám
        vám vědět.
      </P>

      {productImageUrl ? (
        <Section style={{ margin: "20px 0 0" }}>
          <Img
            src={productImageUrl}
            alt={productTitle ?? "Vaše zakázka"}
            width="100%"
            style={{
              maxWidth: "420px",
              borderRadius: "12px",
              objectFit: "cover",
              backgroundColor: brand.stone,
            }}
          />
        </Section>
      ) : null}

      {productTitle ? <LedgerRow label="Zakázka" value={productTitle} /> : null}
      {totalPrice ? <LedgerRow label="Domluvená cena" value={totalPrice} /> : null}
      {depositPaid ? <LedgerRow label="Zaplaceno zálohou" value={depositPaid} /> : null}
      {balanceDue ? (
        <LedgerRow label="Doplatíte po dokončení" value={balanceDue} strong tone="olive" />
      ) : null}
      {estimatedCompletion ? (
        <LedgerRow label="Předpokládané dokončení" value={estimatedCompletion} />
      ) : null}
      {productTitle || totalPrice || depositPaid || balanceDue || estimatedCompletion ? (
        <LedgerEnd />
      ) : null}

      <Note tone="olive">
        {balanceDue
          ? "Doplatek zaplatíte až po dokončení — výzvu s odkazem vám pošlu."
          : "Zakázka je zaplacená, nic dalšího po vás nechci."}
      </Note>

      {orderUrl ? (
        <ButtonRow>
          <EmailButton href={orderUrl}>Zobrazit objednávku</EmailButton>
        </ButtonRow>
      ) : null}

      <Signature />
    </EmailLayout>
  )
}

export const CommissionConfirmedEmail = (props: CommissionConfirmedEmailProps) => (
  <CommissionConfirmedEmailComponent {...props} />
)

// Mock data for preview/development
const mockCommissionConfirmed: CommissionConfirmedEmailProps = {
  customerName: "Jana Nováková",
  orderNumber: "#0050",
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed",
  productTitle: "Keramická plastika — Pán lesa Dub",
  productImageUrl:
    "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
  totalPrice: "4 500 Kč",
  depositPaid: "1 125 Kč",
  balanceDue: "3 375 Kč",
  estimatedCompletion: "5. 11. 2026",
}

export default () => <CommissionConfirmedEmailComponent {...mockCommissionConfirmed} />
