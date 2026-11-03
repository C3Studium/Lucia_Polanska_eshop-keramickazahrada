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
import { useCopy } from "../components/email-i18n"
import type { Localized } from "../../../lib/email-locale"

interface NewsletterUnsubscribeEmailProps {
  customerName?: string;
  email?: string;
}

/** Texty po jazycích (lib/email-locale) — čeština je původní znění. */
const COPY: Localized<{
  preview: string
  title: string
  accent: string
  removed: (email: string) => string
  thanks: string
  resubscribe: string
  privacy: string
  closing: string
}> = {
  cs: {
    preview: "Odhlášení z novinek je hotové.",
    title: "Odhlášení je",
    accent: "hotové.",
    removed: (email) =>
      `${email ? `adresu ${email}` : "vaši adresu"} jsem právě vyřadila ze seznamu odběratelů. Žádné další novinky z dílny vám už chodit nebudou.`,
    thanks:
      "Je to v pořádku — a děkuji za čas, který jste mým zprávám věnovali. Kdybyste se někdy chtěli vrátit, dveře zůstávají otevřené.",
    resubscribe: "Přihlásit se znovu",
    privacy:
      "Vaše údaje zůstávají chráněné podle zásad ochrany osobních údajů. Pokud šlo o omyl, stačí se na webu kdykoli přihlásit znovu.",
    closing: "Mějte se krásně,",
  },
  sk: {
    preview: "Odhlásenie z noviniek je hotové.",
    title: "Odhlásenie je",
    accent: "hotové.",
    removed: (email) =>
      `${email ? `adresu ${email}` : "vašu adresu"} som práve vyradila zo zoznamu odberateľov. Žiadne ďalšie novinky z dielne vám už chodiť nebudú.`,
    thanks:
      "Je to v poriadku — a ďakujem za čas, ktorý ste mojim správam venovali. Keby ste sa niekedy chceli vrátiť, dvere zostávajú otvorené.",
    resubscribe: "Prihlásiť sa znova",
    privacy:
      "Vaše údaje zostávajú chránené podľa zásad ochrany osobných údajov. Ak išlo o omyl, stačí sa na webe kedykoľvek prihlásiť znova.",
    closing: "Majte sa krásne,",
  },
  pl: {
    preview: "Wypisanie z newslettera zakończone.",
    title: "Wypisanie",
    accent: "zakończone.",
    removed: (email) =>
      `${email ? `Adres ${email}` : "Państwa adres"} został właśnie usunięty z listy subskrybentów. Kolejne nowości z pracowni nie będą już przychodzić.`,
    thanks:
      "To zupełnie w porządku — dziękuję za czas poświęcony moim wiadomościom. Gdyby zechcieli Państwo kiedyś wrócić, drzwi pozostają otwarte.",
    resubscribe: "Zapisz się ponownie",
    privacy:
      "Państwa dane pozostają chronione zgodnie z zasadami ochrony danych osobowych. Jeśli to pomyłka, wystarczy w dowolnej chwili zapisać się ponownie na stronie.",
    closing: "Wszystkiego dobrego",
  },
  de: {
    preview: "Sie sind vom Newsletter abgemeldet.",
    title: "Abmeldung",
    accent: "erledigt.",
    removed: (email) =>
      `${email ? `die Adresse ${email}` : "Ihre Adresse"} habe ich soeben aus der Liste entfernt. Sie erhalten keine weiteren Neuigkeiten aus der Werkstatt.`,
    thanks:
      "Das ist völlig in Ordnung – und danke für die Zeit, die Sie meinen Nachrichten geschenkt haben. Falls Sie irgendwann zurückkommen möchten, steht die Tür offen.",
    resubscribe: "Erneut anmelden",
    privacy:
      "Ihre Daten bleiben gemäß der Datenschutzerklärung geschützt. War es ein Versehen, können Sie sich auf der Website jederzeit wieder anmelden.",
    closing: "Alles Gute",
  },
  en: {
    preview: "You've been unsubscribed from the newsletter.",
    title: "You're",
    accent: "unsubscribed.",
    removed: (email) =>
      `I've just removed ${email ? `the address ${email}` : "your address"} from the list. You won't receive any more news from the studio.`,
    thanks:
      "That's absolutely fine — and thank you for the time you gave to my messages. If you ever want to come back, the door is always open.",
    resubscribe: "Subscribe again",
    privacy:
      "Your data remains protected in line with the privacy policy. If this was a mistake, you can sign up again on the website at any time.",
    closing: "All the best,",
  },
}

function NewsletterUnsubscribeEmailComponent({
  customerName,
  email = ""
}: NewsletterUnsubscribeEmailProps) {
  const t = useCopy(COPY)
  // The storefront's newsletter page — where re-subscribing actually happens.
  const base = storefrontBase()
  const newsletterUrl = base ? `${base}/newsletter` : ""
  return (
    <EmailLayout preview={t.preview}>
      <Eyebrow>Newsletter</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting name={customerName} />
      <P>{t.removed(email)}</P>
      <P>{t.thanks}</P>

      {newsletterUrl ? (
        <ButtonRow>
          <EmailButton href={newsletterUrl} variant="ghost">
            {t.resubscribe}
          </EmailButton>
        </ButtonRow>
      ) : null}

      <P small>{t.privacy}</P>
      <Signature closing={t.closing} />
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
