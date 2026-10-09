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
import { storeLink } from "../../../lib/storefront-url"

interface ReturnApprovedEmailProps {
  customerName?: string;
  orderNumber?: string;
  returnNumber?: string;
  /** „reklamace" | „vraceni" | „odstoupeni". */
  kind?: string | null;
  /** Rozhodnutí: „repair" | „replace" | „discount" | „refund" (odstoupení/vrácení = refund). */
  resolution?: string | null;
  /** Český popisek rozhodnutí („oprava", „výměna za nový kus", …). */
  resolutionLabel?: string;
  /** Položky — řádek za položku („název · varianta · N ks · částka"), nebo slova zákazníka. */
  approvedItems?: string;
  /** Totéž ze společného základu e-mailů (`claimEmailBase`) — záloha za `approvedItems`. */
  items?: string;
  /** Balík dorazil poškozený (§11.3). */
  carrierDamage?: boolean;
  returnReason?: string;
  returnMethod?: string;
  returnDeadline?: string;
  /** Adresa z nastavení (víceřádkově). Bez ní se řádek nevykreslí. */
  returnAddress?: string;
  /** Pokyny z nastavení (volitelné). */
  returnInstructions?: string;
  /** Musí zboží cestovat zpět? (ne u slevy — zboží zůstává zákazníkovi) */
  goodsReturnRequired?: boolean;
  /** Odstoupení před odesláním — zboží nikdy neodešlo, nic se neposílá. */
  nothingToReturn?: boolean;
  orderLink?: string;
  claimsUrl?: string;
  /** Odkaz na PDF reklamační protokol s rozhodnutím. */
  protocolUrl?: string;
}

/** Co bude následovat — podle rozhodnutí (docs/reklamace-a-zruseni.md §6). */
const NEXT_STEP: Record<string, string> = {
  repair:
    "Objekt opravíme a pošleme vám ho zpět. O přijetí zásilky i o odeslání opraveného kusu vás budeme informovat e-mailem.",
  replace:
    "Jakmile k nám objekt dorazí, pošleme vám nový kus. O přijetí zásilky i o odeslání výměny vás budeme informovat e-mailem.",
  discount:
    "Objekt zůstává u vás a část ceny vám vrátíme stejnou cestou, jakou k nám platba přišla. Nic posílat nemusíte.",
  refund:
    "Jakmile k nám objekty dorazí a projdou kontrolou, vrátíme vám peníze stejnou cestou, jakou k nám platba přišla.",
}

/**
 * Číslo vrácení a seznam objektů se vykreslí jen s reálnými daty — vymyšlená
 * výchozí hodnota by v ostrém e-mailu tvrdila, že se vrací něco jiného.
 * Adresa a pokyny přicházejí z nastavení obchodu; šablona žádnou nevymýšlí.
 */
