import { Column, Img, Row, Section, Text } from "@react-email/components"
import { BigNumberValue, CustomerDTO, OrderDTO } from "@medusajs/framework/types"
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
  Signature,
} from "../components/email-ui"

type OrderPlacedEmailProps = {
  order: OrderDTO & {
    customer: CustomerDTO
  }
  email_banner?: {
    body: string
    title: string
    url: string
  }
  /** Still owed after checkout — only ever non-zero for a commission. */
  balance_due?: number
  balance_currency?: string
  /** Signed „doplatit" link; absent when nothing is owed. */
  balance_payment_url?: string | null
}

function OrderPlacedEmailComponent({
  order,
  email_banner,
  balance_due,
  balance_payment_url,
  balance_currency,
}: OrderPlacedEmailProps) {
  const owes = typeof balance_due === "number" && balance_due > 0
  const balanceText = owes
    ? new Intl.NumberFormat("cs-CZ", {
        style: "currency",
        currency: (balance_currency || order.currency_code || "CZK").toUpperCase(),
      }).format(balance_due as number)
    : null
  const shouldDisplayBanner = email_banner && "title" in email_banner

  const formatter = new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currencyDisplay: "narrowSymbol",
    currency: order.currency_code,
  })

  const formatPrice = (price: BigNumberValue) => {
    if (typeof price === "number") {
      return formatter.format(price)
    }

    if (typeof price === "string") {
      return formatter.format(parseFloat(price))
    }

    return price?.toString() || ""
  }

  const greetingName =
    order.customer?.first_name || order.shipping_address?.first_name

  return (
    <EmailLayout preview="Objednávku jsme zaznamenali — děkujeme.">
      <Eyebrow index="01">Objednávka {`#${order.display_id}`}</Eyebrow>
      <EmailH1 accent="zaznamenali.">Objednávku jsme</EmailH1>

      <P>{greetingName ? `Dobrý den, ${greetingName},` : "Dobrý den,"}</P>
      <P>
        děkujeme za vaši objednávku. Každý kus teď zkontrolujeme a pečlivě
        zabalíme — jakmile objednávku předáme dopravci, pošleme další zprávu.
      </P>

      {/* Objekty */}
      <Section style={{ margin: "32px 0 0" }}>
        <Eyebrow index="02">Objekty</Eyebrow>
        {order.items?.map((item, i) => (
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
                {formatPrice(item.total)}
              </Text>
            </Column>
          </Row>
        ))}
        <LedgerEnd />
      </Section>

      {/* Souhrn */}
      <Section style={{ margin: "32px 0 0" }}>
        <Eyebrow index="03">Souhrn</Eyebrow>
        <LedgerRow label="Mezisoučet" value={formatPrice(order.item_total)} />
        {order.shipping_methods?.map((method) => (
          <LedgerRow
            key={method.id}
            label={method.name}
            value={formatPrice(method.total)}
          />
        ))}
        <LedgerRow label="Daň" value={formatPrice(order.tax_total || 0)} />
        <LedgerRow label="Celkem" value={formatPrice(order.total)} strong />
        <LedgerEnd />
      </Section>

      {/*
        Outstanding balance on a commission. Shown only when something is
        genuinely owed — a piece paid in full at checkout must never be
        asked for more, and an ordinary order never reaches this at all.
      */}
      {owes && (
        <Section style={{ margin: "32px 0 0" }}>
          <Note tone="clay">Zbývá doplatit {balanceText}.</Note>
          <P>
            Váš kousek se vyrábí na míru. Doplatek můžete zaplatit hned, nebo
            počkat, až vám napíšeme, že je hotovo — jak je vám milejší.
          </P>
          {balance_payment_url && (
            <ButtonRow>
              <EmailButton href={balance_payment_url}>
                Doplatit {balanceText}
              </EmailButton>
            </ButtonRow>
          )}
        </Section>
      )}

      {/* Volitelný promo blok */}
      {shouldDisplayBanner && (
        <Section
          style={{
            margin: "32px 0 0",
            borderTop: `1px solid ${brand.line}`,
            paddingTop: "24px",
          }}
        >
          <Text
            style={{
              fontFamily: brand.serif,
              fontSize: "19px",
              lineHeight: "26px",
              color: brand.ink,
              margin: "0 0 8px",
            }}
          >
            {email_banner.title}
          </Text>
          <P>{email_banner.body}</P>
          <EmailButton href={email_banner.url} variant="ghost">
            Prohlédnout
          </EmailButton>
        </Section>
      )}

      <P style={{ margin: "32px 0 0" }}>
        Máte-li jakýkoli dotaz, stačí odpovědět na tento e-mail.
      </P>
      <Signature />

      <P small style={{ margin: "28px 0 0", color: brand.faint }}>
        Číslo objednávky pro případnou komunikaci: {order.id}
      </P>
    </EmailLayout>
  )
}

