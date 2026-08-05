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
  Note,
  P,
  Signature,
} from "../components/email-ui"

interface RestockEmailProps {
  variant?: {
    product_variant?: {
      id?: string;
      title?: string;
      description?: string;
      images?: Array<{ url: string }>;
    };
  };
}

function RestockEmailComponent({
  variant
}: RestockEmailProps) {
  const images = variant?.product_variant?.images || [];
  const storefrontUrl = process.env.MEDUSA_STOREFRONT_URL || "https://keramickazahrada.cz";
  const title = variant?.product_variant?.title;
  const description = variant?.product_variant?.description;

  return (
    <EmailLayout preview="Objekt, který jste sledovali, je zpět skladem.">
      <Eyebrow>Znovu skladem</Eyebrow>
      <EmailH1 accent="skladem.">Objekt je zpět</EmailH1>

      <Greeting />
      <P>
        objekt, který jste si uložili mezi oblíbené, se vrátil na polici.
        Rádi vám ho znovu představujeme.
      </P>

      {/* Objekt — řádek podle vzoru objednávky */}
      <Section style={{ margin: "28px 0 0" }}>
        <Row style={{ borderTop: `1px solid ${brand.line}` }}>
          <Column
            style={{ width: "68px", padding: "14px 14px 14px 0", verticalAlign: "top" }}
          >
            {images.length > 0 ? (
              <Img
                src={images[0].url}
                alt={title ?? ""}
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
              {title}
            </Text>
            {description ? (
              <Text
                style={{
                  fontFamily: brand.sans,
                  fontSize: "12px",
                  lineHeight: "18px",
                  color: brand.muted,
                  margin: "2px 0 0",
                }}
              >
                {description}
              </Text>
            ) : null}
          </Column>
        </Row>
        <LedgerEnd />
      </Section>

      <Note tone="olive">Objekt je nyní dostupný k objednání.</Note>

      <ButtonRow>
        <EmailButton href={`${storefrontUrl}/products/${variant?.product_variant?.id}`}>
          Zobrazit objekt
        </EmailButton>
      </ButtonRow>

      <P small>
        Tento e-mail vám posíláme, protože jste si objekt uložili mezi
        oblíbené.
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const variantRestockEmail = (props: RestockEmailProps) => (
  <RestockEmailComponent {...props} />
)

// Mock data for preview/development
const mockVariant = {
  product_variant: {
    id: "variant-123",
    title: "Keramický hrnek - modrý",
    description: "Ručně malovaný keramický hrnek v krásné modré barvě. Ideální pro ranní kávu nebo čaj.",
    images: [
      { url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png" }
    ]
  }
}

export default () => <RestockEmailComponent variant={mockVariant} />
