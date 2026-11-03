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
  useUiCopy,
} from "../components/email-ui"
import type { CommissionPaymentsText } from "../../../lib/commission-breakdown"
import { useCopy, useEmailLocale, useIntlLocale } from "../components/email-i18n"
import { localizedLineTitle, piecesLabel, type Localized } from "../../../lib/email-locale"

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
   * U doplatkové faktury zakázky: záloha · doplatek · příplatek
   * · celkem zaplaceno (lib/commission-breakdown).
   */
  commissionPayments?: CommissionPaymentsText | null;
}

/** Texty po jazycích (lib/email-locale) — čeština je původní znění. */
const COPY: Localized<{
  amountLabel: Record<InvoiceKind, string>
  leadDeposit: string
  leadBalance: string
  leadFull: string
  leadFullNoPdf: string
  preview: (invoice: string, order: string) => string
  eyebrow: string
  title: string
  accent: string
  depositNote: (remaining: string) => string
  order: string
  invoiceNumber: string
  commissionPayments: string
  depositWithInvoice: (invoice: string) => string
  deposit: string
  balance: string
  surcharge: string
  totalPaid: string
  itemsHeading: string
  packaging: string
  summary: string
  pickupInWorkshop: string
  subtotal: string
  total: string
  download: string
  viewOrder: string
}> = {
  cs: {
    amountLabel: { full: "Částka", deposit: "Zaplacená záloha", balance: "Zaplacený doplatek" },
    leadDeposit:
      "posílám fakturu za zálohu na vaši zakázku. Nic dalšího od vás teď nepotřebuji — doklad si jen uložte.",
    leadBalance:
      "posílám fakturu za doplatek vaší zakázky. Nic dalšího od vás nepotřebuji — doklad si jen uložte.",
    leadFull:
      "posílám fakturu k vaší objednávce. Nic dalšího od vás nepotřebuji — doklad si jen uložte, kdybyste ho někdy potřebovali.",
    leadFullNoPdf:
      "k vaší objednávce jsem vystavila fakturu. Kdybyste doklad potřebovali v PDF, napište mi na info@keramickazahrada.cz a pošlu vám ho.",
    preview: (invoice, order) => `Faktura ${invoice} k objednávce ${order}.`,
    eyebrow: "Faktura",
    title: "Faktura",
    accent: "k vaší objednávce.",
    depositNote: (remaining) =>
      `Tato faktura je za zaplacenou zálohu. Zbývá doplatit ${remaining} — o doplatek vás požádám, až bude kousek hotový, a pošlu k němu druhou fakturu.`,
    order: "Objednávka",
    invoiceNumber: "Číslo faktury",
    commissionPayments: "Platby zakázky",
    depositWithInvoice: (invoice) => `Záloha (faktura ${invoice})`,
    deposit: "Záloha",
    balance: "Doplatek",
    surcharge: "Příplatek",
    totalPaid: "Celkem zaplaceno",
    itemsHeading: "Co jste si objednali",
    packaging: PACKAGING_TITLE,
    summary: "Souhrn",
    pickupInWorkshop: "Osobní odběr v dílně",
    subtotal: "Mezisoučet",
    total: "Celkem",
    download: "Stáhnout fakturu (PDF)",
    viewOrder: "Zobrazit objednávku",
  },
  sk: {
    amountLabel: { full: "Suma", deposit: "Zaplatená záloha", balance: "Zaplatený doplatok" },
    leadDeposit:
      "posielam faktúru za zálohu na vašu zákazku. Nič ďalšie od vás teraz nepotrebujem — doklad si len uložte.",
    leadBalance:
      "posielam faktúru za doplatok vašej zákazky. Nič ďalšie od vás nepotrebujem — doklad si len uložte.",
    leadFull:
      "posielam faktúru k vašej objednávke. Nič ďalšie od vás nepotrebujem — doklad si len uložte, keby ste ho niekedy potrebovali.",
    leadFullNoPdf:
      "k vašej objednávke som vystavila faktúru. Keby ste doklad potrebovali v PDF, napíšte mi na info@keramickazahrada.cz a pošlem vám ho.",
    preview: (invoice, order) => `Faktúra ${invoice} k objednávke ${order}.`,
    eyebrow: "Faktúra",
    title: "Faktúra",
    accent: "k vašej objednávke.",
    depositNote: (remaining) =>
      `Táto faktúra je za zaplatenú zálohu. Zostáva doplatiť ${remaining} — o doplatok vás požiadam, keď bude kúsok hotový, a pošlem k nemu druhú faktúru.`,
    order: "Objednávka",
    invoiceNumber: "Číslo faktúry",
    commissionPayments: "Platby za zákazku",
    depositWithInvoice: (invoice) => `Záloha (faktúra ${invoice})`,
    deposit: "Záloha",
    balance: "Doplatok",
    surcharge: "Príplatok",
    totalPaid: "Spolu zaplatené",
    itemsHeading: "Čo ste si objednali",
    packaging: "Balné",
    summary: "Súhrn",
    pickupInWorkshop: "Osobný odber v dielni",
    subtotal: "Medzisúčet",
    total: "Spolu",
    download: "Stiahnuť faktúru (PDF)",
    viewOrder: "Zobraziť objednávku",
  },
  pl: {
    amountLabel: { full: "Kwota", deposit: "Wpłacona zaliczka", balance: "Wpłacona dopłata" },
    leadDeposit:
      "Przesyłam fakturę za zaliczkę na Państwa zamówienie indywidualne. Na razie niczego więcej od Państwa nie potrzebuję — wystarczy zachować dokument.",
    leadBalance:
      "Przesyłam fakturę za dopłatę do Państwa zamówienia indywidualnego. Niczego więcej od Państwa nie potrzebuję — wystarczy zachować dokument.",
    leadFull:
      "Przesyłam fakturę do Państwa zamówienia. Niczego więcej od Państwa nie potrzebuję — wystarczy zachować dokument, gdyby był kiedyś potrzebny.",
    leadFullNoPdf:
      "Do Państwa zamówienia wystawiłam fakturę. Jeśli będą Państwo potrzebować dokumentu w PDF, proszę napisać na info@keramickazahrada.cz — prześlę go.",
    preview: (invoice, order) => `Faktura ${invoice} do zamówienia ${order}.`,
    eyebrow: "Faktura",
    title: "Faktura",
    accent: "do Państwa zamówienia.",
    depositNote: (remaining) =>
      `Ta faktura dotyczy wpłaconej zaliczki. Do zapłaty pozostaje ${remaining} — o dopłatę poproszę, gdy egzemplarz będzie gotowy, i prześlę do niej drugą fakturę.`,
    order: "Zamówienie",
    invoiceNumber: "Numer faktury",
    commissionPayments: "Płatności za zamówienie indywidualne",
    depositWithInvoice: (invoice) => `Zaliczka (faktura ${invoice})`,
    deposit: "Zaliczka",
    balance: "Dopłata",
    surcharge: "Dopłata dodatkowa",
    totalPaid: "Łącznie zapłacono",
    itemsHeading: "Co Państwo zamówili",
    packaging: "Opakowanie",
    summary: "Podsumowanie",
    pickupInWorkshop: "Odbiór osobisty w pracowni",
    subtotal: "Suma częściowa",
    total: "Razem",
    download: "Pobierz fakturę (PDF)",
    viewOrder: "Zobacz zamówienie",
  },
  de: {
    amountLabel: { full: "Betrag", deposit: "Bezahlte Anzahlung", balance: "Bezahlte Restzahlung" },
    leadDeposit:
      "anbei sende ich Ihnen die Rechnung über die Anzahlung für Ihre Auftragsarbeit. Mehr brauche ich im Moment nicht von Ihnen – bewahren Sie den Beleg einfach auf.",
    leadBalance:
      "anbei sende ich Ihnen die Rechnung über die Restzahlung für Ihre Auftragsarbeit. Mehr brauche ich nicht von Ihnen – bewahren Sie den Beleg einfach auf.",
    leadFull:
      "anbei sende ich Ihnen die Rechnung zu Ihrer Bestellung. Mehr brauche ich nicht von Ihnen – bewahren Sie den Beleg einfach auf, falls Sie ihn einmal brauchen.",
    leadFullNoPdf:
      "zu Ihrer Bestellung habe ich eine Rechnung ausgestellt. Wenn Sie den Beleg als PDF brauchen, schreiben Sie mir an info@keramickazahrada.cz – ich schicke ihn Ihnen.",
    preview: (invoice, order) => `Rechnung ${invoice} zu Ihrer Bestellung ${order}.`,
    eyebrow: "Rechnung",
    title: "Rechnung",
    accent: "zu Ihrer Bestellung.",
    depositNote: (remaining) =>
      `Diese Rechnung betrifft die bezahlte Anzahlung. Offen sind noch ${remaining} – um die Restzahlung bitte ich Sie, sobald das Stück fertig ist, und schicke Ihnen dazu eine zweite Rechnung.`,
    order: "Bestellung",
    invoiceNumber: "Rechnungsnummer",
    commissionPayments: "Zahlungen zur Auftragsarbeit",
    depositWithInvoice: (invoice) => `Anzahlung (Rechnung ${invoice})`,
    deposit: "Anzahlung",
    balance: "Restzahlung",
    surcharge: "Aufpreis",
    totalPaid: "Insgesamt bezahlt",
    itemsHeading: "Was Sie bestellt haben",
    packaging: "Verpackung",
    summary: "Übersicht",
    pickupInWorkshop: "Abholung in der Werkstatt",
    subtotal: "Zwischensumme",
    total: "Gesamt",
    download: "Rechnung herunterladen (PDF)",
    viewOrder: "Bestellung ansehen",
  },
  en: {
    amountLabel: { full: "Amount", deposit: "Deposit paid", balance: "Balance paid" },
    leadDeposit:
      "Here is the invoice for the deposit on your commission. There's nothing else I need from you right now — just keep it for your records.",
    leadBalance:
      "Here is the invoice for the balance payment on your commission. There's nothing else I need from you — just keep it for your records.",
    leadFull:
      "Here is the invoice for your order. There's nothing else I need from you — just keep it in case you ever need it.",
    leadFullNoPdf:
      "I have issued an invoice for your order. If you need it as a PDF, just write to me at info@keramickazahrada.cz and I'll send it over.",
    preview: (invoice, order) => `Invoice ${invoice} for your order ${order}.`,
    eyebrow: "Invoice",
    title: "Invoice",
    accent: "for your order.",
    depositNote: (remaining) =>
      `This invoice covers the deposit you have paid. ${remaining} remains to be paid — I'll ask you for the balance once your piece is finished and send a second invoice with it.`,
    order: "Order",
    invoiceNumber: "Invoice number",
    commissionPayments: "Commission payments",
    depositWithInvoice: (invoice) => `Deposit (invoice ${invoice})`,
    deposit: "Deposit",
    balance: "Balance payment",
    surcharge: "Surcharge",
    totalPaid: "Total paid",
    itemsHeading: "What you ordered",
    packaging: "Packaging fee",
    summary: "Summary",
    pickupInWorkshop: "Collection in person at the studio",
    subtotal: "Subtotal",
    total: "Total",
    download: "Download invoice (PDF)",
    viewOrder: "View order",
  },
}

