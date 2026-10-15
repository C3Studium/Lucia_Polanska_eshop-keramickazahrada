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
import { CARRIER_DAMAGE_CUSTOMER_TEXT } from "../../../lib/claims/constants"

interface RefundRequestEmailProps {
  customerName?: string;
  orderNumber?: string;
  /** „reklamace" | „vraceni" | „odstoupeni" — řídí nadpis, text i lhůtu. */
  kind?: string | null;
  refundAmount?: string;
  /**
   * Reklamace: popis vady (povinný). Odstoupení / vrácení: důvod, jen když ho
   * zákazník napsal (nepovinný — volající výchozí větu neposílá).
   */
  refundReason?: string;
  /** Jen reklamace: co zákazník požaduje (výměna / vrácení peněz). */
  requestedResolution?: string;
  /** Vybrané položky — řádek za položku („název · varianta · N ks · částka"). */
  items?: string;
  /**
   * Balík dorazil poškozený (§11.3) — věta, že škodu s dopravcem řešíme my
   * a zákazník nic dalšího podávat nemusí (14. 10. 2026, právní audit §4.1).
   */
  carrierDamage?: boolean;
  /** Poškozený kus (§13.7) — fotky jsou přiložené k žádosti. */
  damagedItem?: boolean;
  orderLink?: string;
  /** Stav žádosti ve storefrontu (podepsaný odkaz z e-mailu). */
  claimsUrl?: string;
  /** „nejpozději do 14. 11. 2026 (30 dnů od uplatnění reklamace)" apod. */
  deadlineText?: string;
  estimatedProcessingTime?: string;
  /** Odkaz na PDF reklamační protokol (zákonné potvrzení o uplatnění). */
  protocolUrl?: string;
  /**
   * Datum a čas odeslání žádosti, už naformátované v Europe/Prague
   * („15. 10. 2026 v 14:32"). U reklamace = okamžik uplatnění (§ 19 odst. 1
   * ZOS), u odstoupení online povinná součást potvrzení (NV 29/2023 pokyn [4]).
   */
  submittedAt?: string;
  /** Kudy žádost přišla („online na webu obchodu"). */
  submittedChannel?: string;
  /** Odstoupení / vrácení: datum objednání („3. 10. 2026"). */
  orderDate?: string;
  /** Odstoupení / vrácení: převzetí zboží slovy (datum, osobní odběr, odhad…). */
  takeoverText?: string;
  /** Odstoupení: zakázkové položky vyjmuté z odstoupení (§ 1837 písm. d). */
  excludedItems?: string;
  /** Odstoupení od CELÉ smlouvy (→ vracíme i náklady na dodání). */
  wholeOrder?: boolean;
  /** Zboží už odešlo → zákazník ho vrací; jinak nic neposílá. */
  goodsShipped?: boolean;
  /** Kam zboží vrátit („Lucie Polanská, Putim 229, 397 01 Písek"). */
  returnAddress?: string;
  /** Jak se peníze vrátí (karta / převod na zamaskovaný účet / není co vracet). */
  refundMethodText?: string;
  /** §13.1 — server objednávku rovnou zrušil (nezaplaceno, neodesláno). */
  autoCancelled?: boolean;
  /** Nic nebylo zaplaceno → v „co bude dál" se o vracení peněz nemluví. */
  nothingToRefund?: boolean;
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
    submittedLabel: string
    reasonLabel: string
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
      "vaši reklamaci jsme přijali a začínáme ji posuzovat. Tento e-mail je písemným potvrzením o jejím uplatnění — níže najdete, kdy jste ji uplatnili, čeho se týká a co požadujete.",
    submittedLabel: "Uplatněno",
    reasonLabel: "Popis vady",
    deadlineLabel: "Vyřídíme",
    note: "Reklamaci vyřídíme bez zbytečného odkladu, nejpozději do 30 dnů od jejího uplatnění. O výsledku vám dáme vědět e-mailem.",
  },
  vraceni: {
    eyebrow: "Vrácení zboží",
    h1: "Žádost o vrácení",
    accent: "jsme přijali.",
    preview: (order) => `Žádost o vrácení zboží k objednávce ${order} jsme přijali.`,
    intro:
      "vaši žádost o vrácení zboží jsme přijali. Jakmile ji posoudíme, pošleme vám pokyny, kam zboží poslat.",
    submittedLabel: "Odesláno",
    reasonLabel: "Důvod",
    deadlineLabel: "Peníze vracíme",
    note: "Peníze vracíme do 14 dnů; smíme počkat, než k nám zboží dorazí zpět, nebo než nám prokážete, že jste ho odeslali.",
  },
  odstoupeni: {
    eyebrow: "Odstoupení od smlouvy",
    h1: "Potvrzujeme přijetí",
    accent: "odstoupení.",
    preview: (order) =>
      `Potvrzujeme přijetí vašeho odstoupení od smlouvy k objednávce ${order}.`,
    intro:
      "potvrzujeme přijetí vašeho odstoupení od kupní smlouvy. Níže je celý obsah prohlášení, jak jsme ho od vás přijali, včetně data a času jeho odeslání.",
    submittedLabel: "Odesláno",
    reasonLabel: "Důvod",
    deadlineLabel: "Peníze vrátíme",
    note: "",
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
  submittedLabel: "Odesláno",
  reasonLabel: "Důvod",
  deadlineLabel: "Doba vyřízení",
  note: "Žádost je u nás — pracujeme na ní a o vyřízení vám dáme vědět.",
}

