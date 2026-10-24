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
  /** Poškozený kus (§13.7). */
  damagedItem?: boolean;
  /** Datum vyřízení (formátované) — povinná náležitost potvrzení (§19/3 ZOS). */
  resolvedAt?: string;
  /** Vrácená částka celkem (formátovaná) — jen když se peníze vracely. */
  refundAmount?: string;
  /** „stejnou cestou, jakou jste platili (přes ComGate) — na účtu do 3–5 pracovních dnů" / „ručně". */
  refundMethod?: string;
  /** Košík vrácení (§13.2) — řádek za řádek („název · N ks · částka"). */
  refundLines?: string;
  /** Dobropis (§13.3): číslo + odkaz na PDF, nebo věta, proč zatím není. */
  creditNoteNumber?: string;
  creditNoteUrl?: string;
  creditNoteNote?: string;
  /** Text majitelky do potvrzení (volitelný). */
  note?: string;
  orderLink?: string;
  claimsUrl?: string;
  /** PDF „potvrzení o vyřízení". */
  protocolUrl?: string;
}

const OUTCOME: Record<string, string> = {
  repair: "Kousek je opravený a míří k vám zpět.",
  replace: "Posílám vám nový kus.",
  discount: "Část ceny vám vracím — kousek zůstává u vás.",
  refund: "Peníze vám vracím stejnou cestou, jakou ke mně platba přišla.",
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
  damagedItem = false,
  resolvedAt,
  refundAmount,
  refundMethod,
  refundLines,
  creditNoteNumber,
  creditNoteUrl,
  creditNoteNote,
  note,
  orderLink = "",
  claimsUrl,
  protocolUrl,
}: ReturnResolvedEmailProps) {
  const isClaim = kind === "reklamace"
  // Rozdíl po zákaznické úpravě objednávky (druh `uprava`) — nic se fyzicky
  // nevracelo, jen peníze; „vrácení zboží" by mátlo.
  const isEdit = kind === "uprava"
  const outcome = OUTCOME[resolution ?? "refund"] ?? OUTCOME.refund
  // Způsob vrácení řídí i větu o připsání: karta má lhůtu banky, ruční
  // vrácení ne — slibovat „do několika dnů" u převodu, který majitelka teprve
  // zadá, by byla lež.
  const byCard = Boolean(refundMethod && /comgate|kart/i.test(refundMethod))
  return (
    <EmailLayout
      preview={
        isClaim
          ? `Reklamace k objednávce ${orderNumber} je vyřízená.`
          : isEdit
            ? `Rozdíl po úpravě objednávky ${orderNumber} jsem vám vrátila.`
            : `Vrácení k objednávce ${orderNumber} je vyřízené.`
      }
    >
      <Eyebrow>{isClaim ? "Reklamace" : isEdit ? "Úprava objednávky" : "Vrácení"}</Eyebrow>
      {isEdit ? (
        <EmailH1 accent="vrácen.">Rozdíl</EmailH1>
      ) : (
        <EmailH1 accent="vyřízeno.">{isClaim ? "Reklamace" : "Vrácení"}</EmailH1>
      )}

      <Greeting name={customerName} />
      <P>
        {isClaim
          ? "vaše reklamace je vyřízená. Toto je písemné potvrzení o datu a způsobu vyřízení."
          : isEdit
            ? "po vaší úpravě vyšla objednávka levněji — rozdíl jsem vám vrátila. Níže je shrnutí."
            : "vaše vrácení je vyřízené. Níže je shrnutí, jak jsem je uzavřela."}
      </P>

      {orderNumber ? <LedgerRow label="Objednávka" value={orderNumber} /> : null}
      {items ? <LedgerRow label="Zboží" value={<MultiLine value={items} />} /> : null}
      {carrierDamage ? (
        <LedgerRow label="Příčina" value="Poškozeno přepravou" tone="clay" />
      ) : null}
      {damagedItem ? (
        <LedgerRow label="Příčina" value="Poškozený kus" tone="clay" />
      ) : null}
      {resolvedAt ? <LedgerRow label="Vyřízeno dne" value={resolvedAt} /> : null}
      {resolutionLabel ? (
        <LedgerRow label="Způsob vyřízení" value={resolutionLabel} />
      ) : null}
      {refundLines ? (
        <LedgerRow label="Vrácené položky" value={<MultiLine value={refundLines} />} />
      ) : null}
      {refundAmount ? (
        <LedgerRow label="Vrácená částka" value={refundAmount} strong tone="olive" />
      ) : null}
      {refundAmount && refundMethod ? (
        <LedgerRow label="Vráceno" value={refundMethod} />
      ) : null}
      {creditNoteNumber ? (
        <LedgerRow label="Dobropis" value={`č. ${creditNoteNumber}`} />
      ) : null}
      {note ? <LedgerRow label="Poznámka" value={note} /> : null}
      <LedgerEnd />

      <Note tone="olive">{outcome}</Note>

      {protocolUrl || claimsUrl || orderLink || creditNoteUrl ? (
        <ButtonRow>
          {protocolUrl ? (
            <EmailButton href={protocolUrl}>Stáhnout potvrzení (PDF)</EmailButton>
          ) : claimsUrl || orderLink ? (
            <EmailButton href={claimsUrl || orderLink}>
              {claimsUrl ? "Sledovat stav žádosti" : "Zobrazit objednávku"}
            </EmailButton>
          ) : null}
          {protocolUrl && (claimsUrl || orderLink) ? (
            <>
              <span style={{ display: "inline-block", width: "12px" }} />
              <EmailButton href={claimsUrl || orderLink} variant="ghost">
                {claimsUrl ? "Sledovat stav žádosti" : "Zobrazit objednávku"}
              </EmailButton>
            </>
          ) : null}
          {creditNoteUrl ? (
            <>
              {protocolUrl || claimsUrl || orderLink ? (
                <span style={{ display: "inline-block", width: "12px" }} />
              ) : null}
              <EmailButton
                href={creditNoteUrl}
                variant={protocolUrl || claimsUrl || orderLink ? "ghost" : undefined}
              >
                Dobropis (PDF)
              </EmailButton>
            </>
          ) : null}
        </ButtonRow>
      ) : null}

      <P small>
        {refundAmount && byCard
          ? "Připsání peněz na účet záleží na vaší bance, obvykle do 3–5 pracovních dnů. "
          : refundAmount
            ? "Peníze vracím ručně (převodem na účet nebo hotově); pokud od vás budu potřebovat číslo účtu, ozvu se. "
            : ""}
        {creditNoteNote ? `${creditNoteNote} ` : ""}
        {isClaim
          ? "Nesouhlasíte-li s vyřízením, máte právo obrátit se na Českou obchodní inspekci (www.coi.cz), případně na soud. "
          : ""}
        Kdyby cokoli, napište mi na info@keramickazahrada.cz — odpovídám sama.
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
