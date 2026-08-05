import {
  ButtonRow,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  Note,
  P,
} from "../components/email-ui"

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
    <EmailLayout preview={heading}>
      <Eyebrow>Interní upozornění</Eyebrow>
      <EmailH1>{heading}</EmailH1>

      {urgent ? <Note tone="danger">Vyžaduje pozornost.</Note> : null}

      {description ? (
        <P style={{ whiteSpace: "pre-line" }}>{description}</P>
      ) : null}

      {adminUrl && (
        <ButtonRow>
          <EmailButton href={`${adminUrl.replace(/\/+$/, "")}/app/prehled`}>
            Otevřít přehled
          </EmailButton>
        </ButtonRow>
      )}

      <P small>Tento e-mail chodí automaticky z vašeho e-shopu.</P>
    </EmailLayout>
  );
}

export const merchantNotificationEmail = (props: MerchantNotificationEmailProps) => (
  <MerchantNotificationEmailComponent {...props} />
);

// Mock data for preview/development
const mockNotification: MerchantNotificationEmailProps = {
  title: "Nová zaplacená objednávka #1042",
  description: "Jana Nováková · 1 890 Kč · 3 položky",
};

export default () => (
  <MerchantNotificationEmailComponent {...mockNotification} />
);
