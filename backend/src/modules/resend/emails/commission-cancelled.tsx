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
import { storeLink } from "../../../lib/storefront-url"

interface CommissionCancelledEmailProps {
  customerName?: string;
  orderNumber?: string;
  orderLink?: string;
  productTitle?: string | null;
  /** Před / po e-mailu „Zakázka je ve výrobě" (Z3). */
  phase?: "before_production" | "after_production";
  /** Kdo / co zrušení spustilo. */
  trigger?: "customer" | "unpaid_balance" | "seller";
  /** „20. 10. 2026 v 14:32" — kdy zrušení proběhlo. */
  cancelledAtText?: string;
  /** „15. 10. 2026 v 09:10" — kdy odešel e-mail o zahájení výroby (jen po zahájení). */
  productionStartedAtText?: string | null;
  /** Co bylo za zakázku zaplaceno (naformátované), nebo null = nic. */
  paidTotal?: string | null;
  /** Kolik vracíme (naformátované), null = nic. */
  refundAmount?: string | null;
  /** Záloha, která se nevrací (naformátované), null = žádná. */
  depositKept?: string | null;
  depositPercentage?: string | null;
  /** „stejnou cestou, jakou jste platili (přes ComGate)…" / „převodem…". */
  refundMethodText?: string | null;
  /** Potvrzení o vyřízení (PDF). */
  protocolUrl?: string | null;
}

/**
 * „Zakázka zrušena" (LEGAL_AUDIT.md § 0, Z4–Z7) — jediný zákaznický e-mail za
 * zrušení zakázky. Tři podoby:
 *  - před zahájením výroby (Z4): vracíme vše do 14 dnů stejnou cestou;
 *  - po zahájení (Z5): záloha se nevrací, vše nad ni vracíme / „není co vracet";
 *  - nezaplacený doplatek (Z6): totéž co Z5, s vysvětlením proč.
 * O penězích mluví jen podle skutečně vyčíslené refundace — nic se neslibuje
 * naprázdno (stejná zásada jako `order-cancelled`).
 */
