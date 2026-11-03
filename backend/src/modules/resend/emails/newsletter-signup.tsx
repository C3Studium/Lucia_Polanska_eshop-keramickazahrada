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
import { useCopy } from "../components/email-i18n"
import type { Localized } from "../../../lib/email-locale"

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

/** Texty po jazycích (lib/email-locale) — čeština je původní znění. */
const COPY: Localized<{
  confirmPreview: string
  confirmTitle: string
  confirmAccent: string
  confirmIntro: string
  confirmButton: string
  confirmPromise: string
  confirmNote: string
  confirmNotYou: string
  welcomePreview: string
  welcomeTitle: string
  welcomeAccent: string
  welcomeIntro: string
  welcomeFrequency: string
  welcomeNote: string
  browse: string
  unsubscribeLinkBefore: string
  unsubscribeLinkText: string
  unsubscribeWrite: string
}> = {
  cs: {
    confirmPreview: "Ještě jedno kliknutí, prosím — potvrďte, že novinky z dílny chcete.",
    confirmTitle: "Ještě jedno",
    confirmAccent: "kliknutí.",
    confirmIntro:
      "děkuji za zájem o novinky z mé dílny. Zbývá poslední krok: potvrďte prosím, že jste si odběr přáli právě vy.",
    confirmButton: "Potvrdit odběr",
    confirmPromise:
      "Dokud odběr nepotvrdíte, nic vám posílat nebudu. Potom se ozvu, když z pece vyjdou nové kousky nebo když vypíšu termíny kurzů — a jinak mlčím.",
    confirmNote: "Nové kousky a termíny kurzů bez zbytečného hluku, nejvýše jednou týdně.",
    confirmNotYou:
      "Pokud jste se k odběru nepřihlásili vy, tento e-mail klidně nechte být — bez potvrzení vám nic chodit nebude. Odkaz pro potvrzení:",
    welcomePreview: "Novinky z dílny — nové kousky a termíny kurzů, bez zbytečného hluku.",
    welcomeTitle: "Novinky",
    welcomeAccent: "z dílny.",
    welcomeIntro:
      "děkuji, že jste se přidali k lidem, kterým píšu z dílny. Ozvu se, když z pece vyjdou nové kousky nebo když vypíšu termíny kurzů — a jinak mlčím.",
    welcomeFrequency:
      "Píšu nejvýše jednou týdně, obvykle méně. Vaši adresu používám jen pro tyto zprávy a nikomu ji nepředávám.",
    welcomeNote: "Nové kousky a termíny kurzů bez zbytečného hluku.",
    browse: "Prohlédnout nabídku",
    unsubscribeLinkBefore:
      "Odhlásit se můžete kdykoli — odkaz najdete v patičce každé zprávy, nebo přímo",
    unsubscribeLinkText: "zde",
    unsubscribeWrite:
      "Odhlásit se můžete kdykoli — odkaz najdete v patičce každé zprávy, nebo mi napište na info@keramickazahrada.cz.",
  },
  sk: {
    confirmPreview: "Ešte jedno kliknutie, prosím — potvrďte, že novinky z dielne chcete.",
    confirmTitle: "Ešte jedno",
    confirmAccent: "kliknutie.",
    confirmIntro:
      "ďakujem za záujem o novinky z mojej dielne. Zostáva posledný krok: potvrďte, prosím, že ste si odber želali práve vy.",
    confirmButton: "Potvrdiť odber",
    confirmPromise:
      "Kým odber nepotvrdíte, nič vám posielať nebudem. Potom sa ozvem, keď z pece vyjdú nové kúsky alebo keď vypíšem termíny kurzov — a inak mlčím.",
    confirmNote: "Nové kúsky a termíny kurzov bez zbytočného hluku, najviac raz týždenne.",
    confirmNotYou:
      "Ak ste sa na odber neprihlásili vy, tento e-mail pokojne nechajte tak — bez potvrdenia vám nič chodiť nebude. Odkaz na potvrdenie:",
    welcomePreview: "Novinky z dielne — nové kúsky a termíny kurzov, bez zbytočného hluku.",
    welcomeTitle: "Novinky",
    welcomeAccent: "z dielne.",
    welcomeIntro:
      "ďakujem, že ste sa pridali k ľuďom, ktorým píšem z dielne. Ozvem sa, keď z pece vyjdú nové kúsky alebo keď vypíšem termíny kurzov — a inak mlčím.",
    welcomeFrequency:
      "Píšem najviac raz týždenne, zvyčajne menej. Vašu adresu používam len na tieto správy a nikomu ju neposkytujem.",
    welcomeNote: "Nové kúsky a termíny kurzov bez zbytočného hluku.",
    browse: "Pozrieť ponuku",
    unsubscribeLinkBefore:
      "Odhlásiť sa môžete kedykoľvek — odkaz nájdete v päte každej správy, alebo priamo",
    unsubscribeLinkText: "tu",
    unsubscribeWrite:
      "Odhlásiť sa môžete kedykoľvek — odkaz nájdete v päte každej správy, alebo mi napíšte na info@keramickazahrada.cz.",
  },
  pl: {
    confirmPreview: "Jeszcze jedno kliknięcie — proszę potwierdzić, że chcą Państwo otrzymywać nowości z pracowni.",
    confirmTitle: "Jeszcze jedno",
    confirmAccent: "kliknięcie.",
    confirmIntro:
      "Dziękuję za zainteresowanie nowościami z mojej pracowni. Został ostatni krok: proszę potwierdzić, że to Państwo zapisali się do newslettera.",
    confirmButton: "Potwierdź subskrypcję",
    confirmPromise:
      "Dopóki nie potwierdzą Państwo subskrypcji, nic nie będę wysyłać. Potem odezwę się, gdy z pieca wyjdą nowe prace albo gdy ogłoszę terminy warsztatów — poza tym nie zawracam głowy.",
    confirmNote: "Nowe prace i terminy warsztatów bez zbędnego szumu, najwyżej raz w tygodniu.",
    confirmNotYou:
      "Jeśli to nie Państwo zapisali się do newslettera, proszę po prostu zignorować tę wiadomość — bez potwierdzenia nic nie przyjdzie. Link do potwierdzenia:",
    welcomePreview: "Nowości z pracowni — nowe prace i terminy warsztatów, bez zbędnego szumu.",
    welcomeTitle: "Nowości",
    welcomeAccent: "z pracowni.",
    welcomeIntro:
      "Dziękuję, że dołączyli Państwo do osób, do których piszę z pracowni. Odezwę się, gdy z pieca wyjdą nowe prace albo gdy ogłoszę terminy warsztatów — poza tym nie zawracam głowy.",
    welcomeFrequency:
      "Piszę najwyżej raz w tygodniu, zwykle rzadziej. Adresu używam wyłącznie do tych wiadomości i nikomu go nie przekazuję.",
    welcomeNote: "Nowe prace i terminy warsztatów bez zbędnego szumu.",
    browse: "Zobacz ofertę",
    unsubscribeLinkBefore:
      "Wypisać się można w każdej chwili — link jest w stopce każdej wiadomości, albo bezpośrednio",
    unsubscribeLinkText: "tutaj",
    unsubscribeWrite:
      "Wypisać się można w każdej chwili — link jest w stopce każdej wiadomości; można też napisać na info@keramickazahrada.cz.",
  },
  de: {
    confirmPreview: "Nur noch ein Klick – bitte bestätigen Sie, dass Sie Neuigkeiten aus der Werkstatt erhalten möchten.",
    confirmTitle: "Nur noch",
    confirmAccent: "ein Klick.",
    confirmIntro:
      "danke für Ihr Interesse an Neuigkeiten aus meiner Werkstatt. Es fehlt nur noch ein Schritt: Bitte bestätigen Sie, dass Sie selbst sich angemeldet haben.",
    confirmButton: "Anmeldung bestätigen",
    confirmPromise:
      "Solange Sie nicht bestätigen, schicke ich Ihnen nichts. Danach melde ich mich, wenn neue Stücke aus dem Ofen kommen oder ich Kurstermine ausschreibe – sonst nicht.",
    confirmNote: "Neue Stücke und Kurstermine ohne unnötigen Lärm, höchstens einmal pro Woche.",
    confirmNotYou:
      "Falls Sie sich nicht selbst angemeldet haben, ignorieren Sie diese E-Mail einfach – ohne Bestätigung erhalten Sie nichts. Link zur Bestätigung:",
    welcomePreview: "Neuigkeiten aus der Werkstatt – neue Stücke und Kurstermine, ohne unnötigen Lärm.",
    welcomeTitle: "Neuigkeiten",
    welcomeAccent: "aus der Werkstatt.",
    welcomeIntro:
      "danke, dass Sie zu den Menschen gehören, denen ich aus der Werkstatt schreibe. Ich melde mich, wenn neue Stücke aus dem Ofen kommen oder ich Kurstermine ausschreibe – sonst nicht.",
    welcomeFrequency:
      "Ich schreibe höchstens einmal pro Woche, meist seltener. Ihre Adresse verwende ich nur für diese Nachrichten und gebe sie an niemanden weiter.",
    welcomeNote: "Neue Stücke und Kurstermine ohne unnötigen Lärm.",
    browse: "Zum Angebot",
    unsubscribeLinkBefore:
      "Sie können sich jederzeit abmelden – den Link finden Sie in der Fußzeile jeder Nachricht oder direkt",
    unsubscribeLinkText: "hier",
    unsubscribeWrite:
      "Sie können sich jederzeit abmelden – den Link finden Sie in der Fußzeile jeder Nachricht, oder schreiben Sie mir an info@keramickazahrada.cz.",
  },
  en: {
    confirmPreview: "Just one click — please confirm that you'd like news from my studio.",
    confirmTitle: "Just",
    confirmAccent: "one click.",
    confirmIntro:
      "Thank you for your interest in news from my studio. There's just one more step: please confirm that it was you who signed up.",
    confirmButton: "Confirm my subscription",
    confirmPromise:
      "Until you confirm, I won't send you anything. After that, I'll write when new pieces come out of the kiln or when I open workshop dates — and that's it.",
    confirmNote: "New pieces and workshop dates without the noise, at most once a week.",
    confirmNotYou:
      "If you didn't sign up yourself, simply ignore this e-mail — without confirmation you won't receive anything. Confirmation link:",
    welcomePreview: "News from the studio — new pieces and workshop dates, without the noise.",
    welcomeTitle: "News",
    welcomeAccent: "from the studio.",
    welcomeIntro:
      "Thank you for joining the people I write to from my studio. I'll be in touch when new pieces come out of the kiln or when I open workshop dates — and that's it.",
    welcomeFrequency:
      "I write at most once a week, usually less often. I use your address only for these messages and never pass it on to anyone.",
    welcomeNote: "New pieces and workshop dates, without the noise.",
    browse: "Browse the shop",
    unsubscribeLinkBefore:
      "You can unsubscribe at any time — you'll find the link in the footer of every message, or right",
    unsubscribeLinkText: "here",
    unsubscribeWrite:
      "You can unsubscribe at any time — you'll find the link in the footer of every message, or just write to me at info@keramickazahrada.cz.",
  },
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
  const t = useCopy(COPY)
  return (
    <EmailLayout preview={t.confirmPreview}>
      <Eyebrow>Newsletter</Eyebrow>
      <EmailH1 accent={t.confirmAccent}>{t.confirmTitle}</EmailH1>

      <Greeting name={customerName} />
      <P>{t.confirmIntro}</P>

      <ButtonRow>
        <EmailButton href={confirmLink}>{t.confirmButton}</EmailButton>
      </ButtonRow>

      <P>{t.confirmPromise}</P>

      <Note tone="olive">{t.confirmNote}</Note>

      <P small>
        {t.confirmNotYou}{" "}
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
  const t = useCopy(COPY)
  const shopUrl = storeLink()
  return (
    <EmailLayout preview={t.welcomePreview}>
      <Eyebrow>Newsletter</Eyebrow>
      <EmailH1 accent={t.welcomeAccent}>{t.welcomeTitle}</EmailH1>

      <Greeting name={customerName} />
      <P>{t.welcomeIntro}</P>
      <P>{t.welcomeFrequency}</P>

      <Note tone="olive">{t.welcomeNote}</Note>

      {shopUrl ? (
        <ButtonRow>
          <EmailButton href={shopUrl}>{t.browse}</EmailButton>
        </ButtonRow>
      ) : null}

      {/* A dead placeholder link would 404 at the person trying to leave —
          without a real signed link, the honest instruction is to reply. */}
      {unsubscribeLink ? (
        <P small>
          {t.unsubscribeLinkBefore}{" "}
          <Link
            href={unsubscribeLink}
            style={{ color: brand.ink, textDecoration: "underline" }}
          >
            {t.unsubscribeLinkText}
          </Link>
          .
        </P>
      ) : (
        <P small>{t.unsubscribeWrite}</P>
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
