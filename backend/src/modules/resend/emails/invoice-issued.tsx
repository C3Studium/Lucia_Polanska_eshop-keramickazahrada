import { Column, Img, Row, Section, Text } from "@react-email/components"
import type { BigNumberValue, OrderDTO } from "@medusajs/framework/types"
import {
  isPackagingLine,
  PACKAGING_TITLE,
  withPackagingUnderProducts,
} from "../../../lib/packaging-lines"
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
import type { CommissionPaymentsText } from "../../../lib/commission-breakdown"

/** Kterou platbu faktura kryje — běžná objednávka celá, u zakázky jen záloha
 *  nebo doplatek. Rozhoduje o textu a o tom, jestli se připomíná doplatek. */
type InvoiceKind = "full" | "deposit" | "balance"

interface InvoiceIssuedEmailProps {
  customerName?: string;
  orderNumber?: string;
  invoiceNumber?: string;
  /** Částka na TÉTO faktuře — u zálohy záloha, u doplatku doplatek. */
  totalAmount?: string;
  /** Our own copy of the PDF (MinIO) — empty when the upload failed. */
  invoicePdfUrl?: string;
  orderLink?: string;
  /**
   * Celá objednávka, aby faktura nesla stejný rozpis jako potvrzení objednávky
   * („vsuň kontent toho emailu co se posílá k objednávce"). Když chybí, e-mail
   * zůstane u holého přehledu částek — nic si nevymýšlí.
   */
  order?: OrderDTO;
  invoiceKind?: InvoiceKind;
  /** U zálohové faktury: kolik ještě zbývá doplatit (naformátované). */
  balanceRemaining?: string;
  /**
   * U doplatkové (vyúčtovací) faktury zakázky: záloha · doplatek · příplatek
   * · celkem zaplaceno (lib/commission-breakdown).
   */
  commissionPayments?: CommissionPaymentsText | null;
}

const amountLabel: Record<InvoiceKind, string> = {
  full: "Částka",
  deposit: "Zaplacená záloha",
  balance: "Zaplacený doplatek",
}

/**
 * Faktura e-mailem. Nese celý rozpis objednávky (Objekty + Souhrn) jako
 * potvrzení objednávky, aby zákazník na jednom místě viděl, za co doklad je.
 *
 * Bez PDF (upload se nepovedl) e-mail nesmí tvrdit „posíláme fakturu"
 * a neposlat nic — místo tlačítka řekne, že doklad pošleme, a nabídne
 * odpověď na e-mail.
 */
