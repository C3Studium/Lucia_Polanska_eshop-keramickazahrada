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

interface NewsletterSignupEmailProps {
  customerName?: string;
  unsubscribeLink?: string;
}

function NewsletterSignupEmailComponent({
  customerName = "Vážený zákazník",
  unsubscribeLink = "https://keramickazahrada.cz/unsubscribe"
}: NewsletterSignupEmailProps) {
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

      <ButtonRow>
        <EmailButton href="https://keramickazahrada.cz/store">
          Prohlédnout objekty
        </EmailButton>
      </ButtonRow>

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
      <Signature />
    </EmailLayout>
  )
}

export const NewsletterSignupEmail = (props: NewsletterSignupEmailProps) => (
  <NewsletterSignupEmailComponent {...props} />
)

// Mock data for preview/development
const mockNewsletterSignup: NewsletterSignupEmailProps = {
  customerName: "Marie Svobodová",
  unsubscribeLink: "https://keramickazahrada.cz/unsubscribe?token=abc123"
}

export default () => <NewsletterSignupEmailComponent {...mockNewsletterSignup} />
