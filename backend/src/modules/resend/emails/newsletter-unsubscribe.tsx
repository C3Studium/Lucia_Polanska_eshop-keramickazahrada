import {
  ButtonRow,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  Greeting,
  P,
  Signature,
} from "../components/email-ui"
import { storefrontBase } from "../../../lib/storefront-url"

interface NewsletterUnsubscribeEmailProps {
  customerName?: string;
  email?: string;
}

function NewsletterUnsubscribeEmailComponent({
  customerName,
  email = ""
}: NewsletterUnsubscribeEmailProps) {
  // The storefront's newsletter page — where re-subscribing actually happens.
  const base = storefrontBase()
  const newsletterUrl = base ? `${base}/newsletter` : ""
  return (
    <EmailLayout preview="Odhlášení z novinek je hotové.">
      <Eyebrow>Newsletter</Eyebrow>
      <EmailH1 accent="hotové.">Odhlášení je</EmailH1>

      <Greeting name={customerName} />
      <P>
        {email ? `adresu ${email}` : "vaši adresu"} jsem právě vyřadila ze
        seznamu odběratelů. Žádné další novinky z dílny vám už chodit
        nebudou.
      </P>
      <P>
        Je to v pořádku — a děkuji za čas, který jste mým zprávám věnovali.
        Kdybyste se někdy chtěli vrátit, dveře zůstávají otevřené.
      </P>

      {newsletterUrl ? (
        <ButtonRow>
          <EmailButton href={newsletterUrl} variant="ghost">
            Přihlásit se znovu
          </EmailButton>
        </ButtonRow>
      ) : null}

      <P small>
        Vaše údaje zůstávají chráněné podle zásad ochrany osobních údajů.
        Pokud šlo o omyl, stačí se na webu kdykoli přihlásit znovu.
      </P>
      <Signature closing="Mějte se krásně," />
    </EmailLayout>
  )
}

export const NewsletterUnsubscribeEmail = (props: NewsletterUnsubscribeEmailProps) => (
  <NewsletterUnsubscribeEmailComponent {...props} />
)

// Mock data for preview/development
const mockNewsletterUnsubscribe: NewsletterUnsubscribeEmailProps = {
  customerName: "Petr Novotný",
  email: "petr.novotny@email.cz"
}

export default () => <NewsletterUnsubscribeEmailComponent {...mockNewsletterUnsubscribe} />
