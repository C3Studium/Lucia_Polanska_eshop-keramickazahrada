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

function InvoiceIssuedEmailComponent({
  customerName = "Vážený zákazník",
  orderNumber = "#12345",
  invoiceNumber = "20260001",
  totalAmount = "2 450 Kč",
  invoicePdfUrl = "",
  orderLink = ""
}: InvoiceIssuedEmailProps) {
  return (
    <EmailLayout preview={`Faktura ${invoiceNumber} k objednávce ${orderNumber}.`}>
      <Eyebrow>Faktura</Eyebrow>
      <EmailH1 accent="k vaší objednávce.">Faktura</EmailH1>

      <Greeting name={customerName} />
      <P>
        posíláme fakturu k vaší objednávce. Nic dalšího od vás nepotřebujeme —
        doklad si jen uložte pro případ, že ho budete někdy potřebovat.
      </P>

      <LedgerRow label="Objednávka" value={orderNumber} />
      <LedgerRow label="Číslo faktury" value={invoiceNumber} />
      <LedgerRow label="Částka" value={totalAmount} strong tone="olive" />
      <LedgerEnd />

      {invoicePdfUrl ? (
        <ButtonRow>
          <EmailButton href={invoicePdfUrl}>Stáhnout fakturu (PDF)</EmailButton>
        </ButtonRow>
      ) : null}

      {orderLink ? (
        <P small>
          Stav objednávky můžete kdykoli sledovat ve svém účtu na našem webu.
        </P>
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
