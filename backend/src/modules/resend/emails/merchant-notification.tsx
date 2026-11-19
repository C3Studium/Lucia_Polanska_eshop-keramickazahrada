import { Img, Link, Section } from "@react-email/components"
import {
  ButtonRow,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  LedgerEnd,
  LedgerRow,
  MultiLine,
  Note,
  P,
} from "../components/email-ui"
import type { MerchantOrderSummary } from "../../../lib/merchant-order-summary"

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
  /** Celá objednávka (e-mail „Nová objednávka", 19. 11. 2026). */
  order?: MerchantOrderSummary | null;
}

/** Nadpis sekce uvnitř e-mailu (Objednávka, Položky…). */
const Sekce = ({ children }: { children: string }) => (
  <Eyebrow>{children}</Eyebrow>
)

/** Celá objednávka — aby majitelka věděla, co, komu a kam, bez otevírání adminu. */
const ObjednavkaBlok = ({ order }: { order: MerchantOrderSummary }) => (
  <Section style={{ margin: "8px 0 4px" }}>
    <Sekce>Objednávka</Sekce>
    <LedgerRow label="Číslo" value={order.number} />
    {order.created ? <LedgerRow label="Přijato" value={order.created} /> : null}
    <LedgerRow label="Zákazník" value={<MultiLine value={[order.customer, order.contact].filter(Boolean).join("\n")} />} />
    <LedgerRow label="Doprava" value={<MultiLine value={`${order.shipping_method}\n${order.shipping_price}`} />} />
    {order.shipping_address ? (
      <LedgerRow label="Doručit na" value={<MultiLine value={order.shipping_address} />} />
    ) : null}
    {order.billing_address ? (
      <LedgerRow label="Fakturační" value={<MultiLine value={order.billing_address} />} />
    ) : null}
    <LedgerRow label="Platba" value={order.payment} />
    <LedgerEnd />

    <Section style={{ marginTop: "18px" }}>
      <Sekce>Položky</Sekce>
      {order.items.map((item, index) => (
        <LedgerRow key={index} label={item.label} value={item.total} />
      ))}
      <LedgerRow label="Mezisoučet" value={order.subtotal} />
      {order.packaging ? <LedgerRow label="Balné" value={order.packaging} /> : null}
      {order.service ? <LedgerRow label="Doběrečné" value={order.service} /> : null}
      {order.discount ? <LedgerRow label="Sleva" value={order.discount} tone="olive" /> : null}
      <LedgerRow label="Doprava" value={order.shipping} />
      <LedgerRow label="Celkem" value={order.total} strong />
      <LedgerEnd />
    </Section>
  </Section>
)

function MerchantNotificationEmailComponent({
  title,
  description,
  urgent,
  images,
  order,
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

      {order ? <ObjednavkaBlok order={order} /> : null}

      {order?.admin_url ? (
        <ButtonRow>
          <EmailButton href={order.admin_url}>Otevřít objednávku</EmailButton>
        </ButtonRow>
      ) : adminUrl ? (
        <ButtonRow>
          <EmailButton href={`${adminUrl.replace(/\/+$/, "")}/app/prehled`}>
            Otevřít přehled
          </EmailButton>
        </ButtonRow>
      ) : null}

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
