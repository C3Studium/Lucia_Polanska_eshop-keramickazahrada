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

type EmailVerificationProps = {
  verification_url: string
  email?: string
}

/** Texty po jazycích (lib/email-locale) — čeština je původní znění. */
const COPY: Localized<{
  preview: string
  eyebrow: string
  title: string
  accent: string
  intro: string
  email: string
  confirm: string
  fallback: string
  notYou: string
}> = {
  cs: {
    preview: "Zbývá jediný krok — potvrdit, že je tahle adresa vaše. Odkaz platí 24 hodin.",
    eyebrow: "Váš účet",
    title: "Potvrďte svou",
    accent: "adresu.",
    intro:
      "zbývá poslední krok — potvrdit, že tato e-mailová adresa patří vám. Stačí jedno kliknutí; odkaz platí 24 hodin.",
    email: "E-mail",
    confirm: "Potvrdit e-mail",
    fallback: "Pokud tlačítko nefunguje, zkopírujte do prohlížeče tuto adresu:",
    notYou:
      "Pokud jste si u mě účet nezakládali, nic se neděje — bez potvrzení se nic nestane. Kdybyste si nebyli jistí, napište mi na info@keramickazahrada.cz.",
  },
  sk: {
    preview: "Zostáva jediný krok — potvrdiť, že je táto adresa vaša. Odkaz platí 24 hodín.",
    eyebrow: "Váš účet",
    title: "Potvrďte svoju",
    accent: "adresu.",
    intro:
      "zostáva posledný krok — potvrdiť, že táto e-mailová adresa patrí vám. Stačí jedno kliknutie; odkaz platí 24 hodín.",
    email: "E-mail",
    confirm: "Potvrdiť e-mail",
    fallback: "Ak tlačidlo nefunguje, skopírujte do prehliadača túto adresu:",
    notYou:
      "Ak ste si u mňa účet nezakladali, nič sa nedeje — bez potvrdenia sa nič nestane. Keby ste si neboli istí, napíšte mi na info@keramickazahrada.cz.",
  },
  pl: {
    preview: "Został ostatni krok — potwierdzenie, że ten adres należy do Państwa. Link jest ważny 24 godziny.",
    eyebrow: "Państwa konto",
    title: "Prosimy potwierdzić",
    accent: "adres.",
    intro:
      "Został już tylko ostatni krok — potwierdzenie, że ten adres e-mail należy do Państwa. Wystarczy jedno kliknięcie; link jest ważny 24 godziny.",
    email: "E-mail",
    confirm: "Potwierdź e-mail",
    fallback: "Jeśli przycisk nie działa, proszę skopiować ten adres do przeglądarki:",
    notYou:
      "Jeśli nie zakładali Państwo u mnie konta, nic się nie stało — bez potwierdzenia konto nie zostanie aktywowane. W razie wątpliwości proszę napisać na info@keramickazahrada.cz.",
  },
  de: {
    preview: "Nur noch ein Schritt – bestätigen Sie, dass diese Adresse Ihnen gehört. Der Link gilt 24 Stunden.",
    eyebrow: "Ihr Konto",
    title: "Bitte bestätigen Sie",
    accent: "Ihre Adresse.",
    intro:
      "es fehlt nur noch ein Schritt: die Bestätigung, dass diese E-Mail-Adresse Ihnen gehört. Ein Klick genügt; der Link gilt 24 Stunden.",
    email: "E-Mail",
    confirm: "E-Mail bestätigen",
    fallback: "Falls die Schaltfläche nicht funktioniert, kopieren Sie diese Adresse in Ihren Browser:",
    notYou:
      "Falls Sie bei mir kein Konto angelegt haben, ist nichts passiert – ohne Bestätigung geschieht nichts. Wenn Sie unsicher sind, schreiben Sie mir an info@keramickazahrada.cz.",
  },
  en: {
    preview: "Just one more step — please confirm this address is yours. The link is valid for 24 hours.",
    eyebrow: "Your account",
    title: "Please confirm",
    accent: "your address.",
    intro:
      "There's just one more step: confirming that this e-mail address belongs to you. One click is all it takes; the link is valid for 24 hours.",
    email: "E-mail",
    confirm: "Confirm my e-mail",
    fallback: "If the button doesn't work, copy this address into your browser:",
    notYou:
      "If you didn't create an account with me, don't worry — nothing happens without confirmation. If you're unsure, write to me at info@keramickazahrada.cz.",
  },
}

function EmailVerificationComponent({ verification_url, email }: EmailVerificationProps) {
  const t = useCopy(COPY)
  return (
    <EmailLayout preview={t.preview}>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting />
      <P>{t.intro}</P>

      {email ? (
        <>
          <LedgerRow label={t.email} value={email} />
          <LedgerEnd />
        </>
      ) : null}

      <ButtonRow>
        <EmailButton href={verification_url}>{t.confirm}</EmailButton>
      </ButtonRow>

      <P small>
        {t.fallback}
        <br />
        <Link
          href={verification_url}
          style={{
            color: brand.olive,
            textDecoration: "underline",
            wordBreak: "break-all",
          }}
        >
          {verification_url}
        </Link>
      </P>

      <P small>{t.notYou}</P>
      <Signature />
    </EmailLayout>
  )
}

export const emailVerificationEmail = (props: EmailVerificationProps) => (
  <EmailVerificationComponent {...props} />
)

// Mock data for preview/development
const mockVerification: EmailVerificationProps = {
  verification_url: "https://keramickazahrada.cz/verify-email?token=sample-verification-token-123",
  email: "jana.novakova@example.cz",
}

export default () => <EmailVerificationComponent {...mockVerification} />
