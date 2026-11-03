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
import { useCopy } from "../components/email-i18n"
import type { Localized } from "../../../lib/email-locale"

type PasswordResetEmailProps = {
  reset_url: string
  email?: string
}

/** Texty po jazycích (lib/email-locale) — čeština je původní znění. */
const COPY: Localized<{
  preview: string
  eyebrow: string
  title: string
  accent: string
  intro: string
  account: string
  button: string
  fallback: string
  safety: string
}> = {
  cs: {
    preview: "Nové heslo si nastavíte jedním kliknutím. Odkaz platí 15 minut.",
    eyebrow: "Váš účet",
    title: "Nastavte si nové",
    accent: "heslo.",
    intro:
      "někdo — nejspíš vy — požádal o nové heslo k vašemu účtu. Nastavíte si ho tlačítkem níže; odkaz platí 15 minut, potom si můžete nechat poslat nový.",
    account: "Účet",
    button: "Nastavit nové heslo",
    fallback: "Pokud tlačítko nefunguje, zkopírujte do prohlížeče tuto adresu:",
    safety:
      "Odkaz je určený jen vám, nikomu ho prosím nepředávejte. Pokud jste o nové heslo nežádali, nic se neděje — vaše heslo zůstává, jak je. Kdyby vás to znepokojilo, napište mi na info@keramickazahrada.cz.",
  },
  sk: {
    preview: "Nové heslo si nastavíte jedným kliknutím. Odkaz platí 15 minút.",
    eyebrow: "Váš účet",
    title: "Nastavte si nové",
    accent: "heslo.",
    intro:
      "niekto — najskôr vy — požiadal o nové heslo k vášmu účtu. Nastavíte si ho tlačidlom nižšie; odkaz platí 15 minút, potom si môžete nechať poslať nový.",
    account: "Účet",
    button: "Nastaviť nové heslo",
    fallback: "Ak tlačidlo nefunguje, skopírujte do prehliadača túto adresu:",
    safety:
      "Odkaz je určený len vám, nikomu ho, prosím, neposielajte. Ak ste o nové heslo nežiadali, nič sa nedeje — vaše heslo zostáva, ako je. Keby vás to znepokojilo, napíšte mi na info@keramickazahrada.cz.",
  },
  pl: {
    preview: "Nowe hasło ustawią Państwo jednym kliknięciem. Link jest ważny 15 minut.",
    eyebrow: "Państwa konto",
    title: "Prosimy ustawić nowe",
    accent: "hasło.",
    intro:
      "Ktoś — najpewniej Państwo — poprosił o nowe hasło do konta. Można je ustawić przyciskiem poniżej; link jest ważny 15 minut, potem można poprosić o nowy.",
    account: "Konto",
    button: "Ustaw nowe hasło",
    fallback: "Jeśli przycisk nie działa, proszę skopiować ten adres do przeglądarki:",
    safety:
      "Link jest przeznaczony tylko dla Państwa — proszę go nikomu nie przekazywać. Jeśli nie prosili Państwo o nowe hasło, nic się nie stało — dotychczasowe hasło pozostaje bez zmian. W razie niepokoju proszę napisać na info@keramickazahrada.cz.",
  },
  de: {
    preview: "Ihr neues Passwort legen Sie mit einem Klick fest. Der Link gilt 15 Minuten.",
    eyebrow: "Ihr Konto",
    title: "Legen Sie ein neues",
    accent: "Passwort fest.",
    intro:
      "jemand – vermutlich Sie selbst – hat ein neues Passwort für Ihr Konto angefordert. Über die Schaltfläche unten legen Sie es fest; der Link gilt 15 Minuten, danach können Sie einen neuen anfordern.",
    account: "Konto",
    button: "Neues Passwort festlegen",
    fallback: "Falls die Schaltfläche nicht funktioniert, kopieren Sie diese Adresse in Ihren Browser:",
    safety:
      "Der Link ist nur für Sie bestimmt – bitte geben Sie ihn nicht weiter. Falls Sie kein neues Passwort angefordert haben, ist nichts passiert – Ihr bisheriges Passwort bleibt gültig. Wenn Sie das beunruhigt, schreiben Sie mir an info@keramickazahrada.cz.",
  },
  en: {
    preview: "Set your new password in one click. The link is valid for 15 minutes.",
    eyebrow: "Your account",
    title: "Set a new",
    accent: "password.",
    intro:
      "Someone — most likely you — asked for a new password for your account. You can set it using the button below; the link is valid for 15 minutes, after which you can request a new one.",
    account: "Account",
    button: "Set a new password",
    fallback: "If the button doesn't work, copy this address into your browser:",
    safety:
      "This link is meant only for you — please don't share it. If you didn't ask for a new password, nothing has changed and your current password still works. If this worries you, write to me at info@keramickazahrada.cz.",
  },
}

function PasswordResetEmailComponent({ reset_url, email }: PasswordResetEmailProps) {
  const t = useCopy(COPY)
  return (
    <EmailLayout preview={t.preview}>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting />
      <P>{t.intro}</P>

      {email ? (
        <>
          <LedgerRow label={t.account} value={email} />
          <LedgerEnd />
        </>
      ) : null}

      <ButtonRow>
        <EmailButton href={reset_url}>{t.button}</EmailButton>
      </ButtonRow>

      <P small>
        {t.fallback}
        <br />
        <Link
          href={reset_url}
          style={{
            color: brand.olive,
            textDecoration: "underline",
            wordBreak: "break-all",
          }}
        >
          {reset_url}
        </Link>
      </P>

      <P small>{t.safety}</P>
      <Signature />
    </EmailLayout>
  )
}

export const passwordResetEmail = (props: PasswordResetEmailProps) => (
  <PasswordResetEmailComponent {...props} />
)

// Mock data for preview/development
const mockPasswordReset: PasswordResetEmailProps = {
  reset_url: "https://keramickazahrada.cz/reset-password?token=sample-reset-token-123",
  email: "jana.novakova@example.cz",
}

export default () => <PasswordResetEmailComponent {...mockPasswordReset} />