/** Výchozí české provedení — v cizojazyčném e-mailu nic neříká. */
const CZECH_DEFAULT_VARIANT = /^(standardní|standard|výchozí)$/i

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
  const t = useCopy(COPY)
  const ui = useUiCopy()
  const locale = useEmailLocale()
  const intl = useIntlLocale()
  const ks = piecesLabel(locale)
  const greeting = customerName ? ui.helloName(customerName) : ui.hello
  const itemVariant = (item: any): string => {
    const variant = String(item?.variant_title ?? "")
    return locale !== "cs" && CZECH_DEFAULT_VARIANT.test(variant.trim()) ? "" : variant
  }

  const formatter = order
    ? new Intl.NumberFormat(intl, {
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
      ? t.leadDeposit
      : invoiceKind === "balance"
        ? t.leadBalance
        : invoicePdfUrl
          ? t.leadFull
          : t.leadFullNoPdf

  return (
    <EmailLayout preview={t.preview(invoiceNumber, orderNumber)}>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <P>{greeting}</P>
      <P>{lead}</P>

      {invoiceKind === "deposit" && balanceRemaining ? (
        <Note tone="clay">{t.depositNote(balanceRemaining)}</Note>
      ) : null}

      {/* Doklad */}
      <Section style={{ margin: "24px 0 0" }}>
        {orderNumber ? <LedgerRow label={t.order} value={orderNumber} /> : null}
        {invoiceNumber ? (
          <LedgerRow label={t.invoiceNumber} value={invoiceNumber} />
        ) : null}
        {totalAmount ? (
          <LedgerRow
            label={t.amountLabel[invoiceKind]}
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
          <Eyebrow>{t.commissionPayments}</Eyebrow>
          {commissionPayments.deposit ? (
            <LedgerRow
              label={
                commissionPayments.depositInvoiceNumber
                  ? t.depositWithInvoice(commissionPayments.depositInvoiceNumber)
                  : t.deposit
              }
              value={commissionPayments.deposit}
            />
          ) : null}
          {commissionPayments.balance ? (
            <LedgerRow label={t.balance} value={commissionPayments.balance} />
          ) : null}
          {commissionPayments.surcharge ? (
            <LedgerRow label={t.surcharge} value={commissionPayments.surcharge} />
          ) : null}
          <LedgerRow
            label={t.totalPaid}
            value={commissionPayments.totalPaid}
            strong
            tone="olive"
          />
          <LedgerEnd />
        </Section>
      ) : null}

      {/* Výrobky — celý obsah objednávky, stejně jako v potvrzení objednávky. */}
      {order?.items?.length ? (
        <Section style={{ margin: "32px 0 0" }}>
          <Eyebrow>{t.itemsHeading}</Eyebrow>
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
                    {t.packaging}
                    {Number(item.quantity) > 1 ? ` · ${item.quantity} ${ks}` : ""}
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
                    alt={localizedLineTitle(item, locale)}
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
                  {localizedLineTitle(item, locale)}
                </Text>
                {itemVariant(item) ? (
                  <Text
                    style={{
                      fontFamily: brand.sans,
                      fontSize: "12px",
                      lineHeight: "18px",
                      color: brand.muted,
                      margin: "2px 0 0",
                    }}
                  >
                    {itemVariant(item)}
                    {item.quantity > 1 ? ` · ${item.quantity} ${ks}` : ""}
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
          <Eyebrow>{t.summary}</Eyebrow>
          <LedgerRow label={t.subtotal} value={formatPrice(itemsSubtotal)} />
          {order.shipping_methods?.map((method) => (
            <LedgerRow
              key={method.id}
              label={
                /* Názvy dopravy jsou česká data z administrace; osobní odběr se
                   v cizím jazyce pozná podle příznaku, dopravce zůstane jménem. */
                locale !== "cs" &&
                (method?.data as Record<string, unknown> | null)?.personal_pickup === true
                  ? t.pickupInWorkshop
                  : method.name
              }
              value={formatPrice(method.total)}
            />
          ))}
          {/* Příplatek zakázky není v ceně objednávky (žije v modulu výroby) —
              bez něj by „Celkem" nesedělo s tím, co zákazník zaplatil. */}
          {invoiceKind === "balance" && commissionPayments?.surcharge ? (
            <LedgerRow label={t.surcharge} value={commissionPayments.surcharge} />
          ) : null}
          <LedgerRow
            label={t.total}
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
            <EmailButton href={invoicePdfUrl}>{t.download}</EmailButton>
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
                {t.viewOrder}
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
      { id: "sm_1", name: "Osobní odběr v ateliéru", total: 0, data: { personal_pickup: true } },
    ],
  } as unknown as OrderDTO,
}

export default () => <InvoiceIssuedEmailComponent {...mockInvoiceIssued} />
