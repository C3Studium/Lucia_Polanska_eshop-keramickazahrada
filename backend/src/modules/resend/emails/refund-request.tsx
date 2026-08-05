import {
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

interface RefundRequestEmailProps {
  customerName?: string;
  orderNumber?: string;
  refundAmount?: string;
  refundReason?: string;
  orderLink?: string;
  estimatedProcessingTime?: string;
}

/**
 * Částka se vykreslí jen s reálnou hodnotou — při přijetí žádosti ještě žádná
 * rozhodnutá není a vymyšlená výchozí částka by v ostrém e-mailu slibovala
 * konkrétní peníze.
 */
function RefundRequestEmailComponent({
  customerName = "Vážený zákazník",
  orderNumber = "#12345",
  refundAmount,
  refundReason = "Požadavek zákazníka",
  orderLink = "https://keramickazahrada.cz/orders/12345",
  estimatedProcessingTime = "3–5 pracovních dnů",
}: RefundRequestEmailProps) {
  return (
    <EmailLayout
      preview={`Žádost o vrácení peněz k objednávce ${orderNumber} jsme přijali.`}
    >
      <Eyebrow>Vrácení peněz</Eyebrow>
      <EmailH1 accent="přijali.">Žádost jsme</EmailH1>

      <Greeting name={customerName} />
      <P>
        vaši žádost o vrácení peněz jsme v pořádku přijali a začínáme ji
        vyřizovat.
      </P>

      <LedgerRow label="Objednávka" value={orderNumber} />
      <LedgerRow label="Důvod" value={refundReason} />
      <LedgerRow label="Doba vyřízení" value={estimatedProcessingTime} />
      {refundAmount ? (
        <LedgerRow label="Částka k vrácení" value={refundAmount} strong tone="olive" />
      ) : null}
      <LedgerEnd />

      <Note tone="olive">
        Žádost je u nás — pracujeme na ní a o vyřízení vám dáme vědět.
      </Note>

      <ButtonRow>
        <EmailButton href={orderLink}>Zobrazit objednávku</EmailButton>
      </ButtonRow>

      <P small>
        Peníze vracíme stejnou cestou, jakou k nám platba přišla. Jakmile bude
        vše vyřízeno, pošleme vám potvrzení e-mailem.
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const RefundRequestEmail = (props: RefundRequestEmailProps) => (
  <RefundRequestEmailComponent {...props} />
)

// Mock data for preview/development
const mockRefundRequest: RefundRequestEmailProps = {
  customerName: "Jan Novák",
  orderNumber: "#12345",
  refundAmount: "1 250 Kč",
  refundReason: "Požadavek zákazníka",
  orderLink: "https://keramickazahrada.cz/orders/12345",
  estimatedProcessingTime: "3–5 pracovních dnů",
}

export default () => <RefundRequestEmailComponent {...mockRefundRequest} />