export const orderPlacedEmail = (props: OrderPlacedEmailProps) => (
  <OrderPlacedEmailComponent {...props} />
)


const mockOrder = {
  "order": {
    "id": "order_01JSNXDH9BPJWWKVW03B9E9KW8",
    "display_id": 42,
    "email": "jana.novakova@example.cz",
    "currency_code": "czk",
    "total": 1579,
    "subtotal": 1579,
    "discount_total": 0,
    "shipping_total": 129,
    "tax_total": 0,
    "item_subtotal": 1450,
    "item_total": 1450,
    "item_tax_total": 0,
    "customer_id": "cus_01JSNXD6VQC1YH56E4TGC81NWX",
    "items": [
      {
        "id": "ordli_01JSNXDH9C47KZ43WQ3TBFXZA9",
        "title": "Ø 32 cm",
        "subtitle": "Zahradní mísa z pálené hlíny",
        "thumbnail": "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
        "variant_id": "variant_01JSNXAQCZ5X81A3NRSVFJ3ZHQ",
        "product_id": "prod_01JSNXAQBQ6MFV5VHKN420NXQW",
        "product_title": "Zahradní mísa z pálené hlíny",
        "product_description": "Ručně točená mísa z písecké hlíny, pálená v peci ateliéru.",
        "product_subtitle": null,
        "product_type": null,
        "product_type_id": null,
        "product_collection": null,
        "product_handle": "zahradni-misa",
        "variant_sku": "MISA-32",
        "variant_barcode": null,
        "variant_title": "Ø 32 cm",
        "variant_option_values": null,
        "requires_shipping": true,
        "is_giftcard": false,
        "is_discountable": true,
        "is_tax_inclusive": false,
        "is_custom_price": false,
        "metadata": {},
        "raw_compare_at_unit_price": null,
        "raw_unit_price": {
          "value": "1450",
          "precision": 20
        },
        "created_at": new Date(),
        "updated_at": new Date(),
        "deleted_at": null,
        "tax_lines": [],
        "adjustments": [],
        "compare_at_unit_price": null,
        "unit_price": 1450,
        "quantity": 1,
        "raw_quantity": {
          "value": "1",
          "precision": 20
        },
        "detail": {
          "id": "orditem_01JSNXDH9DK1XMESEZPADYFWKY",
          "version": 1,
          "metadata": null,
          "order_id": "order_01JSNXDH9BPJWWKVW03B9E9KW8",
          "raw_unit_price": null,
          "raw_compare_at_unit_price": null,
          "raw_quantity": {
            "value": "1",
            "precision": 20
          },
          "raw_fulfilled_quantity": {
            "value": "0",
            "precision": 20
          },
          "raw_delivered_quantity": {
            "value": "0",
            "precision": 20
          },
          "raw_shipped_quantity": {
            "value": "0",
            "precision": 20
          },
          "raw_return_requested_quantity": {
            "value": "0",
            "precision": 20
          },
          "raw_return_received_quantity": {
            "value": "0",
            "precision": 20
          },
          "raw_return_dismissed_quantity": {
            "value": "0",
            "precision": 20
          },
          "raw_written_off_quantity": {
            "value": "0",
            "precision": 20
          },
          "created_at": new Date(),
          "updated_at": new Date(),
          "deleted_at": null,
          "item_id": "ordli_01JSNXDH9C47KZ43WQ3TBFXZA9",
          "unit_price": null,
          "compare_at_unit_price": null,
          "quantity": 1,
          "fulfilled_quantity": 0,
          "delivered_quantity": 0,
          "shipped_quantity": 0,
          "return_requested_quantity": 0,
          "return_received_quantity": 0,
          "return_dismissed_quantity": 0,
          "written_off_quantity": 0
        },
        "subtotal": 1450,
        "total": 1450,
        "original_total": 1450,
        "discount_total": 0,
        "discount_subtotal": 0,
        "discount_tax_total": 0,
        "tax_total": 0,
        "original_tax_total": 0,
        "refundable_total_per_unit": 1450,
        "refundable_total": 1450,
        "fulfilled_total": 0,
        "shipped_total": 0,
        "return_requested_total": 0,
        "return_received_total": 0,
        "return_dismissed_total": 0,
        "write_off_total": 0,
        "raw_subtotal": {
          "value": "1450",
          "precision": 20
        },
        "raw_total": {
          "value": "1450",
          "precision": 20
        },
        "raw_original_total": {
          "value": "1450",
          "precision": 20
        },
        "raw_discount_total": {
          "value": "0",
          "precision": 20
        },
        "raw_discount_subtotal": {
          "value": "0",
          "precision": 20
        },
        "raw_discount_tax_total": {
          "value": "0",
          "precision": 20
        },
        "raw_tax_total": {
          "value": "0",
          "precision": 20
        },
        "raw_original_tax_total": {
          "value": "0",
          "precision": 20
        },
        "raw_refundable_total_per_unit": {
          "value": "1450",
          "precision": 20
        },
        "raw_refundable_total": {
          "value": "1450",
          "precision": 20
        },
        "raw_fulfilled_total": {
          "value": "0",
          "precision": 20
        },
        "raw_shipped_total": {
          "value": "0",
          "precision": 20
        },
        "raw_return_requested_total": {
          "value": "0",
          "precision": 20
        },
        "raw_return_received_total": {
          "value": "0",
          "precision": 20
        },
        "raw_return_dismissed_total": {
          "value": "0",
          "precision": 20
        },
        "raw_write_off_total": {
          "value": "0",
          "precision": 20
        }
      }
    ],
    "shipping_address": {
      "id": "caaddr_01JSNXD6W0TGPH2JQD18K97B25",
      "customer_id": null,
      "company": "",
      "first_name": "Jana",
      "last_name": "Nováková",
      "address_1": "Putim 229",
      "address_2": "",
      "city": "Písek",
      "country_code": "cz",
      "province": "",
      "postal_code": "397 01",
      "phone": "",
      "metadata": null,
      "created_at": "2025-04-25T07:25:48.801Z",
      "updated_at": "2025-04-25T07:25:48.801Z",
      "deleted_at": null
    },
    "billing_address": {
      "id": "caaddr_01JSNXD6W0V7RNZH63CPG26K5W",
      "customer_id": null,
      "company": "",
      "first_name": "Jana",
      "last_name": "Nováková",
      "address_1": "Putim 229",
      "address_2": "",
      "city": "Písek",
      "country_code": "cz",
      "province": "",
      "postal_code": "397 01",
      "phone": "",
      "metadata": null,
      "created_at": "2025-04-25T07:25:48.801Z",
      "updated_at": "2025-04-25T07:25:48.801Z",
      "deleted_at": null
    },
    "shipping_methods": [
      {
        "id": "ordsm_01JSNXDH9B9DDRQXJT5J5AE5V1",
        "name": "Zásilkovna",
        "description": null,
        "is_tax_inclusive": false,
        "is_custom_amount": false,
        "shipping_option_id": "so_01JSNXAQA64APG6BNHGCMCTN6V",
        "data": {},
        "metadata": null,
        "raw_amount": {
          "value": "129",
          "precision": 20
        },
        "created_at": new Date(),
        "updated_at": new Date(),
        "deleted_at": null,
        "tax_lines": [],
        "adjustments": [],
        "amount": 129,
        "order_id": "order_01JSNXDH9BPJWWKVW03B9E9KW8",
        "detail": {
          "id": "ordspmv_01JSNXDH9B5RAF4FH3M1HH3TEA",
          "version": 1,
          "order_id": "order_01JSNXDH9BPJWWKVW03B9E9KW8",
          "return_id": null,
          "exchange_id": null,
          "claim_id": null,
          "created_at": new Date(),
          "updated_at": new Date(),
          "deleted_at": null,
          "shipping_method_id": "ordsm_01JSNXDH9B9DDRQXJT5J5AE5V1"
        },
        "subtotal": 129,
        "total": 129,
        "original_total": 129,
        "discount_total": 0,
        "discount_subtotal": 0,
        "discount_tax_total": 0,
        "tax_total": 0,
        "original_tax_total": 0,
        "raw_subtotal": {
          "value": "129",
          "precision": 20
        },
        "raw_total": {
          "value": "129",
          "precision": 20
        },
        "raw_original_total": {
          "value": "129",
          "precision": 20
        },
        "raw_discount_total": {
          "value": "0",
          "precision": 20
        },
        "raw_discount_subtotal": {
          "value": "0",
          "precision": 20
        },
        "raw_discount_tax_total": {
          "value": "0",
          "precision": 20
        },
        "raw_tax_total": {
          "value": "0",
          "precision": 20
        },
        "raw_original_tax_total": {
          "value": "0",
          "precision": 20
        }
      }
    ],
    "customer": {
      "id": "cus_01JSNXD6VQC1YH56E4TGC81NWX",
      "company_name": null,
      "first_name": "Jana",
      "last_name": "Nováková",
      "email": "jana.novakova@example.cz",
      "phone": null,
      "has_account": false,
      "metadata": null,
      "created_by": null,
      "created_at": "2025-04-25T07:25:48.791Z",
      "updated_at": "2025-04-25T07:25:48.791Z",
      "deleted_at": null
    }
  }
}
// @ts-ignore
export default () => <OrderPlacedEmailComponent {...mockOrder} />
