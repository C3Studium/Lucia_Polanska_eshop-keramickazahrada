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

interface RefundRequestEmailProps {
  customerName?: string;
  orderNumber?: string;
  /** „reklamace" | „vraceni" | „odstoupeni" — řídí nadpis, text i lhůtu. */
  kind?: string | null;
  refundAmount?: string;
  refundReason?: string;
  /** Jen reklamace: co zákazník požaduje (oprava / výměna / vrácení peněz). */
  requestedResolution?: string;
  /** Vybrané položky — řádek za položku („název · varianta · N ks · částka"). */
  items?: string;
  /** Balík dorazil poškozený (§11.3) — věta, že dopravce reklamujeme my. */
  carrierDamage?: boolean;
  orderLink?: string;
  /** Stav žádosti ve storefrontu (podepsaný odkaz z e-mailu). */
  claimsUrl?: string;
  /** „do 30 dnů od uplatnění reklamace" / „do 14 dnů". */
  deadlineText?: string;
  estimatedProcessingTime?: string;
  /** Odkaz na PDF reklamační protokol (zákonné potvrzení o uplatnění). */
  protocolUrl?: string;
}

/**
 * Texty podle druhu (docs/reklamace-a-zruseni.md §6). Výchozí větev je „vrácení
 * peněz" — tak se chovaly staré žádosti bez druhu.
 */
const COPY: Record<
  string,
  {
    eyebrow: string
    h1: string
    accent: string
    preview: (order: string) => string
    intro: string
    deadlineLabel: string
    note: string
  }
> = {
  reklamace: {
    eyebrow: "Reklamace",
    h1: "Reklamaci jsme",
    accent: "přijali.",
    preview: (order) => `Reklamaci k objednávce ${order} jsme přijali.`,
    intro:
      "vaši reklamaci jsme přijali a začínáme ji posuzovat. Přiložený protokol je písemným potvrzením o uplatnění reklamace.",
    deadlineLabel: "Vyřídíme",
    note: "Reklamaci vyřídíme bez zbytečného odkladu, nejpozději do 30 dnů. O rozhodnutí vám dáme vědět e-mailem.",
  },
  vraceni: {
    eyebrow: "Vrácení zboží",
    h1: "Žádost o vrácení",
    accent: "jsme přijali.",
    preview: (order) => `Žádost o vrácení zboží k objednávce ${order} jsme přijali.`,
    intro:
      "vaši žádost o vrácení zboží jsme přijali. Jakmile ji posoudíme, pošleme vám pokyny, kam zboží poslat.",
    deadlineLabel: "Peníze vracíme",
    note: "Peníze vracíme do 14 dnů; smíme počkat, než k nám zboží dorazí zpět.",
  },
  odstoupeni: {
    eyebrow: "Odstoupení od smlouvy",
    h1: "Odstoupení jsme",
    accent: "přijali.",
    preview: (order) => `Odstoupení od smlouvy k objednávce ${order} jsme přijali.`,
    intro:
      "potvrzujeme přijetí vašeho odstoupení od kupní smlouvy. Pokud už k vám zboží dorazilo, pošleme vám pokyny, kam ho vrátit.",
    deadlineLabel: "Peníze vracíme",
    note: "Peníze vracíme do 14 dnů od odstoupení; smíme počkat, než k nám zboží dorazí zpět (§ 1832 občanského zákoníku).",
  },
}

const FALLBACK = {
  eyebrow: "Vrácení peněz",
  h1: "Žádost jsme",
  accent: "přijali.",
  preview: (order: string) =>
    `Žádost o vrácení peněz k objednávce ${order} jsme přijali.`,
  intro:
    "vaši žádost o vrácení peněz jsme v pořádku přijali a začínáme ji vyřizovat.",
  deadlineLabel: "Doba vyřízení",
  note: "Žádost je u nás — pracujeme na ní a o vyřízení vám dáme vědět.",
}

/**
 * Částka se vykreslí jen s reálnou hodnotou — při přijetí žádosti ještě žádná
 * rozhodnutá není a vymyšlená výchozí částka by v ostrém e-mailu slibovala
 * konkrétní peníze.
 */
function RefundRequestEmailComponent({
  customerName,
  orderNumber = "",
  kind,
  refundAmount,
  refundReason,
  requestedResolution,
  items,
  carrierDamage = false,
  orderLink = "",
  claimsUrl,
  deadlineText,
  estimatedProcessingTime,
  protocolUrl,
}: RefundRequestEmailProps) {
  const copy = (kind && COPY[kind]) || FALLBACK
  const orderUrl = orderLink || storeLink()
  const deadline = deadlineText || estimatedProcessingTime || "3–5 pracovních dnů"
  return (
    <EmailLayout preview={copy.preview(orderNumber)}>
      <Eyebrow>{copy.eyebrow}</Eyebrow>
      <EmailH1 accent={copy.accent}>{copy.h1}</EmailH1>

      <Greeting name={customerName} />
      <P>{copy.intro}</P>

      {orderNumber ? <LedgerRow label="Objednávka" value={orderNumber} /> : null}
      {items ? <LedgerRow label="Zboží" value={<MultiLine value={items} />} /> : null}
      {refundReason ? <LedgerRow label="Důvod" value={refundReason} /> : null}
      {carrierDamage ? (
        <LedgerRow label="Příčina" value="Poškozeno přepravou" tone="clay" />
      ) : null}
      {requestedResolution ? (
        <LedgerRow label="Požadujete" value={requestedResolution} />
      ) : null}
      <LedgerRow label={copy.deadlineLabel} value={deadline} />
      {refundAmount ? (
        <LedgerRow label="Částka k vrácení" value={refundAmount} strong tone="olive" />
      ) : null}
      <LedgerEnd />

      <Note tone="olive">
        {copy.note}
        {carrierDamage
          ? " Poškození zásilky reklamujeme u dopravce my — vy nic dalšího řešit nemusíte, pro vás jde o běžnou reklamaci."
          : ""}
      </Note>

      {claimsUrl ? (
        <ButtonRow>
          <EmailButton href={claimsUrl}>Sledovat stav žádosti</EmailButton>
          {protocolUrl ? (
            <>
              <span style={{ display: "inline-block", width: "12px" }} />
              <EmailButton href={protocolUrl} variant="ghost">
                Protokol (PDF)
              </EmailButton>
            </>
          ) : null}
        </ButtonRow>
      ) : (
        <>
          {orderUrl ? (
            <ButtonRow>
              <EmailButton href={orderUrl}>Zobrazit objednávku</EmailButton>
            </ButtonRow>
          ) : null}
          {protocolUrl ? (
            <ButtonRow>
              <EmailButton href={protocolUrl}>Stáhnout protokol (PDF)</EmailButton>
            </ButtonRow>
          ) : null}
        </>
      )}

      <P small>
        Peníze vracíme stejnou cestou, jakou k nám platba přišla. Jakmile bude
        vše vyřízeno, pošleme vám písemné potvrzení e-mailem.
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
  kind: "reklamace",
  refundReason: "Prasklina na glazuře po prvním použití",
  requestedResolution: "oprava",
  deadlineText: "do 30 dnů od uplatnění reklamace",
  orderLink: "https://keramickazahrada.cz/orders/12345",
  claimsUrl: "https://keramickazahrada.cz/cz/order/order_12345/claims?token=abc",
}

export default () => <RefundRequestEmailComponent {...mockRefundRequest} />
