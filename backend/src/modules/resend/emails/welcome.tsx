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
import { storeLink } from "../../../lib/storefront-url"
import { useCopy } from "../components/email-i18n"
import type { Localized } from "../../../lib/email-locale"

interface WelcomeEmailProps {
  customerName?: string;
}

/** Texty po jazycích (lib/email-locale) — čeština je původní znění. */
const COPY: Localized<{
  preview: string
  eyebrow: string
  title: string
  accent: string
  thanks: string
  about: string
  note: string
  browse: string
  why: string
}> = {
  cs: {
    preview: "Účet máte hotový. Pár slov od mě, než se porozhlédnete.",
    eyebrow: "Váš účet",
    title: "Vítejte v Keramické",
    accent: "zahradě.",
    thanks:
      "děkuji, že jste si u mě založili účet. Objednávky, adresy i oblíbené kousky teď najdete na jednom místě.",
    about:
      "Jsem Lucie, keramička z Písku. Všechno, co tu najdete, modeluju, glazuju a pálím sama u sebe v dílně — a sama taky balím a odpovídám na e-maily. Když mi napíšete, odpovím vám já.",
    note: "Každý kousek je trochu jiný než ten na fotce — tak to u ruční práce chodí.",
    browse: "Prohlédnout nabídku",
    why: "Tento e-mail vám posílám, protože jste si vytvořili účet na keramickazahrada.cz.",
  },
  sk: {
    preview: "Účet máte hotový. Pár slov odo mňa, kým sa porozhliadnete.",
    eyebrow: "Váš účet",
    title: "Vitajte v Keramickej",
    accent: "záhrade.",
    thanks:
      "ďakujem, že ste si u mňa založili účet. Objednávky, adresy aj obľúbené kúsky teraz nájdete na jednom mieste.",
    about:
      "Som Lucie, keramikárka z Písku. Všetko, čo tu nájdete, modelujem, glazujem a vypaľujem sama vo svojej dielni — a sama aj balím a odpovedám na e-maily. Keď mi napíšete, odpíšem vám ja.",
    note: "Každý kúsok je trochu iný ako ten na fotke — tak to pri ručnej práci chodí.",
    browse: "Pozrieť ponuku",
    why: "Tento e-mail vám posielam, pretože ste si vytvorili účet na keramickazahrada.cz.",
  },
  pl: {
    preview: "Konto jest gotowe. Kilka słów ode mnie, zanim się Państwo rozejrzą.",
    eyebrow: "Państwa konto",
    title: "Witamy w Keramickiej",
    accent: "Zahradzie.",
    thanks:
      "Dziękuję za założenie konta. Zamówienia, adresy i ulubione egzemplarze znajdą Państwo teraz w jednym miejscu.",
    about:
      "Jestem Lucie, ceramiczka z Písku. Wszystko, co tu Państwo znajdą, sama modeluję, szkliwię i wypalam w swojej pracowni — sama też pakuję paczki i odpowiadam na e-maile. Gdy Państwo do mnie napiszą, odpowiem osobiście.",
    note: "Każdy egzemplarz jest trochę inny niż ten na zdjęciu — tak to już jest z ręczną pracą.",
    browse: "Zobacz ofertę",
    why: "Wysyłam tę wiadomość, ponieważ założyli Państwo konto na keramickazahrada.cz.",
  },
  de: {
    preview: "Ihr Konto ist eingerichtet. Ein paar Worte von mir, bevor Sie sich umsehen.",
    eyebrow: "Ihr Konto",
    title: "Willkommen in der",
    accent: "Keramická zahrada.",
    thanks:
      "vielen Dank, dass Sie bei mir ein Konto angelegt haben. Bestellungen, Adressen und Lieblingsstücke finden Sie jetzt an einem Ort.",
    about:
      "Ich bin Lucie, Keramikerin aus Písek. Alles, was Sie hier finden, modelliere, glasiere und brenne ich selbst in meiner Werkstatt – und ich packe auch selbst und beantworte die E-Mails. Wenn Sie mir schreiben, antworte ich Ihnen persönlich.",
    note: "Jedes Stück sieht ein wenig anders aus als auf dem Foto – so ist das bei Handarbeit.",
    browse: "Zum Angebot",
    why: "Sie erhalten diese E-Mail, weil Sie ein Konto auf keramickazahrada.cz angelegt haben.",
  },
  en: {
    preview: "Your account is ready. A few words from me before you have a look around.",
    eyebrow: "Your account",
    title: "Welcome to",
    accent: "Keramická zahrada.",
    thanks:
      "Thank you for creating an account with me. Your orders, addresses and favourite pieces are now all in one place.",
    about:
      "I'm Lucie, a potter from Písek. Everything you'll find here I shape, glaze and fire myself in my studio — and I do the packing and answer the e-mails myself, too. If you write to me, I'll reply to you personally.",
    note: "Every piece looks a little different from the photo — that's the nature of handmade work.",
    browse: "Browse the shop",
    why: "You're receiving this e-mail because you created an account at keramickazahrada.cz.",
  },
}

function WelcomeEmailComponent({ customerName }: WelcomeEmailProps) {
  const t = useCopy(COPY)
  const shopUrl = storeLink()
  return (
    <EmailLayout preview={t.preview}>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting name={customerName} />
      <P>{t.thanks}</P>
      <P>{t.about}</P>

      <Note tone="olive">{t.note}</Note>

      {shopUrl ? (
        <ButtonRow>
          <EmailButton href={shopUrl}>{t.browse}</EmailButton>
        </ButtonRow>
      ) : null}

      <P small>{t.why}</P>
      <Signature />
    </EmailLayout>
  );
}

export const WelcomeEmail = (props: WelcomeEmailProps) => (
  <WelcomeEmailComponent {...props} />
);

// Mock data for preview/development
const mockWelcome: WelcomeEmailProps = {
  customerName: "Vážený zákazník",
};

export default () => <WelcomeEmailComponent {...mockWelcome} />;
