import {
  ButtonRow,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  Greeting,
  LedgerEnd,
  LedgerRow,
  P,
  Signature,
} from "../components/email-ui"

interface InvoiceIssuedEmailProps {
  customerName?: string;
  orderNumber?: string;
  invoiceNumber?: string;
  totalAmount?: string;
  /** Our own copy of the PDF (MinIO) — empty when the upload failed. */
  invoicePdfUrl?: string;
  orderLink?: string;
}

/**
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
  orderLink = ""
}: InvoiceIssuedEmailProps) {
  return (
    <EmailLayout preview={`Faktura ${invoiceNumber} k objednávce ${orderNumber}.`}>
      <Eyebrow>Faktura</Eyebrow>
      <EmailH1 accent="k vaší objednávce.">Faktura</EmailH1>

      <Greeting name={customerName} />
      {invoicePdfUrl ? (
        <P>
          posíláme fakturu k vaší objednávce. Nic dalšího od vás
          nepotřebujeme — doklad si jen uložte pro případ, že ho budete
          někdy potřebovat.
        </P>
      ) : (
        <P>
          k vaší objednávce jsme vystavili fakturu. Kdybyste doklad
          potřebovali v PDF, stačí odpovědět na tento e-mail a pošleme
          vám ho.
        </P>
      )}

      {orderNumber ? <LedgerRow label="Objednávka" value={orderNumber} /> : null}
      {invoiceNumber ? (
        <LedgerRow label="Číslo faktury" value={invoiceNumber} />
      ) : null}
      {totalAmount ? (
        <LedgerRow label="Částka" value={totalAmount} strong tone="olive" />
      ) : null}
      <LedgerEnd />

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
  totalAmount: "2 450 Kč",
  invoicePdfUrl: "https://keramickazahrada.cz/faktura-20260042.pdf",
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed"
}

export default () => <InvoiceIssuedEmailComponent {...mockInvoiceIssued} />
