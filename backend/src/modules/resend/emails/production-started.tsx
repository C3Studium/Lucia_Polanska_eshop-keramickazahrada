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

interface ProductionStartedEmailProps {
  customerName?: string;
  orderNumber?: string;
  orderLink?: string;
  /** Název objednaného výrobku (bez balného). */
  productTitle?: string | null;
  /** Obrázek objednaného produktu (ne fotka od zákazníka). */
  productImageUrl?: string | null;
  /** „20. 10. 2026 v 14:32" — pražský čas odeslání; od něj platí Z5. */
  startedAtText?: string;
  /** Smluvní záloha, naformátovaná („1 250 Kč"). */
  depositAmount?: string;
  /** Smluvní záloha v procentech („25"). */
  depositPercentage?: string | null;
  /** Termín, nebo „do N dnů od zahájení výroby (nejpozději …)". */
  estimatedCompletion?: string | null;
}

/**
 * „Zakázka je ve výrobě" (LEGAL_AUDIT.md § 0, Z3) — posílá se SYNCHRONNĚ při
 * „Začít výrobu" (lib/made-to-order/start-production). Zahájení výroby platí
 * od tohoto e-mailu, proto nese datum a čas, a větu Z5 o nevratné záloze —
 * sankce nesmí být schovaná jen v obchodních podmínkách (§ 1753 OZ, Z10).
 * Lhůta dokončení běží od zahájení (Z9).
 */
function ProductionStartedEmailComponent({
  customerName,
  orderNumber = "",
  orderLink = "",
  productTitle,
  productImageUrl,
  startedAtText = "",
  depositAmount = "",
  depositPercentage,
  estimatedCompletion,
}: ProductionStartedEmailProps) {
  const orderUrl = orderLink || storeLink()
  const depositText = depositPercentage
    ? `${depositAmount} (${depositPercentage} %)`
    : depositAmount
  return (
    <EmailLayout
      preview={`Zakázka ${orderNumber} je ve výrobě — právě jsem se pustila do práce.`}
    >
      <Eyebrow>Zakázka</Eyebrow>
      <EmailH1 accent="ve výrobě.">Zakázka je</EmailH1>

      <Greeting name={customerName} />
      <P>
        právě jsem se pustila do výroby vaší zakázky {orderNumber}
        {productTitle ? ` — ${productTitle}` : ""}. Každý kousek u mě vzniká
        rukama: modelování, sušení, výpal i glazura si žádají svůj čas, tak
        prosím o trpělivost.
      </P>

      {productImageUrl ? (
        <Section style={{ margin: "20px 0 0" }}>
          <Img
            src={productImageUrl}
            alt={productTitle ?? "Zakázka"}
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

      {orderNumber ? <LedgerRow label="Objednávka" value={orderNumber} strong /> : null}
      {productTitle ? <LedgerRow label="Výrobek" value={productTitle} /> : null}
      {startedAtText ? (
        <LedgerRow label="Výroba zahájena" value={startedAtText} tone="olive" />
      ) : null}
      {estimatedCompletion ? (
        <LedgerRow label="Předpokládané dokončení" value={estimatedCompletion} />
      ) : null}
      {depositAmount ? <LedgerRow label="Záloha" value={depositText} /> : null}
      <LedgerEnd />

      <Note tone="clay">
        Od této chvíle — od odeslání tohoto e-mailu — se při zrušení zakázky
        záloha {depositText} nevrací. Všechno, co jste zaplatili nad zálohu,
        vám vrátím do 14 dnů.
      </Note>

      <P>
        Tak to stojí v obchodních podmínkách (článek Výroba na zakázku), se
        kterými jste při objednávce souhlasili: záloha kryje materiál, návrh a
        čas, který už jsem do vašeho kousku vložila. Doplatek po vás při
        zrušení chtít nebudu.
      </P>

      <P>
        Jakmile bude hotovo, napíšu vám a domluvíme se na odeslání nebo
        předání. Kdybyste mezitím cokoli potřebovali, napište mi na info@keramickazahrada.cz — odpovídám sama.
      </P>

      {orderUrl ? (
        <ButtonRow>
          <EmailButton href={orderUrl}>Zobrazit objednávku</EmailButton>
        </ButtonRow>
      ) : null}

      <Signature closing="Děkuji a těším se," />
    </EmailLayout>
  )
}

export const ProductionStartedEmail = (props: ProductionStartedEmailProps) => (
  <ProductionStartedEmailComponent {...props} />
)

// Mock data for preview/development
const mockProductionStarted: ProductionStartedEmailProps = {
  customerName: "Jana Nováková",
  orderNumber: "#0042",
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed",
  productTitle: "Domovní číslo s motivem levandule",
  startedAtText: "20. 10. 2026 v 14:32",
  depositAmount: "1 250 Kč",
  depositPercentage: "25",
  estimatedCompletion: "do 42 dnů od zahájení výroby (nejpozději 1. 12. 2026)",
}

export default () => <ProductionStartedEmailComponent {...mockProductionStarted} />