/** „Co teď" po odstoupení — podle toho, zda zboží odešlo a zda jde o celou smlouvu. */
const WithdrawalNextSteps = ({
  goodsShipped,
  wholeOrder,
  returnAddress,
  autoCancelled,
  nothingToRefund,
}: {
  goodsShipped: boolean
  wholeOrder: boolean
  returnAddress: string
  autoCancelled: boolean
  nothingToRefund: boolean
}) => {
  if (autoCancelled) {
    return (
      <Note tone="olive">
        Objednávka je zrušená. Nic jste nezaplatili a zboží jsme ještě
        neodeslali — nic nám neposílejte, není co vracet.
      </Note>
    )
  }
  const refundSentence = nothingToRefund
    ? "Zatím jste nic nezaplatili, takže není co vracet."
    : wholeOrder
      ? "Peníze vrátíme bez zbytečného odkladu, nejpozději do 14 dnů od odstoupení — kupní cenu i náklady na dodání ve výši nejlevnějšího způsobu dodání, který nabízíme."
      : "Peníze za uvedené zboží vrátíme bez zbytečného odkladu, nejpozději do 14 dnů od odstoupení."
  if (!goodsShipped) {
    return (
      <>
        <P>
          <strong>Co bude dál:</strong>{" "}
          {wholeOrder
            ? "zboží jsme ještě neodeslali — objednávku zastavíme a nic nám neposíláte."
            : "zboží jsme ještě neodeslali — uvedené kusy vám neposíláme, zbytek objednávky pošleme jako obvykle."}{" "}
          {refundSentence}
        </P>
      </>
    )
  }
  return (
    <>
      <P>
        <strong>Co bude dál:</strong>
      </P>
      <P>
        1. Zboží nám prosím pošlete zpět nebo předejte nejpozději do 14 dnů od
        odstoupení na adresu <strong>{returnAddress}</strong>. Lhůta je
        zachovaná, když zásilku odešlete před jejím uplynutím. Keramiku prosím
        pečlivě zabalte, nejlépe do původního obalu; přímé náklady na vrácení
        zboží nesete vy.
      </P>
      <P>
        2. {refundSentence}
        {nothingToRefund
          ? ""
          : " Peníze smíme vrátit až poté, co zboží obdržíme, nebo co nám prokážete, že jste ho odeslali — podle toho, co nastane dříve."}
      </P>
      <P>
        3. Odpovídáte jen za snížení hodnoty zboží, které vzniklo nakládáním
        s ním jinak, než je nutné k seznámení se s jeho povahou, vlastnostmi
        a funkčností.
      </P>
    </>
  )
}

