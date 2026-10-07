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

interface ReturnReceivedEmailProps {
  customerName?: string;
  orderNumber?: string;
  /** „reklamace" | „vraceni" | „odstoupeni". */
  kind?: string | null;
  /** Rozhodnutí při schválení („repair" | „replace" | „discount" | „refund"). */
  resolution?: string | null;
  resolutionLabel?: string;
  /** Datum přijetí zásilky (formátované). */
  receivedAt?: string;
  /** Poznámka majitelky k přijetí (volitelná, zákazník ji vidí). */
  note?: string;
  orderLink?: string;
  claimsUrl?: string;
  protocolUrl?: string;
}

/** Co se děje dál — podle rozhodnutí. */
const NEXT: Record<string, string> = {
  repair: "Objekt teď opravíme a pošleme vám ho zpět. Jakmile bude na cestě, dáme vám vědět.",
  replace: "Připravujeme pro vás nový kus. Jakmile bude na cestě, dáme vám vědět.",
  discount: "Zkontrolujeme stav a vrátíme vám dohodnutou část ceny.",
  refund: "Zkontrolujeme stav a vrátíme vám peníze stejnou cestou, jakou k nám platba přišla.",
}

/**
 * „Zboží k nám dorazilo, kontrolujeme" (docs/reklamace-a-zruseni.md §6).
 * Krátký mezikrok — zákazník ví, že zásilka došla a že se nic neztratilo.
 */
function ReturnReceivedEmailComponent({
  customerName,
  orderNumber = "",
  kind,
  resolution,
  resolutionLabel,
  receivedAt,
  note,
  orderLink = "",
  claimsUrl,
  protocolUrl,
}: ReturnReceivedEmailProps) {
  const isClaim = kind === "reklamace"
  const next = NEXT[resolution ?? "refund"] ?? NEXT.refund
  return (
    <EmailLayout preview={`Zásilka k objednávce ${orderNumber} k nám dorazila.`}>
      <Eyebrow>{isClaim ? "Reklamace" : "Vrácení"}</Eyebrow>
      <EmailH1 accent="dorazilo.">Zboží k nám</EmailH1>

      <Greeting name={customerName} />
      <P>
        vrácená zásilka k nám v pořádku dorazila. Objekt teď kontrolujeme a
        pokračujeme ve vyřízení.
      </P>

      {orderNumber ? <LedgerRow label="Objednávka" value={orderNumber} /> : null}
      {receivedAt ? <LedgerRow label="Přijato" value={receivedAt} /> : null}
      {resolutionLabel ? (
        <LedgerRow label="Způsob vyřízení" value={resolutionLabel} />
      ) : null}
      {note ? <LedgerRow label="Poznámka" value={note} /> : null}
      <LedgerEnd />

      <Note tone="olive">{next}</Note>

      {claimsUrl || orderLink ? (
        <ButtonRow>
          <EmailButton href={claimsUrl || orderLink}>
            {claimsUrl ? "Stav žádosti" : "Zobrazit objednávku"}
          </EmailButton>
          {protocolUrl ? (
            <>
              <span style={{ display: "inline-block", width: "12px" }} />
              <EmailButton href={protocolUrl} variant="ghost">
                Protokol (PDF)
              </EmailButton>
            </>
          ) : null}
        </ButtonRow>
      ) : null}

      <P small>
        O vyřízení vám pošleme písemné potvrzení e-mailem. Máte-li jakýkoli
        dotaz, stačí odpovědět na tento e-mail.
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const ReturnReceivedEmail = (props: ReturnReceivedEmailProps) => (
  <ReturnReceivedEmailComponent {...props} />
)

// Mock data for preview/development
const mockReturnReceived: ReturnReceivedEmailProps = {
  customerName: "Jan Novák",
  orderNumber: "#12345",
  kind: "reklamace",
  resolution: "repair",
  resolutionLabel: "oprava",
  receivedAt: "7. 10. 2026",
  orderLink: "https://keramickazahrada.cz/orders/12345",
}

export default () => <ReturnReceivedEmailComponent {...mockReturnReceived} />
