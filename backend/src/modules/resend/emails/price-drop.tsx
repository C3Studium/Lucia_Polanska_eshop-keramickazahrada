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

interface PriceDropEmailProps {
  customerName?: string;
  productName?: string;
  productImage?: string;
  originalPrice?: string;
  newPrice?: string;
  discountPercentage?: string;
  productLink?: string;
  timeLimited?: boolean;
  expiryDate?: string;
}

function PriceDropEmailComponent({
  customerName = "Vážený zákazník",
  productName = "Keramický hrnek - modrý",
  productImage,
  originalPrice = "450 Kč",
  newPrice = "360 Kč",
  productLink = "https://keramickazahrada.cz/products/hrnek-modry",
  timeLimited = true,
  expiryDate = "31. října 2025"
}: PriceDropEmailProps) {
  return (
    <EmailLayout preview={`${productName} je nyní k mání za ${newPrice}.`}>
      <Eyebrow>Změna ceny</Eyebrow>
      <EmailH1 accent="cenu.">Objekt změnil</EmailH1>

      <Greeting name={customerName} />
      <P>
        objekt, který vás zaujal, je nyní k mání za nižší cenu. Nikam
        nespěcháme — jen jsme mysleli, že byste to rádi věděli.
      </P>

      <Section style={{ margin: "28px 0 0" }}>
        <Row style={{ borderTop: `1px solid ${brand.line}` }}>
          <Column
            style={{ width: "68px", padding: "14px 14px 14px 0", verticalAlign: "top" }}
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
              Objekt z ateliéru
            </Text>
          </Column>
          <Column
            align="right"
            style={{ padding: "14px 0", verticalAlign: "top", width: "110px" }}
          >
            <Text
              style={{
                fontFamily: brand.sans,
                fontSize: "13px",
                lineHeight: "18px",
                color: brand.clay,
                textDecoration: "line-through",
                margin: "0 0 2px",
              }}
            >
              {originalPrice}
            </Text>
            <Text
              style={{
                fontFamily: brand.serif,
                fontSize: "17px",
                lineHeight: "22px",
                color: brand.ink,
                margin: 0,
              }}
            >
              {newPrice}
            </Text>
          </Column>
        </Row>
        <LedgerEnd />
      </Section>

      {timeLimited ? (
        <Note tone="olive">Tato cena platí do {expiryDate}.</Note>
      ) : null}

      <ButtonRow>
        <EmailButton href={productLink}>Zobrazit objekt</EmailButton>
      </ButtonRow>

      <P small>
        Tuto zprávu dostáváte, protože jste si objekt prohlíželi nebo
        uložili mezi oblíbené. Podobná upozornění lze kdykoli vypnout
        v nastavení účtu.
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const PriceDropEmail = (props: PriceDropEmailProps) => (
  <PriceDropEmailComponent {...props} />
)

// Mock data for preview/development
const mockPriceDrop: PriceDropEmailProps = {
  customerName: "Jan Novák",
  productName: "Keramický hrnek - modrý",
  productImage: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
  originalPrice: "450 Kč",
  newPrice: "360 Kč",
  discountPercentage: "20%",
  productLink: "https://keramickazahrada.cz/products/hrnek-modry",
  timeLimited: true,
  expiryDate: "31. října 2025"
}

export default () => <PriceDropEmailComponent {...mockPriceDrop} />