function ReturnApprovedEmailComponent({
  customerName,
  orderNumber = "",
  returnNumber,
  kind,
  resolution,
  resolutionLabel,
  approvedItems,
  items,
  carrierDamage = false,
  returnReason,
  returnMethod = "Zásilka na adresu ateliéru",
  returnDeadline,
  returnAddress,
  returnInstructions,
  goodsReturnRequired,
  nothingToReturn = false,
  orderLink = "",
  claimsUrl,
  protocolUrl,
}: ReturnApprovedEmailProps) {
  const orderUrl = orderLink || storeLink()
  const isClaim = kind === "reklamace"
  const outcome = resolution ?? "refund"
  const objects = approvedItems || items
  // Zboží se vrací vždy, kromě slevy; starší volající bez vlajky = vrací se.
  const goodsBack = !nothingToReturn && (goodsReturnRequired ?? outcome !== "discount")
  const eyebrow = isClaim ? "Reklamace" : "Vrácení"
  const h1 = isClaim ? "Reklamace" : nothingToReturn ? "Objednávka" : "Vrácení"
  const accent = isClaim ? "uznána." : nothingToReturn ? "zrušena." : "schváleno."
  const intro = isClaim
    ? "vaši reklamaci jsme posoudili a uznali. Níže najdete, jak ji vyřídíme a co bude následovat."
    : nothingToReturn
      ? "vaší žádosti jsme vyhověli. Objednávka k vám ještě neodešla, takže nic posílat nemusíte — rušíme ji."
      : "vaší žádosti o vrácení jsme vyhověli. Níže najdete vše potřebné — kam objekty poslat a dokdy."
  const deadline =
    returnDeadline ||
    (isClaim ? "vyřídíme do 30 dnů od uplatnění" : "peníze vrátíme do 14 dnů od přijetí zboží")

  return (
    <EmailLayout
      preview={
        isClaim
          ? `Reklamaci k objednávce ${orderNumber} jsme uznali.`
          : `Vrácení k objednávce ${orderNumber} jsme schválili.`
      }
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <EmailH1 accent={accent}>{h1}</EmailH1>

      <Greeting name={customerName} />
      <P>{intro}</P>

      {orderNumber ? <LedgerRow label="Objednávka" value={orderNumber} /> : null}
      {returnNumber ? <LedgerRow label="Vrácení" value={returnNumber} /> : null}
      {objects ? <LedgerRow label="Objekty" value={<MultiLine value={objects} />} /> : null}
      {returnReason ? <LedgerRow label="Důvod" value={returnReason} /> : null}
      {carrierDamage ? (
        <LedgerRow label="Příčina" value="Poškozeno přepravou" tone="clay" />
      ) : null}
      {resolutionLabel ? (
        <LedgerRow label="Způsob vyřízení" value={resolutionLabel} strong tone="olive" />
      ) : null}
      {goodsBack ? <LedgerRow label="Způsob vrácení" value={returnMethod} /> : null}
      {goodsBack && returnAddress ? (
        <LedgerRow
          label="Adresa"
          value={returnAddress.split("\n").map((line, index) => (
            <span key={index}>
              {line}
              <br />
            </span>
          ))}
        />
      ) : null}
      <LedgerRow label="Lhůta" value={deadline} strong tone="clay" />
      <LedgerEnd />

      <Note tone="olive">
        {nothingToReturn
          ? "Nic posílat nemusíte. Pokud jste už něco zaplatili, vrátíme to stejnou cestou, jakou k nám platba přišla; jinak je tím vše vyřízené."
          : (NEXT_STEP[outcome] ?? NEXT_STEP.refund)}
        {carrierDamage
          ? " Poškození při přepravě reklamujeme u dopravce my — vás se to netýká."
          : ""}
      </Note>

      {claimsUrl || orderUrl ? (
        <ButtonRow>
          <EmailButton href={claimsUrl || orderUrl}>
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
      ) : protocolUrl ? (
        <ButtonRow>
          <EmailButton href={protocolUrl}>Stáhnout protokol (PDF)</EmailButton>
        </ButtonRow>
      ) : null}

      {goodsBack ? (
        <P small>
          {returnInstructions ? `${returnInstructions} ` : ""}
          Kousky prosím pečlivě zabalte, ať cestu zpět přečkají ve zdraví, a
          přiložte číslo objednávky. Číslo zásilky nám můžete zapsat na
          stránce žádosti. O přijetí zásilky vás budeme informovat e-mailem.
        </P>
      ) : null}
      <Signature />
    </EmailLayout>
  )
}

export const ReturnApprovedEmail = (props: ReturnApprovedEmailProps) => (
  <ReturnApprovedEmailComponent {...props} />
)

// Mock data for preview/development
const mockReturnApproved: ReturnApprovedEmailProps = {
  customerName: "Jan Novák",
  orderNumber: "#12345",
  kind: "vraceni",
  resolution: "refund",
  resolutionLabel: "vrácení peněz",
  approvedItems: "Keramický hrnek — modrý, Keramický talíř — bílý",
  returnReason: "Požadavek zákazníka",
  returnMethod: "Zásilka na adresu ateliéru",
  returnDeadline: "peníze vrátíme do 14 dnů od přijetí zboží",
  returnAddress: "Keramická zahrada\nPutim 229\n397 01 Písek",
  returnInstructions: "Přiložte prosím číslo objednávky.",
  orderLink: "https://keramickazahrada.cz/orders/12345",
}

export default () => <ReturnApprovedEmailComponent {...mockReturnApproved} />
