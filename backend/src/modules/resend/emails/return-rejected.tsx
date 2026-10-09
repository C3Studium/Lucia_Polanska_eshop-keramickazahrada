import {
  ButtonRow,
  CONTACT_EMAIL,
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

interface ReturnRejectedEmailProps {
  customerName?: string;
  orderNumber?: string;
  returnNumber?: string;
  /** „reklamace" | „vraceni" | „odstoupeni". */
  kind?: string | null;
  /** Položky — řádek za položku („název · varianta · N ks · částka"), nebo slova zákazníka. */
  rejectedItems?: string;
  /** Totéž ze společného základu e-mailů (`claimEmailBase`) — záloha za `rejectedItems`. */
  items?: string;
  rejectionReason?: string;
  appealInstructions?: string;
  orderLink?: string;
  supportEmail?: string;
  /** Odkaz na PDF reklamační protokol (potvrzení o vyřízení / zamítnutí). */
  protocolUrl?: string;
}

/**
 * Číslo vrácení a seznam objektů se vykreslí jen s reálnými daty — vymyšlená
 * výchozí hodnota by v ostrém e-mailu tvrdila, že se zamítá něco jiného.
 *
 * Zamítnutí reklamace musí být písemně odůvodněno (§19/3 ZOS) a spotřebitel
 * má právo na mimosoudní řešení sporu u ČOI — obě věty jsou tu natvrdo, ať na
 * ně žádný volající nezapomene.
 */
function ReturnRejectedEmailComponent({
  customerName,
  orderNumber = "",
  returnNumber,
  kind,
  rejectedItems,
  items,
  rejectionReason,
  appealInstructions = "Ozvat se nám můžete kdykoli — rádi to s vámi probereme",
  orderLink = "",
  supportEmail = CONTACT_EMAIL,
  protocolUrl,
}: ReturnRejectedEmailProps) {
  const isClaim = kind === "reklamace"
  const objects = rejectedItems || items
  const eyebrow = isClaim ? "Reklamace" : "Vrácení"
  const h1 = isClaim ? "Reklamaci" : "Vrácení"
  const intro = isClaim
    ? "vaši reklamaci jsme pečlivě posoudili. Je nám líto, ale tentokrát ji nemůžeme uznat — odůvodnění uvádíme níže."
    : "vaši žádost o vrácení jsme pečlivě posoudili. Je nám líto, ale tentokrát jí nemůžeme vyhovět — důvod uvádíme níže."
  return (
    <EmailLayout
      preview={
        isClaim
          ? `Reklamaci k objednávce ${orderNumber} bohužel nemůžeme uznat.`
          : `Žádosti o vrácení k objednávce ${orderNumber} bohužel nemůžeme vyhovět.`
      }
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <EmailH1 accent="nemůžeme přijmout.">{h1}</EmailH1>

      <Greeting name={customerName} />
      <P>{intro}</P>

      {orderNumber ? <LedgerRow label="Objednávka" value={orderNumber} /> : null}
      {returnNumber ? <LedgerRow label="Vrácení" value={returnNumber} /> : null}
      {objects ? <LedgerRow label="Objekty" value={<MultiLine value={objects} />} /> : null}
      {rejectionReason ? (
        <LedgerRow label="Důvod zamítnutí" value={rejectionReason} tone="danger" />
      ) : null}
      <LedgerEnd />

      <P>
        Objekt zůstává váš. Pokud už k nám doputoval, pošleme vám ho zpět na
        adresu z objednávky.
      </P>

      <Note tone="danger">
        Žádosti jsme tentokrát nemohli vyhovět — pokud to vidíte jinak,
        ozvěte se nám a společně to probereme.
      </Note>

      <ButtonRow>
        <EmailButton href={`mailto:${supportEmail}`}>Napsat nám</EmailButton>
        {orderLink ? (
          <>
            <span style={{ display: "inline-block", width: "12px" }} />
            <EmailButton href={orderLink} variant="ghost">
              Zobrazit objednávku
            </EmailButton>
          </>
        ) : null}
      </ButtonRow>

      {protocolUrl ? (
        <ButtonRow>
          <EmailButton href={protocolUrl}>Stáhnout protokol (PDF)</EmailButton>
        </ButtonRow>
      ) : null}

      <P small>
        {appealInstructions}. Nesouhlasíte-li s vyřízením, máte právo obrátit
        se na Českou obchodní inspekci (www.coi.cz) jako subjekt mimosoudního
        řešení spotřebitelských sporů, případně na soud.
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const ReturnRejectedEmail = (props: ReturnRejectedEmailProps) => (
  <ReturnRejectedEmailComponent {...props} />
)

// Mock data for preview/development
const mockReturnRejected: ReturnRejectedEmailProps = {
  customerName: "Jan Novák",
  orderNumber: "#12345",
  kind: "reklamace",
  rejectedItems: "Keramický hrnek — modrý",
  rejectionReason: "Objekt nese stopy mechanického poškození, nejde o vadu výrobku",
  orderLink: "https://keramickazahrada.cz/orders/12345",
  supportEmail: CONTACT_EMAIL,
}

export default () => <ReturnRejectedEmailComponent {...mockReturnRejected} />