/**
 * Potvrzení přijetí žádosti (reklamace / vrácení / odstoupení).
 *
 * - Odstoupení online (§ 1830a OZ): potvrzení „v textové podobě, včetně jeho
 *   obsahu a data a času jeho odeslání" (NV 29/2023 Sb., pokyn [4]) — zboží,
 *   rozsah, vyjmutá zakázka, důvod, způsob vrácení peněz, datum a čas, a co
 *   bude dál (vrácení zboží, lhůty, § 1832 a § 1833 OZ).
 * - Reklamace (§ 19 odst. 1 ZOS): datum a čas uplatnění, obsah (zboží, popis
 *   vady), požadovaný způsob vyřízení a 30denní lhůta od uplatnění.
 *
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
  damagedItem = false,
  orderLink = "",
  claimsUrl,
  deadlineText,
  estimatedProcessingTime,
  protocolUrl,
  submittedAt,
  submittedChannel,
  orderDate,
  takeoverText,
  excludedItems,
  wholeOrder = false,
  goodsShipped = false,
  returnAddress,
  refundMethodText,
  autoCancelled = false,
  nothingToRefund = false,
}: RefundRequestEmailProps) {
  const copy = (kind && COPY[kind]) || FALLBACK
  const orderUrl = orderLink || storeLink()
  const deadline = deadlineText || estimatedProcessingTime || "3–5 pracovních dnů"
  const isWithdrawal = kind === "odstoupeni"
  const isClaim = kind === "reklamace"
  return (
    <EmailLayout preview={copy.preview(orderNumber)}>
      <Eyebrow>{copy.eyebrow}</Eyebrow>
      <EmailH1 accent={copy.accent}>{copy.h1}</EmailH1>

      <Greeting name={customerName} />
      <P>{copy.intro}</P>

      {submittedAt ? (
        <LedgerRow label={copy.submittedLabel} value={submittedAt} strong />
      ) : null}
      {submittedAt && submittedChannel ? (
        <LedgerRow label="Způsob" value={submittedChannel} />
      ) : null}
      {orderNumber ? <LedgerRow label="Objednávka" value={orderNumber} /> : null}
      {orderDate ? <LedgerRow label="Datum objednání" value={orderDate} /> : null}
      {takeoverText ? <LedgerRow label="Převzetí zboží" value={takeoverText} /> : null}
      {isWithdrawal ? (
        <LedgerRow
          label="Rozsah"
          value={wholeOrder ? "odstoupení od celé smlouvy" : "odstoupení jen od uvedeného zboží"}
        />
      ) : null}
      {items ? (
        <LedgerRow
          label={isWithdrawal ? "Odstupujete od" : "Zboží"}
          value={<MultiLine value={items} />}
        />
      ) : null}
      {excludedItems ? (
        <LedgerRow
          label="Vyjmuto (zakázka)"
          value={<MultiLine value={excludedItems} />}
          tone="clay"
        />
      ) : null}
      {refundReason ? <LedgerRow label={copy.reasonLabel} value={refundReason} /> : null}
      {carrierDamage ? (
        <LedgerRow label="Příčina" value="Poškozeno přepravou" tone="clay" />
      ) : null}
      {damagedItem ? (
        <LedgerRow label="Příčina" value="Poškozený kus" tone="clay" />
      ) : null}
      {requestedResolution ? (
        <LedgerRow label="Požadujete" value={requestedResolution} />
      ) : null}
      {refundMethodText ? (
        <LedgerRow label="Vrácení peněz" value={refundMethodText} />
      ) : null}
      {autoCancelled ? null : <LedgerRow label={copy.deadlineLabel} value={deadline} />}
      {refundAmount ? (
        <LedgerRow label="Částka k vrácení" value={refundAmount} strong tone="olive" />
      ) : null}
      <LedgerEnd />

      {isWithdrawal ? (
        <WithdrawalNextSteps
          goodsShipped={goodsShipped}
          wholeOrder={wholeOrder}
          returnAddress={returnAddress || "Lucie Polanská, Putim 229, 397 01 Písek"}
          autoCancelled={autoCancelled}
          nothingToRefund={nothingToRefund}
        />
      ) : autoCancelled ? (
        <Note tone="olive">
          Objednávka je zrušená. Nic jste nezaplatili a zboží jsme ještě
          neodeslali — nic nám neposílejte, není co vracet.
        </Note>
      ) : (
        <Note tone="olive">{copy.note}</Note>
      )}

      {excludedItems ? (
        <Note tone="clay">
          Zboží vyrobené na zakázku podle vašeho zadání z odstoupení vyjímáme —
          u něj zákon odstoupení nepřipouští (§ 1837 písm. d) občanského
          zákoníku). Má-li vadu, můžete ho reklamovat.
        </Note>
      ) : null}

      {carrierDamage ? <Note tone="clay">{CARRIER_DAMAGE_CUSTOMER_TEXT}</Note> : null}

      {isClaim && protocolUrl ? (
        <P small>
          Protokol o uplatnění reklamace se stejnými údaji si můžete stáhnout
          jako PDF — odkaz je na tlačítku níže.
        </P>
      ) : null}

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
        {refundMethodText
          ? "Jakmile bude vše vyřízeno, pošleme vám písemné potvrzení e-mailem."
          : "Peníze vracíme stejnou cestou, jakou k nám platba přišla. Jakmile bude vše vyřízeno, pošleme vám písemné potvrzení e-mailem."}
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
  kind: "odstoupeni",
  submittedAt: "15. 10. 2026 v 14:32",
  submittedChannel: "online na webu obchodu",
  orderDate: "3. 10. 2026",
  takeoverText: "7. 10. 2026",
  items: "Zahradní mísa · Ø 32 cm · 1 ks · 1 305 Kč",
  wholeOrder: true,
  goodsShipped: true,
  returnAddress: "Lucie Polanská, Putim 229, 397 01 Písek",
  refundMethodText:
    "Stejným platebním prostředkem, jakým jste platili — zpět na kartu (platba přes ComGate).",
  deadlineText: "nejpozději do 29. 10. 2026 (14 dnů od odstoupení)",
  orderLink: "https://keramickazahrada.cz/orders/12345",
  claimsUrl: "https://keramickazahrada.cz/cz/order/order_12345/claims?token=abc",
}

export default () => <RefundRequestEmailComponent {...mockRefundRequest} />
