import { Link } from "@react-email/components"
import {
  brand,
  ButtonRow,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  Greeting,
  LedgerEnd,
  LedgerRow,
  P,
  Signature,
} from "../components/email-ui"
import { storeLink } from "../../../lib/storefront-url"
import {
  NEWSLETTER_SENDER,
  NewsletterBlocksEmail,
  type EmailNewsletterBlock,
} from "./newsletter-blocks"

interface PromotionalEmailProps {
  customerName?: string;
  discountCode?: string;
  discountPercentage?: string;
  expiryDate?: string;
  productLink?: string;
  unsubscribeLink?: string;
  /**
   * The legal „proč to dostáváte" line. Defaults to the newsletter wording;
   * the workbench thank-you sends this mail to customers who may never have
   * subscribed, and must say so truthfully instead.
   */
  receivingReason?: string;
  /**
   * Block-composed newsletters from the admin's „Napsat" editor ride on this
   * registered template key. When `blocks` is present the whole rendering is
   * delegated to `newsletter-blocks.tsx`; without it the original discount
   * layout below renders unchanged, so the legacy campaigns route keeps
   * working. The subject travels in `data.subject` (the provider lets it win
   * over the template default).
   */
  subject?: string;
  preheader?: string;
  blocks?: EmailNewsletterBlock[];
}

/**
 * Kód, zvýhodnění a platnost se vykreslí jen s reálnými hodnotami — routa
 * kampaní je vyžaduje, ale výchozí mockový kód („KERAMIKA20") nesmí mít
 * šanci odejít ostrým e-mailem.
 */
function PromotionalEmailComponent({
  customerName,
  discountCode,
  discountPercentage,
  expiryDate,
  productLink = "",
  unsubscribeLink = "",
  receivingReason = "Tuto zprávu dostáváte jako odběratel novinek ateliéru."
}: PromotionalEmailProps) {
  const productUrl = productLink || storeLink()
  return (
    <EmailLayout
      preview={
        discountCode
          ? `Objekty z ateliéru za příznivější cenu — s kódem ${discountCode}.`
          : "Objekty z ateliéru za příznivější cenu."
      }
    >
      <Eyebrow>Z ateliéru</Eyebrow>
      <EmailH1 accent="příznivější cenu.">Objekty za</EmailH1>

      <Greeting name={customerName} />
      <P>
        na objekty z ateliéru teď platí příznivější cena. Pokud jste
        některý kus delší dobu zvažovali, možná je vhodná chvíle se
        k němu vrátit.
      </P>

      {discountCode ? <LedgerRow label="Kód" value={discountCode} strong /> : null}
      {discountPercentage ? (
        <LedgerRow label="Zvýhodnění" value={discountPercentage} />
      ) : null}
      {expiryDate ? <LedgerRow label="Platí do" value={expiryDate} /> : null}
      <LedgerEnd />

      {discountCode ? (
        <P style={{ margin: "24px 0 16px" }}>
          Kód stačí zadat při objednávce. Platí na objekty, které jsou
          právě skladem.
        </P>
      ) : null}

      {productUrl ? (
        <ButtonRow>
          <EmailButton href={productUrl}>Prohlédnout objekty</EmailButton>
        </ButtonRow>
      ) : null}

      {/* Legal footer: reason, unsubscribe, sender identity. Without a signed
          link the honest opt-out is a reply — never a dead placeholder URL. */}
      {unsubscribeLink ? (
        <P small>
          {receivingReason} Odhlásit se můžete{" "}
          <Link
            href={unsubscribeLink}
            style={{ color: brand.ink, textDecoration: "underline" }}
          >
            zde
          </Link>
          .
        </P>
      ) : (
        <P small>
          {receivingReason} Pokud podobné zprávy dostávat nechcete, stačí
          odpovědět na tento e-mail a už vám je posílat nebudeme.
        </P>
      )}
      <P small style={{ margin: "8px 0 0" }}>
        Odesílatel: {NEWSLETTER_SENDER.name}, se sídlem{" "}
        {NEWSLETTER_SENDER.address}, IČO {NEWSLETTER_SENDER.registrationNumber}.
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const PromotionalEmail = (props: PromotionalEmailProps) =>
  props.blocks && props.blocks.length ? (
    <NewsletterBlocksEmail
      subject={props.subject}
      preheader={props.preheader}
      blocks={props.blocks}
      unsubscribeLink={props.unsubscribeLink}
    />
  ) : (
    <PromotionalEmailComponent {...props} />
  )

// Mock data for preview/development
const mockPromotional: PromotionalEmailProps = {
  customerName: "Jan Novák",
  discountCode: "KERAMIKA20",
  discountPercentage: "20%",
  expiryDate: "31. prosince 2024",
  productLink: "https://keramickazahrada.cz/products",
  unsubscribeLink: "https://keramickazahrada.cz/unsubscribe"
}

export default () => <PromotionalEmailComponent {...mockPromotional} />
