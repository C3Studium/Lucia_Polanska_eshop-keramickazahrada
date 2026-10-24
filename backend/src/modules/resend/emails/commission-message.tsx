import { Img, Section } from "@react-email/components"
import {
  brand,
  ButtonRow,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  Greeting,
  Note,
  P,
  Signature,
} from "../components/email-ui"

interface CommissionMessageEmailProps {
  customerName?: string;
  orderNumber?: string;
  orderLink?: string;
  /** Text zprávy od ateliéru (může být prázdný, když je to jen fotka). */
  message?: string;
  /** Přiložená fotka (URL), když ji ateliér poslal. */
  photoUrl?: string;
  /** Název položky zakázky — u objednávky s víc zakázkami říká, ke které zpráva patří. */
  productTitle?: string | null;
}

/**
 * „Nová zpráva k vaší zakázce" — když majitelka v deníku zakázky přidá zápis
 * viditelný zákazníkovi (fotka z výroby, dotaz, update). Je to polovina chatu:
 * zákazník odpoví na své stránce objednávky, kde celé vlákno vidí.
 */
function CommissionMessageEmailComponent({
  customerName,
  orderNumber = "",
  orderLink = "",
  message,
  photoUrl,
  productTitle,
}: CommissionMessageEmailProps) {
  return (
    <EmailLayout preview={`Píšu vám z dílny k zakázce ${orderNumber}.`}>
      <Eyebrow>Zakázka</Eyebrow>
      <EmailH1 accent="k vaší zakázce.">Zpráva z dílny</EmailH1>

      <Greeting name={customerName} />
      <P>
        píšu vám k vaší zakázce
        {orderNumber ? ` ${orderNumber}` : ""}
        {productTitle ? ` (${productTitle})` : ""}:
      </P>

      {message && message.trim() ? (
        <Note tone="olive">{message}</Note>
      ) : (
        <P>Posílám fotku z výroby — podívejte se, jak to zatím vypadá.</P>
      )}

      {photoUrl ? (
        <Section style={{ margin: "20px 0 0" }}>
          <Img
            src={photoUrl}
            alt="Fotka z výroby"
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

      <P style={{ margin: "20px 0 0" }}>
        Odpovědět mi můžete přímo u své objednávky — napište mi tam, nebo
        přiložte vlastní fotku. Celé naše vlákno tam uvidíte pohromadě.
      </P>

      {orderLink ? (
        <ButtonRow>
          <EmailButton href={orderLink}>Odpovědět Lucii</EmailButton>
        </ButtonRow>
      ) : null}
      <Signature />
    </EmailLayout>
  )
}

export const CommissionMessageEmail = (props: CommissionMessageEmailProps) => (
  <CommissionMessageEmailComponent {...props} />
)

// Mock data for preview/development
const mockCommissionMessage: CommissionMessageEmailProps = {
  customerName: "Jana Nováková",
  orderNumber: "#0026",
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed",
  message:
    "Pán lesa Dub je po prvním výpalu — posílám fotku, jak vypadá. Teď přijde glazura v odstínu, co jste si přála.",
  photoUrl:
    "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
}

export default () => (
  <CommissionMessageEmailComponent {...mockCommissionMessage} />
)
