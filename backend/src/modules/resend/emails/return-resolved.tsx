import {
  ButtonRow,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  Greeting,
  LedgerEnd,
  LedgerRow,
  MultiLine,
  Note,
  P,
  Signature,
} from "../components/email-ui"

interface ReturnResolvedEmailProps {
  customerName?: string;
  orderNumber?: string;
  /** „reklamace" | „vraceni" | „odstoupeni". */
  kind?: string | null;
  /** „repair" | „replace" | „discount" | „refund". */
  resolution?: string | null;
  resolutionLabel?: string;
  /** Položky žádosti — řádek za položku („název · varianta · N ks · částka"). */
  items?: string;
  /** Vada vznikla přepravou (§11.3) — do potvrzení patří. */
  carrierDamage?: boolean;
  /** Datum vyřízení (formátované) — povinná náležitost potvrzení (§19/3 ZOS). */
  resolvedAt?: string;
  /** Vrácená částka celkem (formátovaná) — jen když se peníze vracely. */
  refundAmount?: string;
  /** „na platební kartu" / „ručně (hotově / převodem)". */
  refundMethod?: string;
  /** Text majitelky do potvrzení (volitelný). */
  note?: string;
  orderLink?: string;
  claimsUrl?: string;
  /** PDF „potvrzení o vyřízení". */
  protocolUrl?: string;
}

const OUTCOME: Record<string, string> = {
  repair: "Objekt je opravený a míří k vám zpět.",
  replace: "Posíláme vám nový kus.",
  discount: "Část ceny vám vracíme — objekt zůstává u vás.",
  refund: "Peníze vám vracíme stejnou cestou, jakou k nám platba přišla.",
}

/**
 * Potvrzení o vyřízení (docs/reklamace-a-zruseni.md §6): datum, způsob,
 * částka / oprava / výměna. U reklamace je to zákonná písemnost (§19/3 ZOS),
 * proto se posílá vždy — i když se žádné peníze nevracely.
 */
function ReturnResolvedEmailComponent({
  customerName,
  orderNumber = "",
  kind,
  resolution,
  resolutionLabel,
  items,
  carrierDamage = false,
  resolvedAt,
  refundAmount,
  refundMethod,
  note,
  orderLink = "",
  claimsUrl,
  protocolUrl,
}: ReturnResolvedEmailProps) {
  const isClaim = kind === "reklamace"
  const outcome = OUTCOME[resolution ?? "refund"] ?? OUTCOME.refund
  return (
    <EmailLayout
      preview={
        isClaim
          ? `Reklamace k objednávce ${orderNumber} je vyřízená.`
          : `Vrácení k objednávce ${orderNumber} je vyřízené.`
      }
    >
      <Eyebrow>{isClaim ? "Reklamace" : "Vrácení"}</Eyebrow>
      <EmailH1 accent="vyřízeno.">{isClaim ? "Reklamace" : "Vrácení"}</EmailH1>

      <Greeting name={customerName} />
      <P>
        {isClaim
          ? "vaše reklamace je vyřízená. Toto je písemné potvrzení o datu a způsobu vyřízení."
          : "vaše vrácení je vyřízené. Níže je shrnutí, jak jsme je uzavřeli."}
      </P>

      {orderNumber ? <LedgerRow label="Objednávka" value={orderNumber} /> : null}
      {items ? <LedgerRow label="Zboží" value={<MultiLine value={items} />} /> : null}
      {carrierDamage ? (
        <LedgerRow label="Příčina" value="Poškozeno přepravou" tone="clay" />
      ) : null}
      {resolvedAt ? <LedgerRow label="Vyřízeno dne" value={resolvedAt} /> : null}
      {resolutionLabel ? (
        <LedgerRow label="Způsob vyřízení" value={resolutionLabel} />
      ) : null}
      {refundAmount ? (
        <LedgerRow label="Vrácená částka" value={refundAmount} strong tone="olive" />
      ) : null}
      {refundAmount && refundMethod ? (
        <LedgerRow label="Vráceno" value={refundMethod} />
      ) : null}
      {note ? <LedgerRow label="Poznámka" value={note} /> : null}
      <LedgerEnd />

      <Note tone="olive">{outcome}</Note>

      {protocolUrl || claimsUrl || orderLink ? (
        <ButtonRow>
          {protocolUrl ? (
            <EmailButton href={protocolUrl}>Potvrzení o vyřízení (PDF)</EmailButton>
          ) : (
            <EmailButton href={claimsUrl || orderLink}>
              {claimsUrl ? "Stav žádosti" : "Zobrazit objednávku"}
            </EmailButton>
          )}
          {protocolUrl && (claimsUrl || orderLink) ? (
            <>
              <span style={{ display: "inline-block", width: "12px" }} />
              <EmailButton href={claimsUrl || orderLink} variant="ghost">
                {claimsUrl ? "Stav žádosti" : "Zobrazit objednávku"}
              </EmailButton>
            </>
          ) : null}
        </ButtonRow>
      ) : null}

      <P small>
        {refundAmount
          ? "Připsání peněz závisí na vaší bance, obvykle do několika pracovních dnů. "
          : ""}
        {isClaim
          ? "Nesouhlasíte-li s vyřízením, máte právo obrátit se na Českou obchodní inspekci (www.coi.cz), případně na soud. "
          : ""}
        Máte-li jakýkoli dotaz, stačí odpovědět na tento e-mail.
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const ReturnResolvedEmail = (props: ReturnResolvedEmailProps) => (
  <ReturnResolvedEmailComponent {...props} />
)

// Mock data for preview/development
const mockReturnResolved: ReturnResolvedEmailProps = {
  customerName: "Jan Novák",
  orderNumber: "#12345",
  kind: "odstoupeni",
  resolution: "refund",
  resolutionLabel: "vrácení peněz",
  resolvedAt: "7. 10. 2026",
  refundAmount: "1 250 Kč",
  refundMethod: "na platební kartu",
  orderLink: "https://keramickazahrada.cz/orders/12345",
}

export default () => <ReturnResolvedEmailComponent {...mockReturnResolved} />
