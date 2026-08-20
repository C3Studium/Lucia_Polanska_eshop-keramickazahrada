import { Column, Img, Link, Row, Section, Text } from "@react-email/components"
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
import { NEWSLETTER_SENDER } from "./newsletter-blocks"

type BundlePublishedEmailProps = {
  bundle: {
    id: string
    name: string
    description: string
    thumbnail?: string
    items: Array<{
      id: string
      product_title: string
      variant_title: string
      thumbnail?: string
      unit_price: number
      quantity: number
    }>
    total_price: number
    discount_percentage?: number
    bundle_url: string
  }
  customer?: {
    first_name?: string
    email: string
  }
  /**
   * Per-recipient signed unsubscribe URL. Present on every newsletter fan-out
   * (`lib/newsletter-campaign.ts` builds it and the announce route refuses to
   * send without it) — a bundle announcement to the subscriber list is
   * obchodní sdělení under zák. č. 480/2004 Sb. like any other campaign, so
   * it carries the same legal footer: unsubscribe, sender identity, reason.
   */
  unsubscribeLink?: string
}

function BundlePublishedEmailComponent({ bundle, customer, unsubscribeLink }: BundlePublishedEmailProps) {
  const formatter = new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currencyDisplay: "narrowSymbol",
    currency: "czk",
  })

  const formatPrice = (price: number) => {
    return formatter.format(price)
  }

  const itemsTotal =
    bundle.items?.reduce(
      (total, item) => total + item.unit_price * item.quantity,
      0
    ) || 0
  const savings = itemsTotal - bundle.total_price

  return (
    <EmailLayout preview={`Nový balíček ${bundle.name} je k nahlédnutí.`}>
      <Eyebrow index="01">Z ateliéru</Eyebrow>
      <EmailH1 accent="k nahlédnutí.">Nový balíček</EmailH1>

      <Greeting name={customer?.first_name} />
      <P>
        v ateliéru jsme dali dohromady nový soubor objektů, které se
        k sobě hodí — a společně je pořídíte za příznivější cenu. Rádi
        vám ho představíme.
      </P>

      {/* Balíček */}
      <Section style={{ margin: "32px 0 0" }}>
        <Eyebrow index="02">Balíček</Eyebrow>
        <Text
          style={{
            fontFamily: brand.serif,
            fontSize: "19px",
            lineHeight: "26px",
            color: brand.ink,
            margin: "0 0 8px",
          }}
        >
          {bundle.name}
        </Text>
        <P>{bundle.description}</P>
      </Section>

      {/* Objekty */}
      <Section style={{ margin: "24px 0 0" }}>
        <Eyebrow index="03">Objekty</Eyebrow>
        {bundle.items?.map((item, i) => (
          <Row key={item.id} style={{ borderTop: `1px solid ${brand.line}` }}>
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
                {String(i + 1).padStart(2, "0")}
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
              {item.variant_title ? (
                <Text
                  style={{
                    fontFamily: brand.sans,
                    fontSize: "12px",
                    lineHeight: "18px",
                    color: brand.muted,
                    margin: "2px 0 0",
                  }}
                >
                  {item.variant_title}
                  {item.quantity > 1 ? ` · ${item.quantity} ks` : ""}
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
                {formatPrice(item.unit_price * item.quantity)}
              </Text>
            </Column>
          </Row>
        ))}
        <LedgerEnd />
      </Section>

      {/* Souhrn */}
      <Section style={{ margin: "32px 0 0" }}>
        <Eyebrow index="04">Souhrn</Eyebrow>
        <LedgerRow
          label="Jednotlivě"
          value={
            <span style={{ textDecoration: "line-through" }}>
              {formatPrice(itemsTotal)}
            </span>
          }
          tone="clay"
        />
        <LedgerRow
          label="Cena balíčku"
          value={formatPrice(bundle.total_price)}
          strong
        />
        <LedgerEnd />
      </Section>

      {savings > 0 ? (
        <Note tone="olive">
          Oproti nákupu po jednom ušetříte {formatPrice(savings)}.
        </Note>
      ) : null}

      <ButtonRow>
        <EmailButton href={bundle.bundle_url}>Prohlédnout balíček</EmailButton>
      </ButtonRow>

      <P small>
        Označení balíčku pro případnou komunikaci: {bundle.id}
      </P>

      {unsubscribeLink ? (
        <Section
          style={{ borderTop: `1px solid ${brand.line}`, margin: "32px 0 0" }}
        >
          <P small style={{ margin: "16px 0 0" }}>
            Tento e-mail dostáváte, protože jste se přihlásili k odběru novinek
            na keramickazahrada.cz a odběr potvrdili. Odhlásit se můžete
            kdykoli{" "}
            <Link
              href={unsubscribeLink}
              style={{ color: brand.ink, textDecoration: "underline" }}
            >
              zde
            </Link>
            .
          </P>
          <P small style={{ margin: "8px 0 0" }}>
            Odesílatel: {NEWSLETTER_SENDER.name}, se sídlem{" "}
            {NEWSLETTER_SENDER.address}, IČO{" "}
            {NEWSLETTER_SENDER.registrationNumber}.
          </P>
        </Section>
      ) : null}
      <Signature />
    </EmailLayout>
  )
}

export const bundlePublishedEmail = (props: BundlePublishedEmailProps) => (
  <BundlePublishedEmailComponent {...props} />
)

// Mock data for preview/development
const mockBundlePublished = {
  bundle: {
    id: "bundle_01JSNXDH9BPJWWKVW03B9E9KW8",
    name: "Keramický set pro začátečníky",
    description: "Kompletní sada pro všechny, kdo chtějí začít s keramikou. Obsahuje vše potřebné pro vytvoření prvních děl.",
    total_price: 2500,
    discount_percentage: 15,
    bundle_url: "https://keramickazahrada.cz/bundles/bundle-01JSNXDH9BPJWWKVW03B9E9KW8",
    thumbnail: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
    items: [
      {
        id: "item_01",
        product_title: "Keramická hlína - 5kg",
        variant_title: "Bílá hlína",
        thumbnail: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
        unit_price: 800,
        quantity: 1
      },
      {
        id: "item_02",
        product_title: "Keramické nástroje - základní set",
        variant_title: "8 nástrojů",
        thumbnail: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
        unit_price: 1200,
        quantity: 1
      },
      {
        id: "item_03",
        product_title: "Keramický glazovací set",
        variant_title: "Barevné glazury - 6 barev",
        thumbnail: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
        unit_price: 600,
        quantity: 1
      },
      {
        id: "item_04",
        product_title: "Kniha - Keramika pro začátečníky",
        variant_title: "Česká verze",
        thumbnail: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
        unit_price: 250,
        quantity: 1
      }
    ]
  },
  customer: {
    first_name: "Marie",
    email: "marie.novakova@email.com"
  }
}

export default () => <BundlePublishedEmailComponent {...mockBundlePublished} />
