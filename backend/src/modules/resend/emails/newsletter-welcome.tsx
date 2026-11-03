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
import { useCopy } from "../components/email-i18n"
import type { Localized } from "../../../lib/email-locale"

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

/** Texty po jazycích (lib/email-locale) — čeština je původní znění. */
const COPY: Localized<{
  preview: string
  title: string
  accent: string
  recorded: (email: string, confirmedOn: string) => string
  frequency: string
  browse: string
  unsubscribeBefore: string
  unsubscribeLinkText: string
  unsubscribeAfter: string
  unsubscribeFooter: string
  privacy: string
}> = {
  cs: {
    preview: "Odběr novinek je potvrzený — děkuji.",
    title: "Odběr",
    accent: "je potvrzený.",
    recorded: (email, confirmedOn) =>
      `děkuji — ${email ? `adresu ${email} ` : "vaši adresu "}jsem zapsala mezi odběratele${
        confirmedOn ? `, potvrzeno ${confirmedOn}` : ""
      }. Od téhle chvíle vám budu posílat novinky z dílny.`,
    frequency:
      "Nebude jich moc. Píšu, když z pece vyjde něco nového, když otevřu termín kurzu nebo když mám v dílně něco, co stojí za řeč — tedy několikrát do roka, ne každý týden.",
    browse: "Prohlédnout nabídku",
    unsubscribeBefore: "Odhlásit se můžete kdykoli a zdarma — stačí jedno kliknutí",
    unsubscribeLinkText: "zde",
    unsubscribeAfter: ". Nic vysvětlovat nemusíte.",
    unsubscribeFooter:
      "Odhlásit se můžete kdykoli a zdarma — odkaz najdete v patičce každé zprávy, kterou od mě dostanete.",
    privacy:
      "Vaši adresu používám jen k posílání těchto novinek a nikomu ji nepředávám. Víc najdete v zásadách ochrany osobních údajů.",
  },
  sk: {
    preview: "Odber noviniek je potvrdený — ďakujem.",
    title: "Odber",
    accent: "je potvrdený.",
    recorded: (email, confirmedOn) =>
      `ďakujem — ${email ? `adresu ${email} ` : "vašu adresu "}som zapísala medzi odberateľov${
        confirmedOn ? `, potvrdené ${confirmedOn}` : ""
      }. Odteraz vám budem posielať novinky z dielne.`,
    frequency:
      "Nebude ich veľa. Píšem, keď z pece vyjde niečo nové, keď otvorím termín kurzu alebo keď mám v dielni niečo, o čom stojí za to rozprávať — teda niekoľkokrát do roka, nie každý týždeň.",
    browse: "Pozrieť ponuku",
    unsubscribeBefore: "Odhlásiť sa môžete kedykoľvek a zadarmo — stačí jedno kliknutie",
    unsubscribeLinkText: "tu",
    unsubscribeAfter: ". Nič vysvetľovať nemusíte.",
    unsubscribeFooter:
      "Odhlásiť sa môžete kedykoľvek a zadarmo — odkaz nájdete v päte každej správy, ktorú odo mňa dostanete.",
    privacy:
      "Vašu adresu používam len na posielanie týchto noviniek a nikomu ju neposkytujem. Viac nájdete v zásadách ochrany osobných údajov.",
  },
  pl: {
    preview: "Subskrypcja potwierdzona — dziękuję.",
    title: "Subskrypcja",
    accent: "potwierdzona.",
    recorded: (email, confirmedOn) =>
      `Dziękuję — ${email ? `adres ${email} ` : "Państwa adres "}został zapisany na liście subskrybentów${
        confirmedOn ? ` (potwierdzono ${confirmedOn})` : ""
      }. Od teraz będę przesyłać nowości z pracowni.`,
    frequency:
      "Nie będzie ich wiele. Piszę, gdy z pieca wyjdzie coś nowego, gdy otworzę termin warsztatów albo gdy w pracowni dzieje się coś wartego opowiedzenia — czyli kilka razy w roku, nie co tydzień.",
    browse: "Zobacz ofertę",
    unsubscribeBefore: "Wypisać się można w każdej chwili i bezpłatnie — wystarczy jedno kliknięcie",
    unsubscribeLinkText: "tutaj",
    unsubscribeAfter: ". Nie trzeba niczego wyjaśniać.",
    unsubscribeFooter:
      "Wypisać się można w każdej chwili i bezpłatnie — link znajduje się w stopce każdej wiadomości ode mnie.",
    privacy:
      "Adresu używam wyłącznie do wysyłania tych nowości i nikomu go nie przekazuję. Więcej informacji w zasadach ochrony danych osobowych.",
  },
  de: {
    preview: "Ihr Newsletter-Abo ist bestätigt – vielen Dank.",
    title: "Ihr Abo",
    accent: "ist bestätigt.",
    recorded: (email, confirmedOn) =>
      `vielen Dank – ${email ? `die Adresse ${email} ` : "Ihre Adresse "}habe ich in die Liste aufgenommen${
        confirmedOn ? `, bestätigt am ${confirmedOn}` : ""
      }. Ab jetzt schicke ich Ihnen Neuigkeiten aus der Werkstatt.`,
    frequency:
      "Es werden nicht viele. Ich schreibe, wenn etwas Neues aus dem Ofen kommt, wenn ich einen Kurstermin öffne oder wenn es in der Werkstatt etwas Erzählenswertes gibt – also ein paarmal im Jahr, nicht jede Woche.",
    browse: "Zum Angebot",
    unsubscribeBefore: "Sie können sich jederzeit kostenlos abmelden – ein Klick",
    unsubscribeLinkText: "hier",
    unsubscribeAfter: " genügt. Sie müssen nichts begründen.",
    unsubscribeFooter:
      "Sie können sich jederzeit kostenlos abmelden – den Link finden Sie in der Fußzeile jeder Nachricht von mir.",
    privacy:
      "Ihre Adresse verwende ich nur für diese Neuigkeiten und gebe sie an niemanden weiter. Mehr dazu in der Datenschutzerklärung.",
  },
  en: {
    preview: "Your newsletter subscription is confirmed — thank you.",
    title: "Your subscription",
    accent: "is confirmed.",
    recorded: (email, confirmedOn) =>
      `Thank you — I've added ${email ? `the address ${email}` : "your address"} to the list${
        confirmedOn ? `, confirmed on ${confirmedOn}` : ""
      }. From now on, I'll send you news from the studio.`,
    frequency:
      "There won't be many. I write when something new comes out of the kiln, when I open a workshop date or when there's a story worth telling from the studio — a few times a year, not every week.",
    browse: "Browse the shop",
    unsubscribeBefore: "You can unsubscribe free of charge at any time — one click",
    unsubscribeLinkText: "here",
    unsubscribeAfter: " is all it takes. You don't need to give a reason.",
    unsubscribeFooter:
      "You can unsubscribe free of charge at any time — you'll find the link in the footer of every message from me.",
    privacy:
      "I use your address only for this news and never pass it on to anyone. You can read more in the privacy policy.",
  },
}

function NewsletterWelcomeEmailComponent({
  customerName,
  email = "",
  unsubscribeLink = "",
  confirmedOn = "",
}: NewsletterWelcomeEmailProps) {
  const t = useCopy(COPY)
  const base = storefrontBase()
  const shopUrl = base || ""

  return (
    <EmailLayout preview={t.preview}>
      <Eyebrow>Newsletter</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting name={customerName} />
      <P>{t.recorded(email, confirmedOn)}</P>

      <P>{t.frequency}</P>

      {shopUrl ? (
        <ButtonRow>
          <EmailButton href={shopUrl}>{t.browse}</EmailButton>
        </ButtonRow>
      ) : null}

      {/* Odhlášení patří do každého obchodního sdělení — i do toho prvního.
          Odvolat souhlas má být stejně snadné jako ho dát. */}
      {unsubscribeLink ? (
        <Note>
          {t.unsubscribeBefore} <a href={unsubscribeLink}>{t.unsubscribeLinkText}</a>
          {t.unsubscribeAfter}
        </Note>
      ) : (
        <Note>{t.unsubscribeFooter}</Note>
      )}

      <P small>{t.privacy}</P>

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
