import { Img, Section } from "@react-email/components"
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
import { useCopy } from "../components/email-i18n"
import type { Localized } from "../../../lib/email-locale"

interface CommissionMessageEmailProps {
  customerName?: string;
  orderNumber?: string;
  orderLink?: string;
  /** Text zprávy od ateliéru (může být prázdný, když je to jen fotka) — jde, jak ho napsala. */
  message?: string;
  /** Přiložená fotka (URL), když ji ateliér poslal. */
  photoUrl?: string;
  /** Název položky zakázky — u objednávky s víc zakázkami říká, ke které zpráva patří. */
  productTitle?: string | null;
}

/**
 * Texty po jazycích (lib/email-locale) — čeština je původní znění. Samotnou
 * zprávu píše Lucie a jde tak, jak ji napsala; přeložený je jen rámeček.
 */
const COPY: Localized<{
  preview: (orderNumber: string) => string
  eyebrow: string
  title: string
  accent: string
  intro: (orderNumber: string, productTitle: string) => string
  photoOnly: string
  photoAlt: string
  reply: string
  replyButton: string
}> = {
  cs: {
    preview: (n) => `Píšu vám z dílny k zakázce ${n}.`,
    eyebrow: "Zakázka",
    title: "Zpráva z dílny",
    accent: "k vaší zakázce.",
    intro: (n, title) =>
      `píšu vám k vaší zakázce${n ? ` ${n}` : ""}${title ? ` (${title})` : ""}:`,
    photoOnly: "Posílám fotku z výroby — podívejte se, jak to zatím vypadá.",
    photoAlt: "Fotka z výroby",
    reply:
      "Odpovědět mi můžete přímo u své objednávky — napište mi tam, nebo přiložte vlastní fotku. Celé naše vlákno tam uvidíte pohromadě.",
    replyButton: "Odpovědět Lucii",
  },
  sk: {
    preview: (n) => `Píšem vám z dielne k zákazke ${n}.`,
    eyebrow: "Zákazka",
    title: "Správa z dielne",
    accent: "k vašej zákazke.",
    intro: (n, title) =>
      `píšem vám k vašej zákazke${n ? ` ${n}` : ""}${title ? ` (${title})` : ""}:`,
    photoOnly: "Posielam fotku z výroby — pozrite sa, ako to zatiaľ vyzerá.",
    photoAlt: "Fotka z výroby",
    reply:
      "Odpovedať mi môžete priamo pri svojej objednávke — napíšte mi tam alebo priložte vlastnú fotku. Celú našu konverzáciu tam uvidíte pohromade.",
    replyButton: "Odpovedať Lucii",
  },
  pl: {
    preview: (n) => `Piszę z pracowni w sprawie zamówienia indywidualnego ${n}.`,
    eyebrow: "Zamówienie indywidualne",
    title: "Wiadomość z pracowni",
    accent: "w sprawie Państwa zamówienia.",
    intro: (n, title) =>
      `Piszę w sprawie Państwa zamówienia indywidualnego${n ? ` ${n}` : ""}${title ? ` (${title})` : ""}:`,
    photoOnly: "Przesyłam zdjęcie z produkcji — proszę zobaczyć, jak to na razie wygląda.",
    photoAlt: "Zdjęcie z produkcji",
    reply:
      "Odpowiedzieć mogą Państwo bezpośrednio przy swoim zamówieniu — wystarczy tam napisać albo dołączyć własne zdjęcie. Całą naszą korespondencję zobaczą tam Państwo w jednym miejscu.",
    replyButton: "Odpowiedz Lucii",
  },
  de: {
    preview: (n) => `Ich schreibe Ihnen aus der Werkstatt zu Ihrer Auftragsarbeit ${n}.`,
    eyebrow: "Auftragsarbeit",
    title: "Nachricht aus der Werkstatt",
    accent: "zu Ihrer Auftragsarbeit.",
    intro: (n, title) =>
      `ich schreibe Ihnen zu Ihrer Auftragsarbeit${n ? ` ${n}` : ""}${title ? ` (${title})` : ""}:`,
    photoOnly: "Ich schicke Ihnen ein Foto aus der Werkstatt – so sieht es bisher aus.",
    photoAlt: "Foto aus der Werkstatt",
    reply:
      "Antworten können Sie mir direkt bei Ihrer Bestellung – schreiben Sie mir dort oder hängen Sie ein eigenes Foto an. Dort sehen Sie auch unseren ganzen Verlauf auf einen Blick.",
    replyButton: "Lucie antworten",
  },
  en: {
    preview: (n) => `A note from the studio about your commission ${n}.`,
    eyebrow: "Commission",
    title: "A note from the studio",
    accent: "about your commission.",
    intro: (n, title) =>
      `I'm writing to you about your commission${n ? ` ${n}` : ""}${title ? ` (${title})` : ""}:`,
    photoOnly: "Here's a photo from the studio — take a look at how it's coming along.",
    photoAlt: "Photo from the studio",
    reply:
      "You can reply to me directly on your order page — write to me there or attach a photo of your own. You'll see our whole conversation there in one place.",
    replyButton: "Reply to Lucie",
  },
}

/**
 * „Nová zpráva k vaší zakázce" — když majitelka v deníku zakázky přidá zápis
 * viditelný zákazníkovi (fotka z výroby, dotaz, update). Je to polovina chatu:
 * zákazník odpoví na své stránce objednávky, kde celé vlákno vidí.
 */
function CommissionMessageEmailComponent({
  customerName,
  orderNumber = "",
  orderLink = "",
  message,
  photoUrl,
  productTitle,
}: CommissionMessageEmailProps) {
  const t = useCopy(COPY)
  return (
    <EmailLayout preview={t.preview(orderNumber)}>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting name={customerName} />
      <P>{t.intro(orderNumber, productTitle ?? "")}</P>

      {message && message.trim() ? (
        <Note tone="olive">{message}</Note>
      ) : (
        <P>{t.photoOnly}</P>
      )}

      {photoUrl ? (
        <Section style={{ margin: "20px 0 0" }}>
          <Img
            src={photoUrl}
            alt={t.photoAlt}
            width="100%"
            style={{
              maxWidth: "420px",
              borderRadius: "12px",
              objectFit: "cover",
              backgroundColor: brand.stone,
            }}
          />
        </Section>
      ) : null}

      <P style={{ margin: "20px 0 0" }}>{t.reply}</P>

      {orderLink ? (
        <ButtonRow>
          <EmailButton href={orderLink}>{t.replyButton}</EmailButton>
        </ButtonRow>
      ) : null}
      <Signature />
    </EmailLayout>
  )
}

export const CommissionMessageEmail = (props: CommissionMessageEmailProps) => (
  <CommissionMessageEmailComponent {...props} />
)

// Mock data for preview/development (zpráva je volný text Lucie — v náhledu
// jen fotka, ať je vidět přeložený rámeček).
const mockCommissionMessage: CommissionMessageEmailProps = {
  customerName: "Jana Nováková",
  orderNumber: "#0026",
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed",
  photoUrl:
    "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
}

export default () => (
  <CommissionMessageEmailComponent {...mockCommissionMessage} />
)
