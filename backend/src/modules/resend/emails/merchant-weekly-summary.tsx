import { Column, Row, Section, Text } from "@react-email/components"
import {
  brand,
  ButtonRow,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  LedgerEnd,
  LedgerRow,
  Note,
  P,
} from "../components/email-ui"

/**
 * Pondělní týdenní souhrn pro majitelku (doplněk denního digestu z §15/D7).
 *
 * Denní souhrn je provozní; tenhle je bilanční — jak se minulému týdnu dařilo
 * proti předminulému a co šlo nejvíc na odbyt. Interní e-mail: bez oslovení
 * a bez podpisu, stejně jako merchant-daily-summary.
 */

type TopProduct = {
  title: string
  quantity: number
}

type MerchantWeeklySummaryProps = {
  /** Např. „7. 7. – 13. 7. 2026". */
  date_range?: string
  revenue?: string
  revenue_prev?: string
  paid_orders?: number
  paid_orders_prev?: number
  top_products?: TopProduct[]
  admin_url?: string
}

function MerchantWeeklySummaryComponent({
  date_range = "",
  revenue = "0 Kč",
  revenue_prev = "0 Kč",
  paid_orders = 0,
  paid_orders_prev = 0,
  top_products = [],
  admin_url = "",
}: MerchantWeeklySummaryProps) {
  const adminHref = admin_url
    ? `${admin_url.replace(/\/+$/, "")}/app/prehled`
    : ""

  return (
    <EmailLayout preview={`Týdenní souhrn: ${revenue}, ${paid_orders} zaplacených objednávek.`}>
      <Eyebrow>{date_range ? `Týdenní souhrn · ${date_range}` : "Týdenní souhrn"}</Eyebrow>
      <EmailH1 accent="v číslech.">Minulý týden</EmailH1>

      <LedgerRow label="Tržba" value={revenue} strong tone="olive" />
      <LedgerRow label="Předchozí týden" value={revenue_prev} />
      <LedgerRow label="Zaplacené objednávky" value={String(paid_orders)} />
      <LedgerRow
        label="Objednávky předchozí týden"
        value={String(paid_orders_prev)}
      />
      <LedgerEnd />

      {top_products.length ? (
        <Section style={{ margin: "32px 0 0" }}>
          <Eyebrow>Nejžádanější objekty</Eyebrow>
          {top_products.map((product, i) => (
            <Row
              key={`${product.title}-${i}`}
              style={{ borderTop: `1px solid ${brand.line}` }}
            >
              <Column style={{ width: "36px", padding: "11px 0", verticalAlign: "top" }}>
                <Text
                  style={{
                    fontFamily: brand.sans,
                    fontSize: "10px",
                    lineHeight: "20px",
                    letterSpacing: "1.8px",
                    color: brand.faint,
                    margin: 0,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </Text>
              </Column>
              <Column style={{ padding: "11px 0", verticalAlign: "top" }}>
                <Text
                  style={{
                    fontFamily: brand.serif,
                    fontSize: "16px",
                    lineHeight: "22px",
                    color: brand.ink,
                    margin: 0,
                  }}
                >
                  {product.title}
                </Text>
              </Column>
              <Column
                align="right"
                style={{ padding: "11px 0", verticalAlign: "top", width: "70px" }}
              >
                <Text
                  style={{
                    fontFamily: brand.sans,
                    fontSize: "14px",
                    lineHeight: "22px",
                    color: brand.muted,
                    margin: 0,
                  }}
                >
                  {product.quantity} ks
                </Text>
              </Column>
            </Row>
          ))}
          <LedgerEnd />
        </Section>
      ) : (
        <Note tone="olive">Minulý týden se nic neprodalo — pec má volno.</Note>
      )}

      {adminHref ? (
        <ButtonRow>
          <EmailButton href={adminHref}>Otevřít přehled</EmailButton>
        </ButtonRow>
      ) : null}

      <P small>Tento souhrn chodí každé pondělí ráno automaticky.</P>
    </EmailLayout>
  )
}

export const merchantWeeklySummaryEmail = (props: MerchantWeeklySummaryProps) => (
  <MerchantWeeklySummaryComponent {...(props as MerchantWeeklySummaryProps)} />
)

// Mock data for preview/development
const mockWeeklySummary: MerchantWeeklySummaryProps = {
  date_range: "7. 7. – 13. 7. 2026",
  revenue: "18 340 Kč",
  revenue_prev: "12 890 Kč",
  paid_orders: 9,
  paid_orders_prev: 6,
  top_products: [
    { title: "Zahradní mísa z pálené hlíny", quantity: 4 },
    { title: "Keramický hrnek", quantity: 3 },
    { title: "Váza s engobou", quantity: 2 },
  ],
  admin_url: "https://example.com",
}

export default () => <MerchantWeeklySummaryComponent {...mockWeeklySummary} />
