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

interface CommissionCompletedEmailProps {
  customerName?: string;
  orderNumber?: string;
  orderLink?: string;
  /** Plně zaplaceno? Pak se chystá k odeslání; jinak zbývá doplatit. */
  fullyPaid?: boolean;
  /** Kolik ještě zbývá doplatit (naformátované) — jen když fullyPaid=false. */
  balanceDue?: string | null;
  /** Nejnovější sdílená fotka hotového kousku, když ji ateliér přidal. */
  makingPhotoUrl?: string | null;
}

/**
 * „Vaše zakázka je hotová" — posílá se při dokončení výroby
 * (`made-to-order.production-completed`). Dva případy:
 *  - plně zaplaceno → zakázka se chystá k odeslání;
 *  - zbývá doplatit → zakázka je hotová a brzy přijde výzva k doplacení
 *    (samotný platební odkaz nese ruční výzva k doplatku, ne tento e-mail).
 */
function CommissionCompletedEmailComponent({
  customerName,
  orderNumber = "",
  orderLink = "",
  fullyPaid = true,
  balanceDue,
  makingPhotoUrl,
}: CommissionCompletedEmailProps) {
  const orderUrl = orderLink || storeLink()
  return (
    <EmailLayout preview={`Vaše zakázka ${orderNumber} je hotová.`}>
      <Eyebrow>Zakázková výroba</Eyebrow>
      <EmailH1 accent="je hotová.">Zakázka</EmailH1>

      <Greeting name={customerName} />
      <P>
        máme skvělou zprávu — vaše zakázka
        {orderNumber ? ` ${orderNumber}` : ""} je hotová. Každý kousek vznikal
        rukama, a tenhle je teď na světě.
      </P>

      {makingPhotoUrl ? (
        <Section style={{ margin: "20px 0 0" }}>
          <Img
            src={makingPhotoUrl}
            alt="Hotový kousek"
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

      {fullyPaid ? (
        <>
          <Note tone="olive">Zakázka je hotová — chystáme ji k odeslání.</Note>
          <P style={{ margin: "20px 0 0" }}>
            Teď ji pečlivě zabalíme a pošleme. Jakmile zásilka vyrazí, dáme vám
            vědět.
          </P>
        </>
      ) : (
        <>
          {balanceDue ? (
            <>
              <LedgerRow label="Zbývá doplatit" value={balanceDue} strong tone="olive" />
              <LedgerEnd />
            </>
          ) : null}
          <P>
            Zbývá doplatit zbytek ceny — výzvu k platbě s odkazem vám pošleme
            zvlášť. Jakmile bude doplatek zaplacený, zakázku zabalíme a odešleme.
          </P>
        </>
      )}

      {orderUrl ? (
        <ButtonRow>
          <EmailButton href={orderUrl}>Zobrazit objednávku</EmailButton>
        </ButtonRow>
      ) : null}

      <Signature />
    </EmailLayout>
  )
}

export const CommissionCompletedEmail = (
  props: CommissionCompletedEmailProps
) => <CommissionCompletedEmailComponent {...props} />

// Mock data for preview/development
const mockCommissionCompleted: CommissionCompletedEmailProps = {
  customerName: "Jana Nováková",
  orderNumber: "#0026",
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed",
  fullyPaid: false,
  balanceDue: "2 795 Kč",
  makingPhotoUrl:
    "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
}

export default () => (
  <CommissionCompletedEmailComponent {...mockCommissionCompleted} />
)
