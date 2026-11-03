import { Link } from "@react-email/components"
import {
  brand,
  ButtonRow,
  CONTACT_EMAIL,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  Greeting,
  LedgerEnd,
  LedgerRow,
  Note,
  P,
  Signature,
} from "../components/email-ui"
import { storeLink } from "../../../lib/storefront-url"
import { useCopy, useFormatDate } from "../components/email-i18n"
import type { Localized } from "../../../lib/email-locale"

/**
 * Jednorázový slevový kód pro stálého zákazníka (Zákazníci+ → „Poslat
 * slevový kód", nebo automaticky po N. zaplacené objednávce —
 * `lib/loyalty-code.ts`).
 *
 * Chodí jen potvrzeným odběratelům newsletteru (obchodní sdělení,
 * rozhodnutí 2. 11. 2026), proto patička mluví o odběru a nese odhlášení.
 * Co kód nezlevní, říká e-mail předem: poštovné, balné, poukazy a zlevněné
 * kusy vyřazuje sama Medusa (`is_discountable`) a zákazník by jinak hledal
 * chybu v kódu.
 */
interface LoyaltyCodeEmailProps {
  customerName?: string
  code?: string
  /** Sleva v procentech (číslo). */
  percentage?: number
  /** Konec platnosti (ISO). */
  expiresAt?: string
  /** Má zákazník účet? Podle toho zní rada, jak kód uplatnit. */
  registered?: boolean
  shopLink?: string
  unsubscribeLink?: string
}

