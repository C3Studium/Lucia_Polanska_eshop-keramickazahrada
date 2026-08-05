import {
  ButtonRow,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  LedgerEnd,
  LedgerRow,
  Note,
  P,
} from "../components/email-ui"

/**
 * The 07:05 daily summary (WorkflowPlan.md D7).
 *
 * Deliberately lean, and that leanness is the decision: yesterday's takings,
 * how many purchases were left unfinished, and a link into the admin. It is
 * explicitly **not** an order report — a list of orders in an inbox competes
 * with Denní práce, which is where the work actually gets done.
 */
interface MerchantDailySummaryEmailProps {
  date?: string;
  revenue?: string;
  paid_orders?: number;
  unfinished?: { drafts?: number; abandoned_carts?: number; total?: number };
  admin_url?: string;
}

function MerchantDailySummaryEmailComponent({
  date,
  revenue,
  paid_orders,
  unfinished,
  admin_url,
}: MerchantDailySummaryEmailProps) {
  const unfinishedTotal = unfinished?.total ?? 0;

  return (
    <EmailLayout preview={`Souhrn za ${date ?? "včerejšek"}: ${revenue ?? "—"}`}>
      <Eyebrow>Ranní souhrn · {date ?? "včerejšek"}</Eyebrow>
      <EmailH1 accent="v číslech.">Včerejšek</EmailH1>

      <LedgerRow label="Tržba" value={revenue ?? "—"} strong tone="olive" />
      <LedgerRow label="Zaplacené objednávky" value={paid_orders ?? 0} />
      <LedgerRow
        label="Nedokončené nákupy"
        value={unfinishedTotal}
        tone={unfinishedTotal > 0 ? "clay" : undefined}
      />
      {unfinishedTotal > 0 && (
        <>
          <LedgerRow
            label="Rozepsané objednávky"
            value={unfinished?.drafts ?? 0}
          />
          <LedgerRow
            label="Opuštěné košíky"
            value={unfinished?.abandoned_carts ?? 0}
          />
        </>
      )}
      <LedgerEnd />

      {unfinishedTotal === 0 ? (
        <Note tone="olive">Žádné nedokončené nákupy.</Note>
      ) : null}

      {admin_url && (
        <ButtonRow>
          <EmailButton href={`${admin_url.replace(/\/+$/, "")}/app/prehled`}>
            Otevřít přehled
          </EmailButton>
        </ButtonRow>
      )}

      <P small>Tento souhrn chodí každé ráno automaticky.</P>
    </EmailLayout>
  );
}

export const merchantDailySummaryEmail = (
  props: MerchantDailySummaryEmailProps
) => <MerchantDailySummaryEmailComponent {...props} />;

// Mock data for preview/development
const mockDailySummary: MerchantDailySummaryEmailProps = {
  date: "4. 8. 2026",
  revenue: "4 780 Kč",
  paid_orders: 3,
  unfinished: { drafts: 1, abandoned_carts: 2, total: 3 },
  admin_url: "https://example.com",
};

export default () => (
  <MerchantDailySummaryEmailComponent {...mockDailySummary} />
);
