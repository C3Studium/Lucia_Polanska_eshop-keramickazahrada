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
 * The merchant's own notification e-mail (WorkflowPlan.md §15).
 *
 * One template rather than one per event: every merchant notification is the
 * same shape — a Czech title, a line or two of context, and a link back into
 * the admin, where the actual work happens. Five near-identical templates would
 * have to be kept in sync for no benefit, and the plan's rule is that the admin
 * is where she acts; the e-mail only tells her to look.
 *
 * Urgent items (carrier failures, failed payments, e-mail delivery failures)
 * get a red marker so they are distinguishable at a glance in an inbox.
 */
interface MerchantNotificationEmailProps {
  title?: string;
  description?: string;
  urgent?: boolean;
}

function MerchantNotificationEmailComponent({
  title,
  description,
  urgent,
}: MerchantNotificationEmailProps) {
  const adminUrl = process.env.BACKEND_PUBLIC_URL || process.env.MEDUSA_BACKEND_URL || "";
  const heading = title || "Upozornění z e-shopu";

  return (
    <Html>
      <Head />
      <Preview>{heading}</Preview>
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
              {urgent && (
                <Text className="text-[#B42318] text-[14px] font-bold uppercase m-2">
                  Vyžaduje pozornost
                </Text>
              )}
              <Heading className="text-[#212222] text-[28px] font-normal text-left p-0 my-[10px] mx-2">
                {heading}
              </Heading>
              {description && (
                <Text className="text-[#212222] text-[18px] leading-[26px] font-normal m-2 whitespace-pre-line">
                  {description}
                </Text>
              )}
            </Section>

            {adminUrl && (
              <Section className="text-left mx-2 my-8">
                <Button
                  href={`${adminUrl.replace(/\/+$/, "")}/app/prehled`}
                  className="bg-[#212222] text-white rounded-full px-6 py-3 text-[16px] no-underline"
                >
                  Otevřít Přehled
                </Button>
              </Section>
            )}

            <Section className="border-t border-solid border-[#212222] mt-8">
              <Text className="text-[#212222] text-[14px] leading-[20px] m-2">
                Tento e-mail chodí automaticky z vašeho e-shopu.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export const merchantNotificationEmail = (props: MerchantNotificationEmailProps) => (
  <MerchantNotificationEmailComponent {...props} />
);

// Mock data for preview/development
export default () => (
  <MerchantNotificationEmailComponent
    title="Nová zaplacená objednávka #1042"
    description={"Jana Nováková · 1 890 Kč · 3 položky"}
  />
);
