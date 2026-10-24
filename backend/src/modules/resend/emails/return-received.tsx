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
  repair: "Kousek teď opravím a pošlu vám ho zpět. Jakmile bude na cestě, dám vám vědět.",
  replace: "Připravuji pro vás nový kus. Jakmile bude na cestě, dám vám vědět.",
  discount: "Prohlédnu si ho a vrátím vám dohodnutou část ceny.",
  refund: "Prohlédnu si ho a vrátím vám peníze stejnou cestou, jakou ke mně platba přišla.",
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
    <EmailLayout preview={`Zásilka k objednávce ${orderNumber} ke mně dorazila.`}>
      <Eyebrow>{isClaim ? "Reklamace" : "Vrácení"}</Eyebrow>
      <EmailH1 accent="dorazilo.">Zboží ke mně</EmailH1>

      <Greeting name={customerName} />
      <P>
        vrácená zásilka ke mně v pořádku dorazila — nic se neztratilo. Kousek
        si teď prohlédnu a pokračuji ve vyřízení.
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
            {claimsUrl ? "Sledovat stav žádosti" : "Zobrazit objednávku"}
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
        O vyřízení vám pošlu písemné potvrzení e-mailem. Kdyby cokoli, napište mi na info@keramickazahrada.cz — odpovídám sama.
      </P>
      <Signature closing="Děkuji za trpělivost," />
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
