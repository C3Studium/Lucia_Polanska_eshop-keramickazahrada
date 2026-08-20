import { Link } from "@react-email/components"
import {
  brand,
  ButtonRow,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  Greeting,
  Note,
  P,
  Signature,
} from "../components/email-ui"
import { storeLink } from "../../../lib/storefront-url"

interface NewsletterSignupEmailProps {
  customerName?: string;
  unsubscribeLink?: string;
  /**
   * Double opt-in: when present, this e-mail is the *confirmation request* —
   * the address is `pending` until the link is clicked, and no campaign will
   * reach it before then. When absent, the original welcome copy renders,
   * which keeps any legacy send with the old payload readable.
   */
  confirmLink?: string;
}

/**
 * The confirm variant. Its one job is the button — everything else exists to
 * make clear that nothing happens without it (zák. č. 480/2004 Sb.: consent
 * is proven by the click, not by the signup). And a signup that was not
 * theirs must be a safe non-event: ignore the e-mail, nothing arrives, the
 * pending row never becomes a recipient.
 */
function NewsletterConfirmComponent({
  customerName,
  confirmLink,
}: NewsletterSignupEmailProps & { confirmLink: string }) {
  return (
    <EmailLayout preview="Jedno kliknutí a jste v okruhu ateliéru — potvrďte prosím svůj odběr.">
      <Eyebrow>Newsletter</Eyebrow>
      <EmailH1 accent="odběr.">Potvrďte</EmailH1>

      <Greeting name={customerName} />
      <P>
        děkujeme za zájem o novinky z ateliéru. Zbývá poslední krok:
        potvrďte prosím, že jste odběr opravdu chtěli vy. Stačí jedno
        kliknutí.
      </P>

      <ButtonRow>
        <EmailButton href={confirmLink}>Potvrdit odběr</EmailButton>
      </ButtonRow>

      <P>
        Dokud odběr nepotvrdíte, žádné zprávy vám posílat nebudeme. Po
        potvrzení se ozveme, když z pece vyjdou nové objekty nebo když
        vypíšeme termíny kurzů — a jinak mlčíme.
      </P>

      <Note tone="olive">
        Nové objekty a termíny kurzů bez zbytečného hluku, nejvýše jednou
        týdně.
      </Note>

      <P small>
        Pokud jste se k odběru nepřihlásili vy, tento e-mail klidně
        ignorujte — bez potvrzení vám nic chodit nebude. Odkaz pro potvrzení:{" "}
        <Link
          href={confirmLink}
          style={{ color: brand.ink, textDecoration: "underline" }}
        >
          {confirmLink}
        </Link>
      </P>
      <Signature />
    </EmailLayout>
  )
}

function NewsletterSignupEmailComponent({
  customerName,
  unsubscribeLink = ""
}: NewsletterSignupEmailProps) {
  const shopUrl = storeLink()
  return (
    <EmailLayout preview="Vítejte v okruhu ateliéru — nové objekty a termíny kurzů bez zbytečného hluku.">
      <Eyebrow>Newsletter</Eyebrow>
      <EmailH1 accent="ateliéru.">Blízko</EmailH1>

      <Greeting name={customerName} />
      <P>
        děkujeme, že jste se přidali do okruhu lidí, kterým píšeme
        z ateliéru. Ozveme se, když z pece vyjdou nové objekty nebo když
        vypíšeme termíny kurzů — a jinak mlčíme.
      </P>
      <P>
        Píšeme nejvýše jednou týdně, obvykle méně. Vaši adresu používáme
        jen pro tyto zprávy a nikomu ji nepředáváme.
      </P>

      <Note tone="olive">
        Nové objekty a termíny kurzů bez zbytečného hluku.
      </Note>

      {shopUrl ? (
        <ButtonRow>
          <EmailButton href={shopUrl}>Prohlédnout objekty</EmailButton>
        </ButtonRow>
      ) : null}

      {/* A dead placeholder link would 404 at the person trying to leave —
          without a real signed link, the honest instruction is to reply. */}
      {unsubscribeLink ? (
        <P small>
          Odhlásit se můžete kdykoli — odkaz najdete v patičce každé zprávy,
          nebo přímo{" "}
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
          Odhlásit se můžete kdykoli — odkaz najdete v patičce každé zprávy,
          nebo stačí odpovědět na tento e-mail.
        </P>
      )}
      <Signature />
    </EmailLayout>
  )
}

export const NewsletterSignupEmail = (props: NewsletterSignupEmailProps) =>
  props.confirmLink ? (
    <NewsletterConfirmComponent
      {...props}
      confirmLink={props.confirmLink}
    />
  ) : (
    <NewsletterSignupEmailComponent {...props} />
  )

// Mock data for preview/development
const mockNewsletterSignup: NewsletterSignupEmailProps = {
  customerName: "Marie Svobodová",
  confirmLink: "https://keramickazahrada.cz/newsletter/confirm?token=abc123"
}

export default () => <NewsletterSignupEmail {...mockNewsletterSignup} />