function InvoiceIssuedEmailComponent({
  customerName,
  orderNumber = "",
  invoiceNumber = "",
  totalAmount,
  invoicePdfUrl = "",
  orderLink = "",
  order,
  invoiceKind = "full",
  balanceRemaining,
  commissionPayments,
}: InvoiceIssuedEmailProps) {
  const greeting = customerName ? `Dobrý den, ${customerName},` : "Dobrý den,"

  const formatter = order
    ? new Intl.NumberFormat("cs-CZ", {
        style: "currency",
        currencyDisplay: "narrowSymbol",
        currency: (order.currency_code || "czk").toUpperCase(),
      })
    : null
  const formatPrice = (price: BigNumberValue) => {
    if (!formatter) return String(price ?? "")
    if (typeof price === "number") return formatter.format(price)
    if (typeof price === "string") return formatter.format(parseFloat(price))
    return price?.toString() || ""
  }

  /* „Mezisoučet" bral `order.item_total`, který načtení pro fakturu nemá →
     prázdný řádek. Bez něj se sečtou položky. */
  const itemsSubtotal =
    order?.item_total ??
    ((order?.items ?? []) as any[]).reduce(
      (sum, item) => sum + (Number(item?.total?.value ?? item?.total) || 0),
      0
    )

  const lead =
    invoiceKind === "deposit"
      ? "posíláme fakturu za zálohu k vaší objednávce na míru."
      : invoiceKind === "balance"
        ? "posíláme vyúčtovací fakturu k vaší zakázce — je na ní celá zakázka, odečtená záloha a doplatek, který jste právě zaplatili."
        : invoicePdfUrl
          ? "posíláme fakturu k vaší objednávce. Nic dalšího od vás nepotřebujeme — doklad si jen uložte pro případ, že ho budete někdy potřebovat."
          : "k vaší objednávce jsme vystavili fakturu. Kdybyste doklad potřebovali v PDF, stačí odpovědět na tento e-mail a pošleme vám ho."

  return (
    <EmailLayout preview={`Faktura ${invoiceNumber} k objednávce ${orderNumber}.`}>
      <Eyebrow>Faktura</Eyebrow>
      <EmailH1 accent="k vaší objednávce.">Faktura</EmailH1>

      <P>{greeting}</P>
      <P>{lead}</P>

      {invoiceKind === "deposit" && balanceRemaining ? (
        <Note tone="clay">
          Tato faktura je za zaplacenou zálohu. Zbývá doplatit {balanceRemaining} —
          vyžádáme si ho, až bude kousek hotový, a pošleme k němu druhou fakturu.
        </Note>
      ) : null}

      {/* Doklad */}
      <Section style={{ margin: "24px 0 0" }}>
        {orderNumber ? <LedgerRow label="Objednávka" value={orderNumber} /> : null}
        {invoiceNumber ? (
          <LedgerRow label="Číslo faktury" value={invoiceNumber} />
        ) : null}
        {totalAmount ? (
          <LedgerRow
            label={amountLabel[invoiceKind]}
            value={totalAmount}
            strong
            tone="olive"
          />
        ) : null}
        <LedgerEnd />
      </Section>

      {/* Platby zakázky — u vyúčtování: co a kdy se zaplatilo. */}
      {invoiceKind === "balance" && commissionPayments ? (
        <Section style={{ margin: "32px 0 0" }}>
          <Eyebrow>Platby zakázky</Eyebrow>
          {commissionPayments.deposit ? (
            <LedgerRow
              label={
                commissionPayments.depositInvoiceNumber
                  ? `Záloha (faktura ${commissionPayments.depositInvoiceNumber})`
                  : "Záloha"
              }
              value={commissionPayments.deposit}
            />
          ) : null}
          {commissionPayments.balance ? (
            <LedgerRow label="Doplatek" value={commissionPayments.balance} />
          ) : null}
          {commissionPayments.surcharge ? (
            <LedgerRow label="Příplatek" value={commissionPayments.surcharge} />
          ) : null}
          <LedgerRow
            label="Celkem zaplaceno"
            value={commissionPayments.totalPaid}
            strong
            tone="olive"
          />
          <LedgerEnd />
        </Section>
      ) : null}

      {/* Objekty — celý obsah objednávky, stejně jako v potvrzení objednávky. */}
      {order?.items?.length ? (
        <Section style={{ margin: "32px 0 0" }}>
          <Eyebrow>Objednané</Eyebrow>
          {/* Balné (lib/packaging.ts) hned pod svým výrobkem, menším řádkem. */}
          {withPackagingUnderProducts(order.items as any[]).map((item: any) =>
            isPackagingLine(item) ? (
              <Row key={item.id}>
                <Column style={{ width: "68px" }} />
                <Column style={{ padding: "0 0 12px", verticalAlign: "top" }}>
                  <Text
                    style={{
                      fontFamily: brand.sans,
                      fontSize: "12px",
                      lineHeight: "18px",
                      color: brand.muted,
                      margin: 0,
                    }}
                  >
                    {PACKAGING_TITLE}
                    {Number(item.quantity) > 1 ? ` · ${item.quantity} ks` : ""}
                  </Text>
                </Column>
                <Column align="right" style={{ padding: "0 0 12px", verticalAlign: "top", width: "110px" }}>
                  <Text
                    style={{
                      fontFamily: brand.sans,
                      fontSize: "12px",
                      lineHeight: "18px",
                      color: brand.muted,
                      margin: 0,
                    }}
                  >
                    {formatPrice(item.total)}
                  </Text>
                </Column>
              </Row>
            ) : (
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
                  {String(
                    (order.items as any[])
                      .filter((line) => !isPackagingLine(line))
                      .findIndex((line) => line.id === item.id) + 1
                  ).padStart(2, "0")}
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
                  {item.product_title ?? item.title}
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
            )
          )}
          <LedgerEnd />
        </Section>
      ) : null}

      {/* Souhrn — mezisoučet, doprava, celkem. Daň se neuvádí (neplátce DPH). */}
      {order?.items?.length ? (
        <Section style={{ margin: "32px 0 0" }}>
          <Eyebrow>Souhrn</Eyebrow>
          <LedgerRow label="Mezisoučet" value={formatPrice(itemsSubtotal)} />
          {order.shipping_methods?.map((method) => (
            <LedgerRow
              key={method.id}
              label={method.name}
              value={formatPrice(method.total)}
            />
          ))}
          {/* Příplatek zakázky není v ceně objednávky (žije v modulu výroby) —
              bez něj by „Celkem" nesedělo s tím, co zákazník zaplatil. */}
          {invoiceKind === "balance" && commissionPayments?.surcharge ? (
            <LedgerRow label="Příplatek" value={commissionPayments.surcharge} />
          ) : null}
          <LedgerRow
            label="Celkem"
            value={
              invoiceKind === "balance" && commissionPayments
                ? commissionPayments.totalPaid
                : formatPrice(order.total)
            }
            strong
          />
          <LedgerEnd />
        </Section>
      ) : null}

      {invoicePdfUrl || orderLink ? (
        <ButtonRow>
          {invoicePdfUrl ? (
            <EmailButton href={invoicePdfUrl}>
              Stáhnout fakturu (PDF)
            </EmailButton>
          ) : null}
          {orderLink ? (
            <>
              {invoicePdfUrl ? (
                <span style={{ display: "inline-block", width: "12px" }} />
              ) : null}
              <EmailButton
                href={orderLink}
                variant={invoicePdfUrl ? "ghost" : "primary"}
              >
                Zobrazit objednávku
              </EmailButton>
            </>
          ) : null}
        </ButtonRow>
      ) : null}
      <Signature />
    </EmailLayout>
  )
}

export const InvoiceIssuedEmail = (props: InvoiceIssuedEmailProps) => (
  <InvoiceIssuedEmailComponent {...props} />
)

// Mock data for preview/development
const mockInvoiceIssued: InvoiceIssuedEmailProps = {
  customerName: "Jana Nováková",
  orderNumber: "#12345",
  invoiceNumber: "20260042",
  totalAmount: "1 225 Kč",
  invoicePdfUrl: "https://keramickazahrada.cz/faktura-20260042.pdf",
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed",
  invoiceKind: "deposit",
  balanceRemaining: "3 225 Kč",
  order: {
    currency_code: "czk",
    item_total: 4450,
    total: 4450,
    items: [
      {
        id: "ordli_1",
        title: "Na míru",
        product_title: "Zahradní mísa na míru",
        variant_title: "Ø 40 cm",
        thumbnail:
          "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
        quantity: 1,
        total: 4450,
      },
    ],
    shipping_methods: [
      { id: "sm_1", name: "Osobní odběr v ateliéru", total: 0 },
    ],
  } as unknown as OrderDTO,
}

export default () => <InvoiceIssuedEmailComponent {...mockInvoiceIssued} />
