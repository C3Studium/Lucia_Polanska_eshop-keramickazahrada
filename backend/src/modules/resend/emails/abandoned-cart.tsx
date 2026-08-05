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

interface AbandonedCartEmailProps {
  customer?: {
    first_name?: string;
  };
  cart_id?: string;
  items?: Array<{
    thumbnail?: string;
    product_title?: string;
    quantity?: number;
    unit_price?: number;
  }>;
}

function AbandonedCartEmailComponent({
  customer,
  cart_id = "sample-cart-id",
  items = []
}: AbandonedCartEmailProps) {
  const storefrontUrl = process.env.MEDUSA_STOREFRONT_URL || "https://keramickazahrada.cz";

  const formatter = new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currencyDisplay: "narrowSymbol",
    currency: "CZK",
  })

  return (
    <EmailLayout preview="Váš košík na vás počká. Objekty v něm zůstávají odložené.">
      <Eyebrow>Váš košík</Eyebrow>
      <EmailH1 accent="počká.">Váš košík na vás</EmailH1>

      <Greeting name={customer?.first_name} />
      <P>
        při poslední návštěvě jste si do košíku odložili několik kousků z
        ateliéru. Nikam nespěchají — najdete je přesně tam, kde jste je
        nechali.
      </P>

      {/* Odložené objekty */}
      <Section style={{ margin: "28px 0 0" }}>
        <Eyebrow>Odložené objekty</Eyebrow>
        {items?.map((item, idx) => (
          <Row key={idx} style={{ borderTop: `1px solid ${brand.line}` }}>
            <Column
              style={{ width: "68px", padding: "14px 14px 14px 0", verticalAlign: "top" }}
            >
              {item.thumbnail ? (
                <Img
                  src={item.thumbnail}
                  alt={item.product_title ?? ""}
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
                  fontFamily: brand.sans,
                  fontSize: "10px",
                  lineHeight: "14px",
                  letterSpacing: "1.8px",
                  color: brand.faint,
                  margin: "0 0 4px",
                }}
              >
                {String(idx + 1).padStart(2, "0")}
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
                {item.product_title}
              </Text>
              {(item.quantity ?? 0) > 1 ? (
                <Text
                  style={{
                    fontFamily: brand.sans,
                    fontSize: "12px",
                    lineHeight: "18px",
                    color: brand.muted,
                    margin: "2px 0 0",
                  }}
                >
                  {item.quantity} ks
                </Text>
              ) : null}
            </Column>
            <Column
              align="right"
              style={{ padding: "14px 0", verticalAlign: "top", width: "110px" }}
            >
              <Text
                style={{
                  fontFamily: brand.serif,
                  fontSize: "16px",
                  lineHeight: "22px",
                  color: brand.ink,
                  margin: 0,
                }}
              >
                {formatter.format((item.unit_price || 0) / 100)}
              </Text>
            </Column>
          </Row>
        ))}
        <LedgerEnd />
      </Section>

      <ButtonRow>
        <EmailButton href={`${storefrontUrl}/cart/recover/${cart_id}`}>
          Vrátit se ke košíku
        </EmailButton>
      </ButtonRow>

      <P small>
        Pokud jste nákup dokončit nechtěli, tento e-mail můžete v klidu
        přehlédnout.
      </P>
      <Signature />
    </EmailLayout>
  );
}

export const abandonedCartEmail = (props: AbandonedCartEmailProps) => (
  <AbandonedCartEmailComponent {...props} />
);


// Mock data for preview/development
const mockCustomer = {
  first_name: "Jan"
};

const mockItems = [
  {
    thumbnail: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
    product_title: "Keramický hrnek",
    quantity: 2,
    unit_price: 25000 // 250 Kč
  },
  {
    thumbnail: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
    product_title: "Keramický talíř",
    quantity: 1,
    unit_price: 45000 // 450 Kč
  }
];

export default () => (
  <AbandonedCartEmailComponent
    customer={mockCustomer}
    cart_id="sample-cart-123"
    items={mockItems}
  />
);
