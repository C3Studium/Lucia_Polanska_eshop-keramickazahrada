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
  P,
  Signature,
} from "../components/email-ui"

interface PromotionalEmailProps {
  customerName?: string;
  discountCode?: string;
  discountPercentage?: string;
  expiryDate?: string;
  productLink?: string;
  unsubscribeLink?: string;
}

function PromotionalEmailComponent({
  customerName = "Vážený zákazník",
  discountCode = "KERAMIKA20",
  discountPercentage = "20%",
  expiryDate = "31. prosince 2024",
  productLink = "https://keramickazahrada.cz/products",
  unsubscribeLink = "https://keramickazahrada.cz/unsubscribe"
}: PromotionalEmailProps) {
  return (
    <EmailLayout preview={`Objekty z ateliéru za příznivější cenu — s kódem ${discountCode}.`}>
      <Eyebrow>Z ateliéru</Eyebrow>
      <EmailH1 accent="příznivější cenu.">Objekty za</EmailH1>

      <Greeting name={customerName} />
      <P>
        na objekty z ateliéru teď platí příznivější cena. Pokud jste
        některý kus delší dobu zvažovali, možná je vhodná chvíle se
        k němu vrátit.
      </P>

      <LedgerRow label="Kód" value={discountCode} strong />
      <LedgerRow label="Zvýhodnění" value={discountPercentage} />
      <LedgerRow label="Platí do" value={expiryDate} />
      <LedgerEnd />

      <P style={{ margin: "24px 0 16px" }}>
        Kód stačí zadat při objednávce. Platí na objekty, které jsou
        právě skladem.
      </P>

      <ButtonRow>
        <EmailButton href={productLink}>Prohlédnout objekty</EmailButton>
      </ButtonRow>

      <P small>
        Tuto zprávu dostáváte jako odběratel novinek ateliéru. Odhlásit se
        můžete{" "}
        <Link
          href={unsubscribeLink}
          style={{ color: brand.ink, textDecoration: "underline" }}
        >
          zde
        </Link>
        .
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const PromotionalEmail = (props: PromotionalEmailProps) => (
  <PromotionalEmailComponent {...props} />
)

// Mock data for preview/development
const mockPromotional: PromotionalEmailProps = {
  customerName: "Jan Novák",
  discountCode: "KERAMIKA20",
  discountPercentage: "20%",
  expiryDate: "31. prosince 2024",
  productLink: "https://keramickazahrada.cz/products",
  unsubscribeLink: "https://keramickazahrada.cz/unsubscribe"
}

export default () => <PromotionalEmailComponent {...mockPromotional} />
