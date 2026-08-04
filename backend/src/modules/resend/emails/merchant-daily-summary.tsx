import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Tailwind,
} from "@react-email/components";

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
    <Html>
      <Head />
      <Preview>{`Souhrn za ${date ?? "včerejšek"}: ${revenue ?? "—"}`}</Preview>
      <Tailwind>
        <Body className="bg-[#87986A] my-auto mx-auto font-sans">
          <Section className="border-b border-solid border-[#212222]">
            <div className="bg-[#ffff] text-white py-3 flex align-center justify-center">
              <img
                style={{ width: "80px", height: "80px", margin: "6px 0" }}
                src="https://c3studium.com/assets/icons/logo.svg"
                alt="Logo"
                className="w-[40px] h-[40px]"
              />
              <Heading className="text-[#212222] text-[26px] font-normal text-center p-0 my-[30px] mx-0">
                Keramická Zahrada
              </Heading>
            </div>
          </Section>

          <Container className="border border-solid border-[#212222] rounded-3xl my-[40px] mx-auto p-[20px] max-w-[600px] bg-white">
            <Section className="mt-6">
              <Text className="text-[#212222] text-[14px] uppercase m-2">
                Souhrn za {date ?? "včerejšek"}
              </Text>
              <Heading className="text-[#212222] text-[36px] font-normal text-left p-0 my-[10px] mx-2">
                {revenue ?? "—"}
              </Heading>
              <Text className="text-[#212222] text-[18px] leading-[26px] m-2">
                {paid_orders === 1
                  ? "1 zaplacená objednávka"
                  : `${paid_orders ?? 0} zaplacených objednávek`}
              </Text>
            </Section>

            <Section className="border-t border-solid border-[#212222] mt-6">
              <Text className="text-[#212222] text-[18px] leading-[26px] m-2 mt-6">
                {unfinishedTotal === 0
                  ? "Žádné nedokončené nákupy."
                  : `Nedokončené nákupy: ${unfinishedTotal}`}
              </Text>
              {unfinishedTotal > 0 && (
                <Text className="text-[#212222] text-[15px] leading-[22px] m-2">
                  {unfinished?.drafts ?? 0} rozepsaných objednávek ·{" "}
                  {unfinished?.abandoned_carts ?? 0} opuštěných košíků
                </Text>
              )}
            </Section>

            {admin_url && (
              <Section className="text-left mx-2 my-8">
                <Button
                  href={`${admin_url.replace(/\/+$/, "")}/app/prehled`}
                  className="bg-[#212222] text-white rounded-full px-6 py-3 text-[16px] no-underline"
                >
                  Otevřít Přehled
                </Button>
              </Section>
            )}

            <Section className="border-t border-solid border-[#212222] mt-8">
              <Text className="text-[#212222] text-[14px] leading-[20px] m-2">
                Tento souhrn chodí každé ráno automaticky.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export const merchantDailySummaryEmail = (
  props: MerchantDailySummaryEmailProps
) => <MerchantDailySummaryEmailComponent {...props} />;

// Mock data for preview/development
export default () => (
  <MerchantDailySummaryEmailComponent
    date="4. 8. 2026"
    revenue="4 780 Kč"
    paid_orders={3}
    unfinished={{ drafts: 1, abandoned_carts: 2, total: 3 }}
    admin_url="https://example.com"
  />
);
