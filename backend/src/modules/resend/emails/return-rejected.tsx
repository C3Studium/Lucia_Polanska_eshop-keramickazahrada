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
  appealInstructions = "Ozvat se mi můžete kdykoli — ráda to s vámi proberu",
  orderLink = "",
  supportEmail = CONTACT_EMAIL,
  protocolUrl,
}: ReturnRejectedEmailProps) {
  const isClaim = kind === "reklamace"
  const objects = rejectedItems || items
  const eyebrow = isClaim ? "Reklamace" : "Vrácení"
  const h1 = isClaim ? "Reklamaci" : "Vrácení"
  const intro = isClaim
    ? "vaši reklamaci jsem pečlivě posoudila. Je mi líto, ale tentokrát ji nemohu uznat — proč, píšu níže."
    : "vaši žádost o vrácení jsem pečlivě posoudila. Je mi líto, ale tentokrát jí nemohu vyhovět — důvod uvádím níže."
  return (
    <EmailLayout
      preview={
        isClaim
          ? `Reklamaci k objednávce ${orderNumber} bohužel nemohu uznat.`
          : `Žádosti o vrácení k objednávce ${orderNumber} bohužel nemohu vyhovět.`
      }
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <EmailH1 accent="nemohu přijmout.">{h1}</EmailH1>

      <Greeting name={customerName} />
      <P>{intro}</P>

      {orderNumber ? <LedgerRow label="Objednávka" value={orderNumber} /> : null}
      {returnNumber ? <LedgerRow label="Vrácení" value={returnNumber} /> : null}
      {objects ? <LedgerRow label="Zboží" value={<MultiLine value={objects} />} /> : null}
      {rejectionReason ? (
        <LedgerRow label="Důvod zamítnutí" value={rejectionReason} tone="danger" />
      ) : null}
      <LedgerEnd />

      <P>
        Kousek zůstává váš. Pokud už ke mně doputoval, pošlu vám ho zpět na
        adresu z objednávky.
      </P>

      <Note tone="danger">
        Vím, že to není zpráva, kterou jste čekali. Pokud to vidíte jinak,
        napište mi — ráda si vaše důvody ještě vyslechnu.
      </Note>

      <ButtonRow>
        <EmailButton href={`mailto:${supportEmail}`}>Napsat Lucii</EmailButton>
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
  rejectionReason: "Kousek nese stopy mechanického poškození, nejde o vadu výrobku",
  orderLink: "https://keramickazahrada.cz/orders/12345",
  supportEmail: CONTACT_EMAIL,
}

export default () => <ReturnRejectedEmailComponent {...mockReturnRejected} />