/** Texty po jazycích (lib/email-locale) — čeština je původní znění. */
const COPY: Localized<{
  preview: (percentage: number, code: string) => string
  eyebrow: string
  title: string
  accent: string
  intro: string
  codeLabel: string
  discountLabel: string
  validLabel: string
  discountValue: (percentage: number) => string
  howTo: string
  signedIn: string
  guest: string
  exclusions: string
  browse: string
  why: string
  unsubscribeBefore: string
  unsubscribeLink: string
  unsubscribeAfter: string
  unsubscribeWrite: string
}> = {
  cs: {
    preview: (percentage, code) => `Slevový kód na ${percentage} % jen pro vás: ${code}`,
    eyebrow: "Poděkování",
    title: "Malé poděkování",
    accent: "za vaši přízeň.",
    intro:
      "děkuji, že se ke mně vracíte. Moc si toho vážím — a tak pro vás mám slevový kód na další nákup.",
    codeLabel: "Kód",
    discountLabel: "Sleva",
    validLabel: "Platí do",
    discountValue: (percentage) => `${percentage} % z ceny výrobků`,
    howTo:
      "Kód zadejte v košíku nebo v pokladně do pole pro slevový kód. Platí na jeden nákup a jen pro vás — předat ho někomu dalšímu nejde.",
    signedIn: "Při nákupu buďte přihlášení ke svému účtu, jinak obchod kód nepozná jako váš.",
    guest: "Nakupte na tuto e-mailovou adresu — v pokladně ji vyplňte dřív, než kód zadáte.",
    exclusions:
      "Sleva se nevztahuje na poštovné, balné a dárkové poukazy ani na kusy, které už jsou zlevněné. U několika výrobků (třeba u zakázek) je vypnutá — kolik ušetříte, uvidíte v košíku hned po zadání kódu.",
    browse: "Prohlédnout nabídku",
    why: "Tuto zprávu dostáváte, protože odebíráte novinky z mé dílny.",
    unsubscribeBefore: "Odhlásit se můžete",
    unsubscribeLink: "zde",
    unsubscribeAfter: ".",
    unsubscribeWrite: "Pokud podobné zprávy dostávat nechcete, napište mi na",
  },
  sk: {
    preview: (percentage, code) => `Zľavový kód na ${percentage} % len pre vás: ${code}`,
    eyebrow: "Poďakovanie",
    title: "Malé poďakovanie",
    accent: "za vašu priazeň.",
    intro:
      "ďakujem, že sa ku mne vraciate. Veľmi si to vážim — a tak pre vás mám zľavový kód na ďalší nákup.",
    codeLabel: "Kód",
    discountLabel: "Zľava",
    validLabel: "Platí do",
    discountValue: (percentage) => `${percentage} % z ceny výrobkov`,
    howTo:
      "Kód zadajte v košíku alebo v pokladni do poľa pre zľavový kód. Platí na jeden nákup a len pre vás — odovzdať ho niekomu ďalšiemu nejde.",
    signedIn: "Pri nákupe buďte prihlásení do svojho účtu, inak obchod kód nespozná ako váš.",
    guest: "Nakúpte na túto e-mailovú adresu — v pokladni ju vyplňte skôr, než kód zadáte.",
    exclusions:
      "Zľava sa nevzťahuje na poštovné, balné a darčekové poukážky ani na kusy, ktoré sú už zlacnené. Pri niekoľkých výrobkoch (napríklad pri zákazkách) je vypnutá — koľko ušetríte, uvidíte v košíku hneď po zadaní kódu.",
    browse: "Pozrieť ponuku",
    why: "Túto správu dostávate, pretože odoberáte novinky z mojej dielne.",
    unsubscribeBefore: "Odhlásiť sa môžete",
    unsubscribeLink: "tu",
    unsubscribeAfter: ".",
    unsubscribeWrite: "Ak podobné správy dostávať nechcete, napíšte mi na",
  },
  pl: {
    preview: (percentage, code) => `Kod rabatowy na ${percentage}% tylko dla Państwa: ${code}`,
    eyebrow: "Podziękowanie",
    title: "Małe podziękowanie",
    accent: "za Państwa lojalność.",
    intro:
      "dziękuję, że Państwo do mnie wracają. Bardzo to doceniam — dlatego mam dla Państwa kod rabatowy na kolejne zakupy.",
    codeLabel: "Kod",
    discountLabel: "Rabat",
    validLabel: "Ważny do",
    discountValue: (percentage) => `${percentage}% ceny wyrobów`,
    howTo:
      "Kod należy wpisać w koszyku lub w kasie, w polu na kod rabatowy. Działa przy jednym zakupie i tylko dla Państwa — nie można go przekazać innej osobie.",
    signedIn: "Podczas zakupów proszę być zalogowanym na swoje konto, inaczej sklep nie rozpozna kodu jako Państwa.",
    guest: "Proszę zamówić na ten adres e-mail — w kasie najpierw wpisać adres, a dopiero potem kod.",
    exclusions:
      "Rabat nie obejmuje wysyłki, pakowania ani bonów podarunkowych, a także wyrobów już przecenionych. Przy kilku wyrobach (np. zamówieniach indywidualnych) jest wyłączony — ile Państwo oszczędzą, widać w koszyku zaraz po wpisaniu kodu.",
    browse: "Zobacz ofertę",
    why: "Otrzymują Państwo tę wiadomość, ponieważ subskrybują Państwo nowości z mojej pracowni.",
    unsubscribeBefore: "Wypisać się można",
    unsubscribeLink: "tutaj",
    unsubscribeAfter: ".",
    unsubscribeWrite: "Jeśli nie chcą Państwo otrzymywać takich wiadomości, proszę napisać na",
  },
  de: {
    preview: (percentage, code) => `Ihr persönlicher Rabattcode über ${percentage} %: ${code}`,
    eyebrow: "Dankeschön",
    title: "Ein kleines Dankeschön",
    accent: "für Ihre Treue.",
    intro:
      "vielen Dank, dass Sie immer wieder bei mir einkaufen. Das bedeutet mir viel – deshalb habe ich einen Rabattcode für Ihren nächsten Einkauf.",
    codeLabel: "Code",
    discountLabel: "Rabatt",
    validLabel: "Gültig bis",
    discountValue: (percentage) => `${percentage} % auf den Preis der Stücke`,
    howTo:
      "Geben Sie den Code im Warenkorb oder an der Kasse in das Feld für Rabattcodes ein. Er gilt für einen Einkauf und nur für Sie – weitergeben lässt er sich nicht.",
    signedIn: "Bitte melden Sie sich beim Einkauf in Ihrem Kundenkonto an, sonst erkennt der Shop den Code nicht als Ihren.",
    guest: "Bitte bestellen Sie mit dieser E-Mail-Adresse – tragen Sie sie an der Kasse ein, bevor Sie den Code eingeben.",
    exclusions:
      "Der Rabatt gilt nicht für Versand, Verpackung und Geschenkgutscheine und nicht für bereits reduzierte Stücke. Bei einigen Stücken (z. B. Auftragsarbeiten) ist er ausgeschaltet – wie viel Sie sparen, sehen Sie im Warenkorb gleich nach der Eingabe des Codes.",
    browse: "Zum Angebot",
    why: "Sie erhalten diese Nachricht, weil Sie Neuigkeiten aus meiner Werkstatt abonniert haben.",
    unsubscribeBefore: "Abmelden können Sie sich",
    unsubscribeLink: "hier",
    unsubscribeAfter: ".",
    unsubscribeWrite: "Wenn Sie solche Nachrichten nicht mehr erhalten möchten, schreiben Sie mir an",
  },
  en: {
    preview: (percentage, code) => `A ${percentage}% discount code just for you: ${code}`,
    eyebrow: "Thank you",
    title: "A small thank-you",
    accent: "for coming back.",
    intro:
      "Thank you for shopping with me again. It means a lot — so here is a discount code for your next order.",
    codeLabel: "Code",
    discountLabel: "Discount",
    validLabel: "Valid until",
    discountValue: (percentage) => `${percentage}% off the price of the pieces`,
    howTo:
      "Enter the code in the basket or at checkout, in the discount code field. It works for one order and only for you — it can't be passed on to anyone else.",
    signedIn: "Please be signed in to your account when you order, otherwise the shop won't recognise the code as yours.",
    guest: "Please order with this e-mail address — enter it at checkout before you add the code.",
    exclusions:
      "The discount doesn't apply to postage, packaging or gift vouchers, nor to pieces that are already reduced. It's switched off for a few pieces (such as commissions) — you'll see how much you save in the basket as soon as you enter the code.",
    browse: "Browse the shop",
    why: "You're receiving this message because you subscribed to news from my studio.",
    unsubscribeBefore: "You can unsubscribe",
    unsubscribeLink: "here",
    unsubscribeAfter: ".",
    unsubscribeWrite: "If you'd rather not receive messages like this, write to me at",
  },
}

