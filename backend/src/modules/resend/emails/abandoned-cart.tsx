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
  OptOutLine,
  P,
  Signature,
} from "../components/email-ui"
import { cartRecoverLink } from "../../../lib/storefront-url"

interface AbandonedCartEmailProps {
  customer?: {
    first_name?: string;
  };
  cart_id?: string;
  /** The cart's own currency — CZK when the caller predates the field. */
  currency_code?: string;
  items?: Array<{
    thumbnail?: string;
    product_title?: string;
    quantity?: number;
    unit_price?: number;
  }>;
  /**
   * Odmítnutí dalších připomenutí jedním kliknutím (`lib/email-optout-link.ts`,
   * § 7 odst. 3 zák. 480/2004 Sb.). Bez něj se řádek nevykreslí.
   */
  unsubscribe_url?: string | null;
}

function AbandonedCartEmailComponent({
  customer,
  cart_id = "sample-cart-id",
  currency_code = "CZK",
  items = [],
  unsubscribe_url = null
}: AbandonedCartEmailProps) {

  const formatter = new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currencyDisplay: "narrowSymbol",
    currency: (currency_code || "CZK").toUpperCase(),
  })

  return (
    <EmailLayout preview="Zapomněli jste na něco? Košík mám pro vás schovaný — dokončit ho můžete jedním kliknutím.">
      <Eyebrow>Váš košík</Eyebrow>
      <EmailH1 accent="na něco?">Zapomněli jste</EmailH1>

      <Greeting name={customer?.first_name} />
      <P>
        při poslední návštěvě vám v košíku zůstalo pár kousků z mé dílny.
        Nechala jsem vám ho tak, jak jste ho opustili — stačí objednávku
        dokončit a já se o zabalení postarám.
      </P>

      {/* Co je v košíku */}
      <Section style={{ margin: "28px 0 0" }}>
        <Eyebrow>V košíku</Eyebrow>
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
                {/* Medusa v2 prices are major units — the old `/ 100` showed
                    a 450Kč plate as 4,50 Kč. */}
                {formatter.format(item.unit_price || 0)}
              </Text>
            </Column>
          </Row>
        ))}
        <LedgerEnd />
      </Section>

      <ButtonRow>
        <EmailButton href={cartRecoverLink(cart_id)}>
          Dokončit objednávku
        </EmailButton>
      </ButtonRow>

      <P>
        Každý kousek vzniká u mě v dílně ručně, a tak žádný není úplně stejný
        jako ten na fotce — to je na ruční práci to hezké. Nikam vás netlačím;
        jen vám chci říct, že u zboží skladem předám balíček dopravci do
        3 pracovních dnů od objednání.
      </P>

      <P small>
        Kdyby vás cokoli zarazilo, třeba u dopravy nebo platby, napište mi na info@keramickazahrada.cz — odpovídám sama.
      </P>
      <Signature />
      <OptOutLine url={unsubscribe_url} />
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
    unit_price: 250 // 250 Kč — major units, like the real cart items
  },
  {
    thumbnail: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
    product_title: "Keramický talíř",
    quantity: 1,
    unit_price: 450 // 450 Kč
  }
];

export default () => (
  <AbandonedCartEmailComponent
    customer={mockCustomer}
    cart_id="sample-cart-123"
    items={mockItems}
  />
);