function CommissionCancelledEmailComponent({
  customerName,
  orderNumber = "",
  orderLink = "",
  productTitle,
  phase = "before_production",
  trigger = "customer",
  cancelledAtText,
  productionStartedAtText,
  paidTotal,
  refundAmount,
  depositKept,
  depositPercentage,
  refundMethodText,
  protocolUrl,
}: CommissionCancelledEmailProps) {
  const orderUrl = orderLink || storeLink()
  const after = phase === "after_production"
  const keptText = depositKept
    ? depositPercentage
      ? `${depositKept} (${depositPercentage} %)`
      : depositKept
    : null
  const methodText =
    refundMethodText ?? "stejnou cestou, jakou k nám platba přišla"

  return (
    <EmailLayout preview={`Zakázku ${orderNumber} jsme zrušili.`}>
      <Eyebrow>Zakázková výroba</Eyebrow>
      <EmailH1 accent="zrušena.">Zakázka byla</EmailH1>

      <Greeting name={customerName} />

      {trigger === "unpaid_balance" ? (
        <P>
          doplatek za zakázku {orderNumber}
          {productTitle ? ` (${productTitle})` : ""} nebyl zaplacen do 30 dnů
          od výzvy ani po připomenutí. Podle obchodních podmínek (článek Výroba
          na zakázku) se tím zakázka ruší stejně, jako kdybyste ji zrušil(a)
          sám/sama po zahájení výroby. Doplatek už nepožadujeme.
        </P>
      ) : trigger === "seller" ? (
        <P>
          zakázku {orderNumber}
          {productTitle ? ` (${productTitle})` : ""} jsme museli zrušit z naší
          strany. Mrzí nás to — podle obchodních podmínek vám vracíme vše, co
          jste zaplatil(a).
        </P>
      ) : (
        <P>
          na vaši žádost jsme zrušili zakázku {orderNumber}
          {productTitle ? ` (${productTitle})` : ""}. Níže je, jak to je s
          penězi — řídí se tím, zda už výroba začala (obchodní podmínky, článek
          Výroba na zakázku).
        </P>
      )}

      {orderNumber ? <LedgerRow label="Objednávka" value={orderNumber} strong /> : null}
      {productTitle ? <LedgerRow label="Výrobek" value={productTitle} /> : null}
      {cancelledAtText ? <LedgerRow label="Zrušeno" value={cancelledAtText} /> : null}
      {after && productionStartedAtText ? (
        <LedgerRow label="Výroba zahájena" value={productionStartedAtText} />
      ) : null}
      {paidTotal ? <LedgerRow label="Zaplaceno" value={paidTotal} /> : null}
      {after && keptText ? (
        <LedgerRow label="Záloha (nevrací se)" value={keptText} tone="clay" />
      ) : null}
      {refundAmount ? (
        <LedgerRow label="Vracíme" value={refundAmount} strong tone="olive" />
      ) : null}
      <LedgerEnd />

      {!paidTotal ? (
        <>
          <Note tone="danger">Zakázka je zrušená. Nebylo nic zaplaceno — není co vracet.</Note>
        </>
      ) : !after ? (
        <>
          <Note tone="olive">
            Výroba ještě nezačala — vracíme vám vše, {refundAmount}, do 14 dnů.
          </Note>
          <P>
            Peníze pošleme {methodText}. Připsání závisí na vaší bance, obvykle
            jde o několik pracovních dnů.
          </P>
        </>
      ) : refundAmount ? (
        <>
          <Note tone="clay">
            Výroba už začala
            {productionStartedAtText ? ` (e-mail z ${productionStartedAtText})` : ""}
            , proto se záloha {keptText} nevrací. Vše nad zálohu — {refundAmount}
            — vám vrátíme do 14 dnů.
          </Note>
          <P>
            Peníze pošleme {methodText}. Záloha kryje materiál, návrh a čas,
            který už byl do vašeho kusu vložen; doplatek nepožadujeme a
            rozpracovaný výrobek zůstává v ateliéru.
          </P>
        </>
      ) : (
        <>
          <Note tone="clay">
            Výroba už začala
            {productionStartedAtText ? ` (e-mail z ${productionStartedAtText})` : ""}
            , proto se záloha {keptText} nevrací. Nad zálohu nebylo zaplaceno
            nic — není co vracet.
          </Note>
          <P>
            Doplatek nepožadujeme a rozpracovaný výrobek zůstává v ateliéru.
          </P>
        </>
      )}

      {protocolUrl ? (
        <P small>
          Potvrzení o vyřízení (PDF): <a href={protocolUrl}>{protocolUrl}</a>
        </P>
      ) : null}

      <P>
        Pokud jste o zrušení nežádal(a) nebo je vám cokoli nejasné, ozvěte se —
        stačí odpovědět na tento e-mail.
      </P>

      {orderUrl ? (
        <ButtonRow>
          <EmailButton href={orderUrl} variant="ghost">
            Zobrazit objednávku
          </EmailButton>
        </ButtonRow>
      ) : null}

      <Signature />
    </EmailLayout>
  )
}

export const CommissionCancelledEmail = (props: CommissionCancelledEmailProps) => (
  <CommissionCancelledEmailComponent {...props} />
)

// Mock data for preview/development
const mockCommissionCancelled: CommissionCancelledEmailProps = {
  customerName: "Jana Nováková",
  orderNumber: "#0042",
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed",
  productTitle: "Domovní číslo s motivem levandule",
  phase: "after_production",
  trigger: "customer",
  cancelledAtText: "22. 10. 2026 v 10:05",
  productionStartedAtText: "20. 10. 2026 v 14:32",
  paidTotal: "5 000 Kč",
  refundAmount: "3 750 Kč",
  depositKept: "1 250 Kč",
  depositPercentage: "25",
  refundMethodText:
    "stejnou cestou, jakou jste platili (přes ComGate) — na účtu do 3–5 pracovních dnů",
}

export default () => <CommissionCancelledEmailComponent {...mockCommissionCancelled} />