function LoyaltyCodeEmailComponent({
  customerName,
  code = "",
  percentage = 0,
  expiresAt,
  registered = true,
  shopLink = "",
  unsubscribeLink = "",
}: LoyaltyCodeEmailProps) {
  const t = useCopy(COPY)
  const formatDate = useFormatDate()
  const shopUrl = shopLink || storeLink()
  return (
    <EmailLayout preview={t.preview(percentage, code)}>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting name={customerName} />
      <P>{t.intro}</P>

      <LedgerRow label={t.codeLabel} value={code} strong />
      <LedgerRow label={t.discountLabel} value={t.discountValue(percentage)} />
      {expiresAt ? (
        <LedgerRow
          label={t.validLabel}
          value={formatDate(expiresAt, { day: "numeric", month: "long", year: "numeric" })}
        />
      ) : null}
      <LedgerEnd />

      <P style={{ margin: "24px 0 16px" }}>
        {t.howTo} {registered ? t.signedIn : t.guest}
      </P>

      <Note>{t.exclusions}</Note>

      {shopUrl ? (
        <ButtonRow>
          <EmailButton href={shopUrl}>{t.browse}</EmailButton>
        </ButtonRow>
      ) : null}

      {/* Obchodní sdělení: proč to přišlo a jak se odhlásit — v každé zprávě. */}
      <P small>
        {t.why}{" "}
        {unsubscribeLink ? (
          <>
            {t.unsubscribeBefore}{" "}
            <Link href={unsubscribeLink} style={{ color: brand.ink, textDecoration: "underline" }}>
              {t.unsubscribeLink}
            </Link>
            {t.unsubscribeAfter}
          </>
        ) : (
          <>
            {t.unsubscribeWrite}{" "}
            <Link href={`mailto:${CONTACT_EMAIL}`} style={{ color: brand.ink, textDecoration: "underline" }}>
              {CONTACT_EMAIL}
            </Link>
            .
          </>
        )}
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const LoyaltyCodeEmail = (props: LoyaltyCodeEmailProps) => (
  <LoyaltyCodeEmailComponent {...props} />
)

// Mock data for preview/development
const mockLoyaltyCode: LoyaltyCodeEmailProps = {
  customerName: "Jana Nováková",
  code: "DIKY-K7M2QX",
  percentage: 10,
  expiresAt: "2026-12-31T12:00:00.000Z",
  registered: true,
  shopLink: "https://keramickazahrada.cz/cz/store",
  unsubscribeLink: "https://keramickazahrada.cz/newsletter/unsubscribe?token=abc123",
}

export default () => <LoyaltyCodeEmailComponent {...mockLoyaltyCode} />
