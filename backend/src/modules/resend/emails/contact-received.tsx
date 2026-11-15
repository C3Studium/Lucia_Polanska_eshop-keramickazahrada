import {
  brand,
  EmailH1,
  EmailLayout,
  Eyebrow,
  Greeting,
  MultiLine,
  P,
  Signature,
} from "../components/email-ui"
import { useCopy } from "../components/email-i18n"
import type { Localized } from "../../../lib/email-locale"

/**
 * „Zprávu mám" — potvrzení zákazníkovi po odeslání kontaktního formuláře
 * (`api/store/contact`, 15. 11. 2026). Dřív odcházela jen zpráva majitelce
 * a zákazník neměl v ruce nic; formulář dokonce říkal „kopii jsem vám
 * neposílala".
 *
 * Opakuje text zprávy (jak ho napsal — adresa není ověřená, proto bez
 * odkazů a bez ničeho, co by šlo zneužít jako spam s cizím obsahem navíc).
 */
export interface ContactReceivedEmailProps {
  customerName?: string | null
  message?: string | null
}

export const COPY: Localized<{
  preview: string
  eyebrow: string
  title: string
  accent: string
  intro: string
  yours: string
  more: string
  closing: string
}> = {
  cs: {
    preview: "Vaše zpráva ke mně dorazila — ozvu se do dvou pracovních dnů.",
    eyebrow: "Kontakt · Zpráva přijata",
    title: "Zprávu",
    accent: "mám.",
    intro:
      "děkuji za zprávu — dorazila v pořádku. Ozvu se vám zpravidla do dvou pracovních dnů; když stojím u pece, může to výjimečně trvat o kousek déle.",
    yours: "Vaše zpráva",
    more: "Chcete něco doplnit? Stačí na tento e-mail odpovědět.",
    closing: "Děkuji a ozvu se,",
  },
  sk: {
    preview: "Vaša správa ku mne dorazila — ozvem sa do dvoch pracovných dní.",
    eyebrow: "Kontakt · Správa prijatá",
    title: "Správu",
    accent: "mám.",
    intro:
      "ďakujem za správu — dorazila v poriadku. Ozvem sa vám spravidla do dvoch pracovných dní; keď stojím pri peci, môže to výnimočne trvať o kúsok dlhšie.",
    yours: "Vaša správa",
    more: "Chcete niečo doplniť? Stačí na tento e-mail odpovedať.",
    closing: "Ďakujem a ozvem sa,",
  },
  pl: {
    preview: "Państwa wiadomość dotarła — odezwę się w ciągu dwóch dni roboczych.",
    eyebrow: "Kontakt · Wiadomość odebrana",
    title: "Wiadomość",
    accent: "dotarła.",
    intro:
      "dziękuję za wiadomość — dotarła bez problemu. Odezwę się zwykle w ciągu dwóch dni roboczych; gdy pracuję przy piecu, może to potrwać nieco dłużej.",
    yours: "Państwa wiadomość",
    more: "Chcą Państwo coś dodać? Wystarczy odpowiedzieć na ten e-mail.",
    closing: "Dziękuję i odezwę się,",
  },
  de: {
    preview: "Ihre Nachricht ist angekommen — ich melde mich innerhalb von zwei Werktagen.",
    eyebrow: "Kontakt · Nachricht erhalten",
    title: "Nachricht",
    accent: "erhalten.",
    intro:
      "vielen Dank für Ihre Nachricht — sie ist gut angekommen. Ich melde mich in der Regel innerhalb von zwei Werktagen; wenn ich am Brennofen stehe, kann es ausnahmsweise etwas länger dauern.",
    yours: "Ihre Nachricht",
    more: "Möchten Sie etwas ergänzen? Antworten Sie einfach auf diese E-Mail.",
    closing: "Vielen Dank, ich melde mich,",
  },
  en: {
    preview: "Your message has arrived — I'll reply within two working days.",
    eyebrow: "Contact · Message received",
    title: "Message",
    accent: "received.",
    intro:
      "thank you for your message — it arrived safely. I usually reply within two working days; when I'm at the kiln it can take a little longer.",
    yours: "Your message",
    more: "Want to add something? Just reply to this e-mail.",
    closing: "Thank you, I'll be in touch,",
  },
}

function ContactReceivedEmailComponent({ customerName, message }: ContactReceivedEmailProps) {
  const t = useCopy(COPY)
  return (
    <EmailLayout preview={t.preview}>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting name={customerName} />
      <P>{t.intro}</P>

      {message?.trim() ? (
        <>
          <Eyebrow style={{ margin: "28px 0 10px" }}>{t.yours}</Eyebrow>
          <P style={{ color: brand.ink }}>
            <MultiLine value={message} />
          </P>
        </>
      ) : null}

      <P>{t.more}</P>
      <Signature closing={t.closing} />
    </EmailLayout>
  )
}

export const ContactReceivedEmail = (props: ContactReceivedEmailProps) => (
  <ContactReceivedEmailComponent {...props} />
)

const mock: ContactReceivedEmailProps = {
  customerName: "Jana Nováková",
  message: "Dobrý den,\ndělali byste i větší misku na ovoce?\nDěkuji, Jana",
}

export default () => <ContactReceivedEmailComponent {...mock} />
