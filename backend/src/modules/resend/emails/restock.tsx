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
import { storeLink } from "../../../lib/storefront-url"

/**
 * Ploché props naplněné v send-restock-notification stepu. Dříve šablona
 * hledala `variant.product_variant.images` — nic z toho na variantě
 * neexistuje, takže e-mail odcházel beze jména, bez fotky a s odkazem
 * na /products/{variant_id}, který storefront neumí (routuje handle).
 */
interface RestockEmailProps {
  product_title?: string;
  variant_title?: string;
  description?: string;
  thumbnail?: string;
  product_url?: string;
}

function RestockEmailComponent({
  product_title,
  variant_title,
  description,
  thumbnail,
  product_url,
}: RestockEmailProps) {

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
            {thumbnail ? (
              <Img
                src={thumbnail}
                alt={product_title ?? ""}
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
              {product_title}
              {variant_title ? ` — ${variant_title}` : ""}
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
        <EmailButton href={product_url || storeLink()}>
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
const mockRestock: RestockEmailProps = {
  product_title: "Keramický hrnek",
  variant_title: "modrý",
  description:
    "Ručně malovaný keramický hrnek v krásné modré barvě. Ideální pro ranní kávu nebo čaj.",
  thumbnail:
    "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
  product_url: "https://keramickazahrada.cz/products/keramicky-hrnek",
}

export default () => <RestockEmailComponent {...mockRestock} />
