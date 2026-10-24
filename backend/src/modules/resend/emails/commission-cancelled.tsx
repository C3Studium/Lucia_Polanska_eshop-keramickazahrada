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
    refundMethodText ?? "stejnou cestou, jakou ke mně platba přišla"

  return (
    <EmailLayout preview={`Zakázka ${orderNumber} je zrušená — tady je, jak to je s penězi.`}>
      <Eyebrow>Zakázka</Eyebrow>
      <EmailH1 accent="zrušená.">Zakázka je</EmailH1>

      <Greeting name={customerName} />

      {trigger === "unpaid_balance" ? (
        <P>
          doplatek za zakázku {orderNumber}
          {productTitle ? ` (${productTitle})` : ""} nedorazil do 30 dnů od
          výzvy ani po připomenutí. Podle obchodních podmínek (článek Výroba na
          zakázku) se tím zakázka ruší stejně, jako kdybyste ji zrušili
          sám/sama po zahájení výroby. Doplatek už po vás nechci.
        </P>
      ) : trigger === "seller" ? (
        <P>
          zakázku {orderNumber}
          {productTitle ? ` (${productTitle})` : ""} musím zrušit ze své
          strany. Moc mě to mrzí — podle obchodních podmínek vám vracím všechno,
          co jste zaplatili.
        </P>
      ) : (
        <P>
          na vaši žádost jsem zrušila zakázku {orderNumber}
          {productTitle ? ` (${productTitle})` : ""}. Níže píšu, jak to je
          s penězi — záleží na tom, zda už výroba začala (obchodní podmínky,
          článek Výroba na zakázku).
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
        <LedgerRow label="Vrátím vám" value={refundAmount} strong tone="olive" />
      ) : null}
      <LedgerEnd />

      {!paidTotal ? (
        <>
          <Note tone="danger">Zakázka je zrušená. Zaplaceno nebylo nic, takže není co vracet.</Note>
        </>
      ) : !after ? (
        <>
          <Note tone="olive">
            Výroba ještě nezačala — vrátím vám všechno, {refundAmount}, do 14 dnů.
          </Note>
          <P>
            Peníze pošlu {methodText}. Kdy se připíšou, záleží na vaší bance —
            obvykle je to několik pracovních dnů.
          </P>
        </>
      ) : refundAmount ? (
        <>
          <Note tone="clay">
            Výroba už začala
            {productionStartedAtText ? ` (e-mail z ${productionStartedAtText})` : ""}
            , proto se záloha {keptText} nevrací. Všechno nad zálohu — {refundAmount}
            — vám vrátím do 14 dnů.
          </Note>
          <P>
            Peníze pošlu {methodText}. Záloha kryje materiál, návrh a čas, který
            už jsem do vašeho kousku vložila; doplatek po vás nechci a
            rozpracovaný výrobek zůstává u mě v dílně.
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
            Doplatek po vás nechci a rozpracovaný výrobek zůstává u mě v dílně.
          </P>
        </>
      )}

      {protocolUrl ? (
        <P small>
          Potvrzení o vyřízení (PDF): <a href={protocolUrl}>{protocolUrl}</a>
        </P>
      ) : null}

      <P>
        Pokud jste o zrušení nežádali nebo vám cokoli nesedí, napište mi na info@keramickazahrada.cz, odpovídám sama.
      </P>

      {orderUrl ? (
        <ButtonRow>
          <EmailButton href={orderUrl} variant="ghost">
            Zobrazit objednávku
          </EmailButton>
        </ButtonRow>
      ) : null}

      <Signature
        closing={
          trigger === "seller" ? "Omlouvám se a děkuji za pochopení," : "Přeji hezký den,"
        }
      />
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
