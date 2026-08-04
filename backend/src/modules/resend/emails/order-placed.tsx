import {
  Text,
  Column,
  Container,
  Heading,
  Html,
  Img,
  Row,
  Section,
  Tailwind,
  Head,
  Preview,
  Body,
  Link,
  Button
} from "@react-email/components"
import { BigNumberValue, CustomerDTO, OrderDTO } from "@medusajs/framework/types"

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

  const formatter = new Intl.NumberFormat([], {
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

  return (
    <Html>
      <Head />
      <Preview>Děkujeme za vaši objednávku z Keramické Zahrady</Preview>
      <Tailwind>
        <Body className="bg-[#87986A] my-auto mx-auto font-sans">
            {/* Header */}
            <Section className="border-b border-solid border-[#212222]">
              <div className="bg-[#ffff] text-white py-3 flex align-center justify-center">
                <img style={{ width: "80px", height: "80px", margin: "6px 0" }} src="https://c3studium.com/assets/icons/logo.svg" alt="Logo" className="w-[40px] h-[40px]" />
                <Heading className="text-[#212222] text-[26px] font-normal text-center p-0 my-[30px] mx-0">
                  Keramická Zahrada
                </Heading>
              </div>
            </Section>

          <Container className="border border-solid border-[#212222] rounded-3xl my-[40px] mx-auto p-[20px] max-w-[600px] bg-white">
            {/* Header */}
            {/* Thank You Message */}
            <Section className="border-b border-solid border-[#212222] mt-10">
              <Heading className="text-[#212222] text-[36px] font-normal text-left p-0 my-[10px] mx-2">
                Děkujeme za vaši objednávku
              </Heading>
              <Text className="text-[#212222] text-[20px] leading-[24px] font-medium m-2 mt-10">
                {order.customer?.first_name || order.shipping_address?.first_name},
              </Text>
              <Text className="text-[#212222] text-[16px] leading-[24px] text-left m-2">
                Vaši objednávku zpracováváme a budeme vás informovat, jakmile bude odeslána.
              </Text>
            </Section>

            {/* Promotional Banner */}
            {shouldDisplayBanner && (
              <Section className="my-[32px] bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg p-[20px] text-center">
                <Heading className="text-white text-[18px] font-semibold mb-[8px]">
                  {email_banner.title}
                </Heading>
                <Text className="text-white text-[16px] leading-[24px] mb-[16px]">
                  {email_banner.body}
                </Text>
                <Button
                  className="bg-[#87986A] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3 hover:bg-[#212222] transition-colors"
                  href={email_banner.url}
                >
                  Nakupujte nyní
                </Button>
              </Section>
            )}

            {/* Order Items */}
            <Section className="my-[32px]">
              <Heading className="text-[#212222] text-[24px] font-semibold mb-[20px]">
                Vaše položky
              </Heading>
              <Text className="text-[#212222] text-[18px] leading-[20px] mb-[16px]">
                ID objednávky: #{order.display_id}
              </Text>

              {order.items?.map((item) => (
                <Section key={item.id} className="border-b border-solid border-[#87986A] py-[16px]">
                  <Row>
                    <Column className="w-1/3">
                      <Img
                        src={item.thumbnail ?? ''}
                        alt={item.product_title ?? ''}
                        className="rounded-lg w-full"
                      />
                    </Column>
                    <Column className="w-2/3 pl-4">
                      <Text className="text-[#212222] text-[18px] font-semibold leading-[24px] m-0">
                        {item.product_title}
                      </Text>
                      <Text className="text-[#87986A] text-[18px] leading-[24px] m-0">
                        {item.variant_title}
                      </Text>
                      <Text className="text-[#212222] text-[18px] font-bold leading-[24px] mt-2">
                        {formatPrice(item.total)}
                      </Text>
                    </Column>
                  </Row>
                </Section>
              ))}
            </Section>

            {/* Order Summary */}
            <Section className="my-[32px]">
              <Heading className="text-[#212222] text-[24px] font-semibold mb-[20px]">
                Shrnutí objednávky
              </Heading>

              <div className="space-y-[8px]">
                <Row>
                  <Column className="w-1/2">
                    <Text className="text-[#87986A] text-[14px] leading-[20px] m-0">Mezisoučet</Text>
                  </Column>
                  <Column className="w-1/2 text-right">
                    <Text className="text-[#212222] text-[16px] leading-[24px] m-0">
                      {formatPrice(order.item_total)}
                    </Text>
                  </Column>
                </Row>

                {order.shipping_methods?.map((method) => (
                  <Row key={method.id}>
                    <Column className="w-1/2">
                      <Text className="text-[#87986A] text-[14px] leading-[20px] m-0">{method.name}</Text>
                    </Column>
                    <Column className="w-1/2 text-right">
                      <Text className="text-[#212222] text-[16px] leading-[24px] m-0">{formatPrice(method.total)}</Text>
                    </Column>
                  </Row>
                ))}

                <Row>
                  <Column className="w-1/2">
                    <Text className="text-[#87986A] text-[14px] leading-[20px] m-0">Daň</Text>
                  </Column>
                  <Column className="w-1/2 text-right">
                    <Text className="text-[#212222] text-[16px] leading-[24px] m-0">{formatPrice(order.tax_total || 0)}</Text>
                  </Column>
                </Row>

                <Row className="border-t border-solid border-[#87986A] mt-[16px] pt-[16px]">
                  <Column className="w-1/2">
                    <Text className="text-[#212222] text-[18px] font-bold leading-[24px] m-0">Celkem</Text>
                  </Column>
                  <Column className="w-1/2 text-right">
                    <Text className="text-[#212222] text-[18px] font-bold leading-[24px] m-0">{formatPrice(order.total)}</Text>
                  </Column>
                </Row>
              </div>
            </Section>

            {/*
              Outstanding balance on a commission. Shown only when something is
              genuinely owed — a piece paid in full at checkout must never be
              asked for more, and an ordinary order never reaches this at all.
            */}
            {owes && (
              <Section className="mt-[32px] pt-[20px] border-t border-solid border-[#87986A]">
                <Heading className="text-[#212222] text-[20px] font-normal m-0">
                  Zbývá doplatit {balanceText}
                </Heading>
                <Text className="text-[#212222] text-[16px] leading-[24px] mt-2">
                  Váš kousek se vyrábí na míru. Doplatek můžete zaplatit hned,
                  nebo počkat, až vám napíšeme, že je hotovo — jak je vám milejší.
                </Text>
                {balance_payment_url && (
                  <Section className="mt-4">
                    <a
                      href={balance_payment_url}
                      className="bg-[#212222] text-white rounded-full px-6 py-3 text-[16px] no-underline inline-block"
                    >
                      Doplatit {balanceText}
                    </a>
                  </Section>
                )}
              </Section>
            )}

            {/* Footer */}
            <Section className="mt-[32px] pt-[20px] border-t border-solid border-[#87986A]">
              <Text className="text-[#212222] text-[16px] leading-[20px] text-center">
                Jestli máte nějaké dotazy, odpovězte na tento e-mail nebo kontaktujte náš tým podpory na adrese support@medusajs.com.
              </Text>
              <Text className="text-[#212222] text-[16px] leading-[20px] text-center mt-2">
                ID objednávky: {order.id}
              </Text>
              <Section className="mt-[32px] pt-[20px]">
                <Text className="text-[#212222] text-[14px] leading-[24px]">
                    S pozdravem,<br />
                    Keramická Zahrada, Lucie Polanská
                </Text>
              </Section>
              <Section className="border-t border-solid border-[#87986A]">
                <Text className="text-[#212222] text-[14px] leading-[20px] text-center">
                    Potřebujete pomoc? <a href="mailto:luciepolanska@gmail.com" className="text-[#87986A] no-underline hover:text-[#212222] transition-colors">Kontaktujte nás</a>
                </Text>
                <Text className="text-[#87986A] text-[12px] leading-[18px] text-center mt-4">
                    © {new Date().getFullYear()} Keramická Zahrada, Lucie Polanská. Všechna práva vyhrazena.
                </Text>
              </Section>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

export const orderPlacedEmail = (props: OrderPlacedEmailProps) => (
  <OrderPlacedEmailComponent {...props} />
)


const mockOrder = {
  "order": {
    "id": "order_01JSNXDH9BPJWWKVW03B9E9KW8",
    "display_id": 1,
    "email": "shahednasser@gmail.com",
    "currency_code": "eur",
    "total": 20,
    "subtotal": 20,
    "discount_total": 0,
    "shipping_total": 10,
    "tax_total": 0,
    "item_subtotal": 10,
    "item_total": 10,
    "item_tax_total": 0,
    "customer_id": "cus_01JSNXD6VQC1YH56E4TGC81NWX",
    "items": [
      {
        "id": "ordli_01JSNXDH9C47KZ43WQ3TBFXZA9",
        "title": "L",
        "subtitle": "Medusa Sweatshirt",
        "thumbnail": "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
        "variant_id": "variant_01JSNXAQCZ5X81A3NRSVFJ3ZHQ",
        "product_id": "prod_01JSNXAQBQ6MFV5VHKN420NXQW",
        "product_title": "Medusa Sweatshirt",
        "product_description": "Reimagine the feeling of a classic sweatshirt. With our cotton sweatshirt, everyday essentials no longer have to be ordinary.",
        "product_subtitle": null,
        "product_type": null,
        "product_type_id": null,
        "product_collection": null,
        "product_handle": "sweatshirt",
        "variant_sku": "SWEATSHIRT-L",
        "variant_barcode": null,
        "variant_title": "L",
        "variant_option_values": null,
        "requires_shipping": true,
        "is_giftcard": false,
        "is_discountable": true,
        "is_tax_inclusive": false,
        "is_custom_price": false,
        "metadata": {},
        "raw_compare_at_unit_price": null,
        "raw_unit_price": {
          "value": "10",
          "precision": 20
        },
        "created_at": new Date(),
        "updated_at": new Date(),
        "deleted_at": null,
        "tax_lines": [],
        "adjustments": [],
        "compare_at_unit_price": null,
        "unit_price": 10,
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
        "subtotal": 10,
        "total": 10,
        "original_total": 10,
        "discount_total": 0,
        "discount_subtotal": 0,
        "discount_tax_total": 0,
        "tax_total": 0,
        "original_tax_total": 0,
        "refundable_total_per_unit": 10,
        "refundable_total": 10,
        "fulfilled_total": 0,
        "shipped_total": 0,
        "return_requested_total": 0,
        "return_received_total": 0,
        "return_dismissed_total": 0,
        "write_off_total": 0,
        "raw_subtotal": {
          "value": "10",
          "precision": 20
        },
        "raw_total": {
          "value": "10",
          "precision": 20
        },
        "raw_original_total": {
          "value": "10",
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
          "value": "10",
          "precision": 20
        },
        "raw_refundable_total": {
          "value": "10",
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
      "first_name": "shahed",
      "last_name": "nasser",
      "address_1": "asfasf",
      "address_2": "",
      "city": "asfasf",
      "country_code": "dk",
      "province": "",
      "postal_code": "asfasf",
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
      "first_name": "shahed",
      "last_name": "nasser",
      "address_1": "asfasf",
      "address_2": "",
      "city": "asfasf",
      "country_code": "dk",
      "province": "",
      "postal_code": "asfasf",
      "phone": "",
      "metadata": null,
      "created_at": "2025-04-25T07:25:48.801Z",
      "updated_at": "2025-04-25T07:25:48.801Z",
      "deleted_at": null
    },
    "shipping_methods": [
      {
        "id": "ordsm_01JSNXDH9B9DDRQXJT5J5AE5V1",
        "name": "Standard Shipping",
        "description": null,
        "is_tax_inclusive": false,
        "is_custom_amount": false,
        "shipping_option_id": "so_01JSNXAQA64APG6BNHGCMCTN6V",
        "data": {},
        "metadata": null,
        "raw_amount": {
          "value": "10",
          "precision": 20
        },
        "created_at": new Date(),
        "updated_at": new Date(),
        "deleted_at": null,
        "tax_lines": [],
        "adjustments": [],
        "amount": 10,
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
        "subtotal": 10,
        "total": 10,
        "original_total": 10,
        "discount_total": 0,
        "discount_subtotal": 0,
        "discount_tax_total": 0,
        "tax_total": 0,
        "original_tax_total": 0,
        "raw_subtotal": {
          "value": "10",
          "precision": 20
        },
        "raw_total": {
          "value": "10",
          "precision": 20
        },
        "raw_original_total": {
          "value": "10",
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
      "first_name": null,
      "last_name": null,
      "email": "afsaf@gmail.com",
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
