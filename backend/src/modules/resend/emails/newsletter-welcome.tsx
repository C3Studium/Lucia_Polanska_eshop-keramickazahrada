import {
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
import { storefrontBase } from "../../../lib/storefront-url"

/**
 * Poděkování za potvrzený odběr — první zpráva, kterou odběratel dostane
 * jako odběratel.
 *
 * ## Proč existuje
 *
 * Dvoukrokové přihlášení mělo jen první půlku: žádost o potvrzení. Kdo na
 * odkaz klikl, viděl stránku „potvrzeno" a pak **nic** — třeba měsíce, než
 * vyjde první kampaň. Z pohledu člověka je to k nerozeznání od rozbitého
 * formuláře, a z pohledu důkazu o souhlasu chybí to jediné, co má odběratel
 * v ruce: zpráva, že souhlas byl zaznamenán a jak ho vzít zpět.
 *
 * ## Co v něm podle zákona musí být
 *
 * Zák. č. 480/2004 Sb. § 7 chce u obchodního sdělení zřetelného odesílatele
 * a **funkční, bezplatný způsob, jak odběr odmítnout**. GDPR čl. 7 odst. 3
 * k tomu přidává, že odvolat souhlas musí být stejně snadné jako ho dát —
 * dát ho stálo jedno kliknutí, takže odvolání taky. Odhlašovací odkaz proto
 * nese i tenhle e-mail, ne až kampaně: je to obchodní sdělení jako každé
 * jiné.
 *
 * Totožnost odesílatele a identifikační údaje doplňuje `EmailLayout`
 * z právních údajů v administraci, takže je nemá smysl psát sem.
 *
 * ## Co v něm schválně NENÍ
 *
 * Žádná nabídka, žádný produkt, žádná sleva. První zpráva potvrzuje stav
 * vztahu, neprodává — kdo právě potvrdil souhlas, ještě nečeká inzerát.
 */
interface NewsletterWelcomeEmailProps {
  customerName?: string
  email?: string
  /** Signovaný odhlašovací odkaz pro tuhle adresu. */
  unsubscribeLink?: string
  /** „20. 10. 2026" — den, kdy odběratel souhlas potvrdil. */
  confirmedOn?: string
}

function NewsletterWelcomeEmailComponent({
  customerName,
  email = "",
  unsubscribeLink = "",
  confirmedOn = "",
}: NewsletterWelcomeEmailProps) {
  const base = storefrontBase()
  const shopUrl = base || ""

  return (
    <EmailLayout preview="Odběr novinek je potvrzený — děkuji.">
      <Eyebrow>Newsletter</Eyebrow>
      <EmailH1 accent="je potvrzený.">Odběr</EmailH1>

      <Greeting name={customerName} />
      <P>
        děkuji — {email ? `adresu ${email} ` : "vaši adresu "}
        jsem zapsala mezi odběratele
        {confirmedOn ? `, potvrzeno ${confirmedOn}` : ""}. Od téhle chvíle vám
        budu posílat novinky z dílny.
      </P>

      <P>
        Nebude jich moc. Píšu, když z pece vyjde něco nového, když otevřu
        termín kurzu nebo když mám v dílně něco, co stojí za řeč — tedy
        několikrát do roka, ne každý týden.
      </P>

      {shopUrl ? (
        <ButtonRow>
          <EmailButton href={shopUrl}>Prohlédnout nabídku</EmailButton>
        </ButtonRow>
      ) : null}

      {/* Odhlášení patří do každého obchodního sdělení — i do toho prvního.
          Odvolat souhlas má být stejně snadné jako ho dát. */}
      {unsubscribeLink ? (
        <Note>
          Odhlásit se můžete kdykoli a zdarma — stačí jedno kliknutí{" "}
          <a href={unsubscribeLink}>zde</a>. Nic vysvětlovat nemusíte.
        </Note>
      ) : (
        <Note>
          Odhlásit se můžete kdykoli a zdarma — odkaz najdete v patičce každé
          zprávy, kterou od mě dostanete.
        </Note>
      )}

      <P small>
        Vaši adresu používám jen k posílání těchto novinek a nikomu ji
        nepředávám. Víc najdete v zásadách ochrany osobních údajů.
      </P>

      <Signature />
    </EmailLayout>
  )
}

export const NewsletterWelcomeEmail = (props: NewsletterWelcomeEmailProps) => (
  <NewsletterWelcomeEmailComponent {...props} />
)

const mockNewsletterWelcome: NewsletterWelcomeEmailProps = {
  customerName: "Petr Novotný",
  email: "petr.novotny@email.cz",
  unsubscribeLink: "https://keramickazahrada.cz/newsletter/unsubscribe?token=abc123",
  confirmedOn: "20. 10. 2026",
}

export default () => <NewsletterWelcomeEmailComponent {...mockNewsletterWelcome} />
