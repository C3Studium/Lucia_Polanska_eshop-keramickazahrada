import { Column, Img, Row, Section, Text } from "@react-email/components"
import {
  brand,
  ButtonRow,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  Greeting,
  LedgerEnd,
  P,
  Signature,
} from "../components/email-ui"
import { googleReviewUrl } from "../../../lib/google-review-url"
import { storeLink } from "../../../lib/storefront-url"

interface OrderReviewEmailProps {
  customerName?: string;
  orderNumber?: string;
  productName?: string;
  productImage?: string;
  productLink?: string;
  /** Hodnocení produktu na webu (`…/products/<handle>#hodnoceni`). */
  reviewLink?: string;
  /** Recenze na Google — job ji dodá z env; prázdná = bez Googlu. */
  googleReviewLink?: string;
  orderLink?: string;
}

/**
 * Prosba o recenzi týden po převzetí (docs/sledovani-zasilek.md §6).
 *
 * Hlavní tlačítko vede na Google (GOOGLE_REVIEW_URL / GOOGLE_PLACE_ID —
 * otevře rovnou dialog pro napsání recenze), vedlejší na hodnocení produktu
 * na našem webu. Bez Googlu je hlavní tlačítko web a vedlejší „Zobrazit
 * objekt". Fotka i tlačítka se vykreslí jen s reálnými daty — job posílá
 * prázdné řetězce, když produkt nemá fotku či handle, a prázdný `src` se v
 * poště ukazuje jako rozbitý obrázek, prázdný `href` jako mrtvé tlačítko.
 */
function OrderReviewEmailComponent({
  customerName,
  orderNumber = "",
  productName = "váš kousek",
  productImage = "",
  productLink = "",
  reviewLink = "",
  googleReviewLink,
  orderLink = ""
}: OrderReviewEmailProps) {
  // Job předává odkaz z env; když ho šablona dostane bez něj (náhled), zkusí
  // env sama — obojí přes jeden helper, ať existuje jen jedna pravda.
  const googleUrl = googleReviewLink ?? googleReviewUrl() ?? ""
  const siteReviewUrl = reviewLink || productLink || ""
  const primaryUrl = googleUrl || siteReviewUrl || storeLink()
  const primaryLabel = googleUrl ? "Napsat recenzi na Google" : "Napsat recenzi"

  const secondary = googleUrl
    ? siteReviewUrl && siteReviewUrl !== primaryUrl
      ? { href: siteReviewUrl, label: "Ohodnotit na našem webu" }
      : null
    : productLink && productLink !== primaryUrl
      ? { href: productLink, label: "Zobrazit objekt" }
      : null

  return (
    <EmailLayout preview="Kousek z ateliéru je u vás už týden — jak se mu daří?">
      <Eyebrow>Vaše dojmy</Eyebrow>
      <EmailH1 accent="radost?">Dělá vám</EmailH1>

      <Greeting name={customerName} />
      <P>
        kousek z našeho ateliéru je u vás už týden. Rádi bychom věděli, jak se
        mu daří — vaše dojmy pomáhají nám i těm, kdo si objekty teprve
        vybírají.
      </P>

      <Section style={{ margin: "8px 0 0" }}>
        <Row style={{ borderTop: `1px solid ${brand.line}` }}>
          <Column
            style={{
              width: "68px",
              padding: "14px 14px 14px 0",
              verticalAlign: "top",
            }}
          >
            {productImage ? (
              <Img
                src={productImage}
                alt={productName}
                width="56"
                height="66"
                style={{
                  borderRadius: "10px",
                  objectFit: "cover",
                  backgroundColor: brand.stone,
                }}
              />
            ) : (
              <div
                style={{
                  width: "56px",
                  height: "66px",
                  borderRadius: "10px",
                  backgroundColor: brand.stone,
                }}
              />
            )}
          </Column>
          <Column style={{ padding: "14px 0", verticalAlign: "top" }}>
            <Text
              style={{
                fontFamily: brand.serif,
                fontSize: "17px",
                lineHeight: "22px",
                color: brand.ink,
                margin: 0,
              }}
            >
              {productName}
            </Text>
            <Text
              style={{
                fontFamily: brand.sans,
                fontSize: "12px",
                lineHeight: "18px",
                color: brand.muted,
                margin: "2px 0 0",
              }}
            >
              Objednávka {orderNumber}
            </Text>
          </Column>
        </Row>
        <LedgerEnd />
      </Section>

      {googleUrl ? (
        <P small>
          Pár slov na Googlu nám pomůže nejvíc — najdou nás podle nich další
          lidé, kterým by keramika z ateliéru udělala radost.
        </P>
      ) : null}

      <ButtonRow>
        {primaryUrl ? (
          <EmailButton href={primaryUrl}>{primaryLabel}</EmailButton>
        ) : null}
        {secondary ? (
          <>
            <span style={{ display: "inline-block", width: "12px" }} />
            <EmailButton href={secondary.href} variant="ghost">
              {secondary.label}
            </EmailButton>
          </>
        ) : null}
      </ButtonRow>

      <P small>
        Pokud kousek nesplnil vaše očekávání, napište nám — společně to
        vyřešíme.
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const OrderReviewEmail = (props: OrderReviewEmailProps) => (
  <OrderReviewEmailComponent {...props} />
)

// Mock data for preview/development
const mockOrderReview: OrderReviewEmailProps = {
  customerName: "Jan Novák",
  orderNumber: "#12345",
  productName: "Keramický hrnek - modrý",
  productImage: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
  productLink: "https://keramickazahrada.cz/products/hrnek-modry",
  reviewLink: "https://keramickazahrada.cz/products/hrnek-modry#hodnoceni",
  googleReviewLink: "https://search.google.com/local/writereview?placeid=ChIJexample",
  orderLink: "https://keramickazahrada.cz/orders/12345"
}

export default () => <OrderReviewEmailComponent {...mockOrderReview} />
