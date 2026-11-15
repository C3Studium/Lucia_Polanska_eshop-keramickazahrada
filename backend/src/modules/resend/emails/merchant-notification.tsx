import { Img, Link, Section } from "@react-email/components"
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
  /** Fotky jako obrázky (poptávka zakázky) — klik otevře plnou velikost. */
  images?: string[];
}

function MerchantNotificationEmailComponent({
  title,
  description,
  urgent,
  images,
}: MerchantNotificationEmailProps) {
  const photos = (Array.isArray(images) ? images : []).filter(
    (url) => typeof url === "string" && /^https?:\/\//.test(url)
  );
  /* Řádky s adresou fotky, které e-mail ukazuje jako obrázek, z textu pryč —
     text zůstává celý pro zvonek a stránku Poptávky v adminu. */
  const text = photos.length
    ? (description ?? "")
        .split("\n")
        .filter((line) => !photos.includes(line.trim()))
        .join("\n")
    : description;
  const adminUrl = process.env.BACKEND_PUBLIC_URL || process.env.MEDUSA_BACKEND_URL || "";
  const heading = title || "Upozornění z e-shopu";

  return (
    <EmailLayout preview={heading}>
      <Eyebrow>Interní upozornění</Eyebrow>
      <EmailH1>{heading}</EmailH1>

      {urgent ? <Note tone="danger">Vyžaduje pozornost.</Note> : null}

      {text ? (
        <P style={{ whiteSpace: "pre-line" }}>{text}</P>
      ) : null}

      {photos.length ? (
        <Section style={{ margin: "8px 0 20px" }}>
          {photos.map((url, index) => (
            <Link key={url} href={url} style={{ display: "block", margin: "0 0 12px" }}>
              <Img
                src={url}
                alt={`Fotka ${index + 1}`}
                width="520"
                style={{ display: "block", width: "100%", maxWidth: "520px", height: "auto", borderRadius: "6px" }}
              />
            </Link>
          ))}
        </Section>
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
