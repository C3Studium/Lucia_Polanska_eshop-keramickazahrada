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
import { storeLink } from "../../../lib/storefront-url"

interface OrderReviewEmailProps {
  customerName?: string;
  orderNumber?: string;
  productName?: string;
  productImage?: string;
  productLink?: string;
  reviewLink?: string;
  orderLink?: string;
}

/**
 * Fotka i tlačítka se vykreslí jen s reálnými daty — job posílá prázdné
 * řetězce, když produkt nemá fotku či handle, a prázdný `src` se v poště
 * ukazuje jako rozbitý obrázek, prázdný `href` jako mrtvé tlačítko.
 */
function OrderReviewEmailComponent({
  customerName,
  orderNumber = "",
  productName = "váš kousek",
  productImage = "",
  productLink = "",
  reviewLink = "",
  orderLink = ""
}: OrderReviewEmailProps) {
  const reviewUrl = reviewLink || productLink || storeLink()
  return (
    <EmailLayout preview="Jak se vám líbí váš nový kousek z ateliéru?">
      <Eyebrow>Vaše dojmy</Eyebrow>
      <EmailH1 accent="radost?">Dělá vám</EmailH1>

      <Greeting name={customerName} />
      <P>
        před časem k vám z našeho ateliéru putoval nový kousek. Rádi bychom
        věděli, jak se mu u vás daří — vaše dojmy pomáhají nám i těm, kdo si
        objekty teprve vybírají.
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

      <ButtonRow>
        {reviewUrl ? (
          <EmailButton href={reviewUrl}>Napsat recenzi</EmailButton>
        ) : null}
        {productLink && reviewUrl !== productLink ? (
          <>
            <span style={{ display: "inline-block", width: "12px" }} />
            <EmailButton href={productLink} variant="ghost">
              Zobrazit objekt
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
  reviewLink: "https://keramickazahrada.cz/reviews/write?product=hrnek-modry&order=12345",
  orderLink: "https://keramickazahrada.cz/orders/12345"
}

export default () => <OrderReviewEmailComponent {...mockOrderReview} />
