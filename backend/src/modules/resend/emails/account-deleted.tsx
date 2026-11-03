import { Link } from "@react-email/components"
import {
  brand,
  CONTACT_EMAIL,
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
import { useCopy, useFormatDate } from "../components/email-i18n"
import type { Localized } from "../../../lib/email-locale"

interface AccountDeletedEmailProps {
  customerName?: string;
  email?: string;
  deletionDate?: string;
}

/** Texty po jazycích (lib/email-locale) — čeština je původní znění. */
const COPY: Localized<{
  preview: string
  eyebrow: string
  title: string
  accent: string
  intro: string
  account: string
  deletedOn: string
  thanks: string
  note: string
  notYouBefore: string
  closing: string
}> = {
  cs: {
    preview: "Váš účet jsem smazala. Děkuji za důvěru.",
    eyebrow: "Váš účet",
    title: "Na shledanou",
    accent: "a děkuji.",
    intro:
      "váš účet jsem smazala. Osobní údaje jsem odstranila podle zásad ochrany osobních údajů; historii objednávek uchovávám jen tam, kde mi to ukládá zákon.",
    account: "Účet",
    deletedOn: "Smazán dne",
    thanks: "Děkuji za důvěru i za čas, který jste u mě strávili.",
    note: "Dveře dílny zůstávají otevřené — nový účet si můžete založit kdykoli.",
    notYouBefore: "Pokud jste o smazání účtu nežádali, napište mi prosím na",
    closing: "Mějte se krásně,",
  },
  sk: {
    preview: "Váš účet som zmazala. Ďakujem za dôveru.",
    eyebrow: "Váš účet",
    title: "Dovidenia",
    accent: "a ďakujem.",
    intro:
      "váš účet som zmazala. Osobné údaje som odstránila podľa zásad ochrany osobných údajov; históriu objednávok uchovávam len tam, kde mi to ukladá zákon.",
    account: "Účet",
    deletedOn: "Zmazaný dňa",
    thanks: "Ďakujem za dôveru aj za čas, ktorý ste u mňa strávili.",
    note: "Dvere dielne zostávajú otvorené — nový účet si môžete založiť kedykoľvek.",
    notYouBefore: "Ak ste o zmazanie účtu nežiadali, napíšte mi, prosím, na",
    closing: "Majte sa krásne,",
  },
  pl: {
    preview: "Konto zostało usunięte. Dziękuję za zaufanie.",
    eyebrow: "Państwa konto",
    title: "Do zobaczenia",
    accent: "i dziękuję.",
    intro:
      "Konto zostało usunięte. Dane osobowe usunęłam zgodnie z zasadami ochrony danych osobowych; historię zamówień przechowuję tylko tam, gdzie wymaga tego prawo.",
    account: "Konto",
    deletedOn: "Usunięte dnia",
    thanks: "Dziękuję za zaufanie i za czas spędzony w mojej pracowni.",
    note: "Drzwi pracowni pozostają otwarte — nowe konto można założyć w każdej chwili.",
    notYouBefore: "Jeśli nie prosili Państwo o usunięcie konta, proszę napisać na",
    closing: "Wszystkiego dobrego",
  },
  de: {
    preview: "Ihr Konto wurde gelöscht. Danke für Ihr Vertrauen.",
    eyebrow: "Ihr Konto",
    title: "Auf Wiedersehen",
    accent: "und danke.",
    intro:
      "ich habe Ihr Konto gelöscht. Ihre personenbezogenen Daten habe ich gemäß der Datenschutzerklärung entfernt; die Bestellhistorie bewahre ich nur auf, soweit das Gesetz es verlangt.",
    account: "Konto",
    deletedOn: "Gelöscht am",
    thanks: "Danke für Ihr Vertrauen und für die Zeit, die Sie bei mir verbracht haben.",
    note: "Die Tür der Werkstatt bleibt offen – ein neues Konto können Sie jederzeit anlegen.",
    notYouBefore: "Falls Sie die Löschung nicht beantragt haben, schreiben Sie mir bitte an",
    closing: "Alles Gute",
  },
  en: {
    preview: "I've deleted your account. Thank you for your trust.",
    eyebrow: "Your account",
    title: "Goodbye",
    accent: "and thank you.",
    intro:
      "I've deleted your account. I've removed your personal data in line with the privacy policy; I keep your order history only where the law requires me to.",
    account: "Account",
    deletedOn: "Deleted on",
    thanks: "Thank you for your trust and for the time you spent with me.",
    note: "The studio door stays open — you're welcome to create a new account at any time.",
    notYouBefore: "If you didn't ask for your account to be deleted, please write to me at",
    closing: "All the best,",
  },
}

function AccountDeletedEmailComponent({
  customerName = "Vážený zákazník",
  email = "your@email.com",
  deletionDate,
}: AccountDeletedEmailProps) {
  const t = useCopy(COPY)
  const formatDate = useFormatDate()
  // Bez data od odesílatele dnešek — v jazyce e-mailu.
  const date = deletionDate || formatDate(new Date())
  return (
    <EmailLayout preview={t.preview}>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting name={customerName} />
      <P>{t.intro}</P>

      <LedgerRow label={t.account} value={email} />
      <LedgerRow label={t.deletedOn} value={date} />
      <LedgerEnd />

      <P>{t.thanks}</P>

      <Note tone="olive">{t.note}</Note>

      <P small>
        {t.notYouBefore}{" "}
        <Link
          href={`mailto:${CONTACT_EMAIL}`}
          style={{ color: brand.ink, textDecoration: "underline" }}
        >
          {CONTACT_EMAIL}
        </Link>
        .
      </P>
      <Signature closing={t.closing} />
    </EmailLayout>
  );
}

export const AccountDeletedEmail = (props: AccountDeletedEmailProps) => (
  <AccountDeletedEmailComponent {...props} />
);

// Mock data for preview/development
const mockAccountDeleted: AccountDeletedEmailProps = {
  customerName: "Vážený zákazník",
  email: "jana.novakova@example.cz",
};

export default () => <AccountDeletedEmailComponent {...mockAccountDeleted} />;
