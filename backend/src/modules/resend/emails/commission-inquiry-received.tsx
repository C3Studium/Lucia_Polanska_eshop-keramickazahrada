import { Link, Section } from "@react-email/components"
import {
  brand,
  EmailH1,
  EmailLayout,
  Eyebrow,
  Greeting,
  LedgerEnd,
  LedgerRow,
  MultiLine,
  Note,
  P,
  Signature,
} from "../components/email-ui"
import { useCopy } from "../components/email-i18n"
import type { Localized } from "../../../lib/email-locale"

/**
 * „Poptávku jsme přijali" — potvrzení poptávky zakázky ze stránky Výroba
 * (`api/store/commission-inquiries`, data skládá `lib/commission-inquiry`).
 *
 * Co musí říct (LEGAL_AUDIT.md §2):
 * - že poptávka dorazila a co z ní Lucie má (shrnutí),
 * - co bude dál: nabídka s cenou, dodací lhůtou a zálohou,
 * - že smlouva vzniká AŽ potvrzením nabídky nebo zaplacením zálohy —
 *   poptávka sama zákazníka k ničemu nezavazuje,
 * - poučení, že zakázku podle zadání nelze vrátit ve 14 dnech
 *   (§ 1837 písm. d) OZ) — ať to zákazník ví dřív, než dostane nabídku,
 * - verzi OP a čas souhlasu (serverový).
 *
 * Text zákazníka se opakuje zkrácený a bez odkazů (adresa není ověřená),
 * fotky jen počtem.
 */
export interface CommissionInquiryReceivedEmailProps {
  customerName?: string | null
  description?: string | null
  dimensions?: string | null
  motif?: string | null
  deadline?: string | null
  phone?: string | null
  photoCount?: number | null
  termsVersion?: string | null
  /** „15. 10. 2026" — datum účinnosti verze OP; `null` = verze neznámá. */
  termsVersionLabel?: string | null
  consentedAt?: string | null
  /** „14. 10. 2026 15:32" (Praha). */
  consentedAtLabel?: string | null
  termsUrl?: string | null
  privacyUrl?: string | null
}

const linkStyle = { color: brand.ink, textDecoration: "underline" } as const

/**
 * Texty po jazycích (lib/email-locale) — čeština je původní znění. Poučení
 * o vyloučení odstoupení (§ 1837 písm. d) OZ) a věta o vzniku smlouvy jsou
 * právně nosné a překlad říká přesně totéž. Text zákazníka (popis, motiv,
 * termín) jde, jak ho napsal.
 */
const COPY: Localized<{
  preview: string
  eyebrow: string
  title: string
  accent: string
  intro: string
  dimensions: string
  motif: string
  deadline: string
  photos: string
  phone: string
  photoLabel: (count: number) => string
  wish: string
  next: string
  offerTitle: string
  offer: string
  confirmTitle: string
  confirm: string
  productionTitle: string
  production: string
  noWithdrawal: string
  more: string
  termsWith: (versionLabel: string | null) => string
  consentBefore: string
  dataUse: string
  privacy: string
  closing: string
}> = {
  cs: {
    preview: "Poptávka dorazila — ozvu se vám s nabídkou.",
    eyebrow: "Zakázka · Poptávka",
    title: "Děkuji za",
    accent: "poptávku.",
    intro:
      "vaše poptávka ke mně dorazila. Projdu si ji a ozvu se vám — zpravidla do dvou pracovních dnů — s nabídkou, nebo napřed s otázkami, které budu k návrhu potřebovat.",
    dimensions: "Rozměry",
    motif: "Motiv / text / číslo",
    deadline: "Termín",
    photos: "Fotografie místa",
    phone: "Telefon",
    photoLabel: (count) =>
      count === 1 ? "1 fotka" : count >= 2 && count <= 4 ? `${count} fotky` : `${count} fotek`,
    wish: "Co si představujete",
    next: "Co bude dál",
    offerTitle: "Nabídka",
    offer:
      "Pošlu vám nabídku s cenou, dodací lhůtou a výší zálohy — podle potřeby s náčrtem nebo popisem, jak to udělám.",
    confirmTitle: "Potvrzení",
    confirm:
      "Smlouva vzniká, až nabídku potvrdíte nebo zaplatíte zálohu. Do té doby vás poptávka k ničemu nezavazuje.",
    productionTitle: "Výroba",
    production: "Do práce se pustím po připsání zálohy — a napíšu vám, že jsem začala.",
    noWithdrawal:
      "Zakázku vyrobenou podle vašeho zadání nelze vrátit ve 14denní lhůtě pro odstoupení od smlouvy (§ 1837 písm. d) občanského zákoníku). Proto si všechno důležité — podobu, rozměry i barvy — domluvíme předem.",
    more:
      "Chcete něco doplnit, třeba další fotku místa? Napište mi na info@keramickazahrada.cz, odpovídám sama.",
    termsWith: (label) =>
      label ? `obchodními podmínkami ve znění účinném od ${label}` : "obchodními podmínkami",
    consentBefore: "Odesláním poptávky jste vyjádřili souhlas s",
    dataUse: "Údaje z poptávky použiju jen k vypracování nabídky",
    privacy: "zásady ochrany osobních údajů",
    closing: "Děkuji a těším se,",
  },
  sk: {
    preview: "Dopyt dorazil — ozvem sa vám s ponukou.",
    eyebrow: "Zákazka · Dopyt",
    title: "Ďakujem za",
    accent: "dopyt.",
    intro:
      "váš dopyt ku mne dorazil. Prejdem si ho a ozvem sa vám — spravidla do dvoch pracovných dní — s ponukou, alebo najprv s otázkami, ktoré budem k návrhu potrebovať.",
    dimensions: "Rozmery",
    motif: "Motív / text / číslo",
    deadline: "Termín",
    photos: "Fotografie miesta",
    phone: "Telefón",
    photoLabel: (count) =>
      count === 1 ? "1 fotka" : count >= 2 && count <= 4 ? `${count} fotky` : `${count} fotiek`,
    wish: "Čo si predstavujete",
    next: "Čo bude ďalej",
    offerTitle: "Ponuka",
    offer:
      "Pošlem vám ponuku s cenou, dodacou lehotou a výškou zálohy — podľa potreby s náčrtom alebo popisom, ako to urobím.",
    confirmTitle: "Potvrdenie",
    confirm:
      "Zmluva vzniká, až keď ponuku potvrdíte alebo zaplatíte zálohu. Dovtedy vás dopyt k ničomu nezaväzuje.",
    productionTitle: "Výroba",
    production: "Do práce sa pustím po pripísaní zálohy — a napíšem vám, že som začala.",
    noWithdrawal:
      "Zákazku vyrobenú podľa vášho zadania nie je možné vrátiť v 14-dňovej lehote na odstúpenie od zmluvy (§ 1837 písm. d) českého Občianskeho zákonníka a čl. 16 písm. c) smernice 2011/83/EÚ). Preto si všetko dôležité — podobu, rozmery aj farby — dohodneme vopred.",
    more:
      "Chcete niečo doplniť, napríklad ďalšiu fotku miesta? Napíšte mi na info@keramickazahrada.cz, odpovedám sama.",
    termsWith: (label) =>
      label ? `obchodnými podmienkami v znení účinnom od ${label}` : "obchodnými podmienkami",
    consentBefore: "Odoslaním dopytu ste vyjadrili súhlas s",
    dataUse: "Údaje z dopytu použijem len na vypracovanie ponuky",
    privacy: "zásady ochrany osobných údajov",
    closing: "Ďakujem a teším sa,",
  },
  pl: {
    preview: "Zapytanie dotarło — odezwę się z ofertą.",
    eyebrow: "Zamówienie indywidualne · Zapytanie",
    title: "Dziękuję za",
    accent: "zapytanie.",
    intro:
      "Państwa zapytanie do mnie dotarło. Przejrzę je i odezwę się — zwykle w ciągu dwóch dni roboczych — z ofertą albo najpierw z pytaniami, których odpowiedzi będę potrzebować do projektu.",
    dimensions: "Wymiary",
    motif: "Motyw / tekst / numer",
    deadline: "Termin",
    photos: "Zdjęcia miejsca",
    phone: "Telefon",
    photoLabel: (count) =>
      count === 1
        ? "1 zdjęcie"
        : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14)
          ? `${count} zdjęcia`
          : `${count} zdjęć`,
    wish: "Państwa pomysł",
    next: "Co dalej",
    offerTitle: "Oferta",
    offer:
      "Wyślę Państwu ofertę z ceną, terminem realizacji i wysokością zaliczki — w razie potrzeby ze szkicem albo opisem, jak to wykonam.",
    confirmTitle: "Potwierdzenie",
    confirm:
      "Umowa zostaje zawarta dopiero wtedy, gdy potwierdzą Państwo ofertę albo zapłacą zaliczkę. Do tego czasu zapytanie do niczego Państwa nie zobowiązuje.",
    productionTitle: "Wykonanie",
    production: "Do pracy zabiorę się po zaksięgowaniu zaliczki — i napiszę, że zaczęłam.",
    noWithdrawal:
      "Wyrobu wykonanego według Państwa wytycznych nie można zwrócić w 14-dniowym terminie na odstąpienie od umowy (§ 1837 lit. d) czeskiego kodeksu cywilnego oraz art. 16 lit. c) dyrektywy 2011/83/UE). Dlatego wszystkie ważne szczegóły — wygląd, wymiary i kolory — ustalimy z góry.",
    more:
      "Chcą Państwo coś dodać, na przykład kolejne zdjęcie miejsca? Proszę napisać na info@keramickazahrada.cz — odpowiadam osobiście.",
    termsWith: (label) =>
      label ? `regulamin sklepu w brzmieniu obowiązującym od ${label}` : "regulamin sklepu",
    consentBefore: "Wysyłając zapytanie, zaakceptowali Państwo",
    dataUse: "Dane z zapytania wykorzystam wyłącznie do przygotowania oferty",
    privacy: "zasady ochrony danych osobowych",
    closing: "Dziękuję i serdecznie pozdrawiam",
  },
  de: {
    preview: "Ihre Anfrage ist angekommen – ich melde mich mit einem Angebot.",
    eyebrow: "Auftragsarbeit · Anfrage",
    title: "Vielen Dank für",
    accent: "Ihre Anfrage.",
    intro:
      "Ihre Anfrage ist bei mir angekommen. Ich sehe sie mir an und melde mich – in der Regel innerhalb von zwei Werktagen – mit einem Angebot oder zuerst mit Fragen, die ich für den Entwurf brauche.",
    dimensions: "Maße",
    motif: "Motiv / Text / Nummer",
    deadline: "Termin",
    photos: "Fotos vom Ort",
    phone: "Telefon",
    photoLabel: (count) => (count === 1 ? "1 Foto" : `${count} Fotos`),
    wish: "Ihre Vorstellung",
    next: "Wie es weitergeht",
    offerTitle: "Angebot",
    offer:
      "Ich schicke Ihnen ein Angebot mit Preis, Lieferzeit und Höhe der Anzahlung – bei Bedarf mit einer Skizze oder einer Beschreibung, wie ich es umsetze.",
    confirmTitle: "Bestätigung",
    confirm:
      "Der Vertrag kommt erst zustande, wenn Sie das Angebot bestätigen oder die Anzahlung leisten. Bis dahin verpflichtet Sie die Anfrage zu nichts.",
    productionTitle: "Herstellung",
    production: "Ich beginne mit der Arbeit, sobald die Anzahlung eingegangen ist – und schreibe Ihnen, dass ich angefangen habe.",
    noWithdrawal:
      "Eine nach Ihren Vorgaben angefertigte Auftragsarbeit kann nicht innerhalb der 14-tägigen Widerrufsfrist zurückgegeben werden (§ 1837 Buchst. d des tschechischen Bürgerlichen Gesetzbuchs und Art. 16 Buchst. c der Richtlinie 2011/83/EU). Deshalb besprechen wir alles Wichtige – Aussehen, Maße und Farben – im Voraus.",
    more:
      "Möchten Sie etwas ergänzen, zum Beispiel ein weiteres Foto vom Ort? Schreiben Sie mir an info@keramickazahrada.cz – ich antworte persönlich.",
    termsWith: (label) =>
      label ? `den Geschäftsbedingungen in der ab ${label} gültigen Fassung` : "den Geschäftsbedingungen",
    consentBefore: "Mit dem Absenden der Anfrage haben Sie sich einverstanden erklärt mit",
    dataUse: "Die Angaben aus der Anfrage verwende ich nur, um das Angebot zu erstellen",
    privacy: "Datenschutzhinweise",
    closing: "Vielen Dank und herzliche Grüße",
  },
  en: {
    preview: "Your enquiry has arrived — I'll get back to you with a quote.",
    eyebrow: "Commission · Enquiry",
    title: "Thank you for",
    accent: "your enquiry.",
    intro:
      "Your enquiry has reached me. I'll look through it and get back to you — usually within two working days — with a quote, or first with any questions I need answered for the design.",
    dimensions: "Dimensions",
    motif: "Motif / text / number",
    deadline: "Date needed",
    photos: "Photos of the spot",
    phone: "Phone",
    photoLabel: (count) => (count === 1 ? "1 photo" : `${count} photos`),
    wish: "What you have in mind",
    next: "What happens next",
    offerTitle: "Quote",
    offer:
      "I'll send you a quote with the price, the delivery time and the amount of the deposit — with a sketch or a description of how I'll make it, if needed.",
    confirmTitle: "Confirmation",
    confirm:
      "The contract is only concluded once you accept the quote or pay the deposit. Until then, your enquiry doesn't commit you to anything.",
    productionTitle: "Making",
    production: "I'll start work once the deposit has arrived — and I'll write to let you know I've begun.",
    noWithdrawal:
      "A commission made to your specifications cannot be returned within the 14-day period for withdrawal from the contract (Section 1837(d) of the Czech Civil Code and Article 16(c) of Directive 2011/83/EU). That's why we'll agree on everything important — the look, the dimensions and the colours — in advance.",
    more:
      "Would you like to add something, perhaps another photo of the spot? Just write to me at info@keramickazahrada.cz — I answer every e-mail myself.",
    termsWith: (label) =>
      label ? `the terms and conditions in the version effective from ${label}` : "the terms and conditions",
    consentBefore: "By sending your enquiry, you agreed to",
    dataUse: "I will use the details from your enquiry only to prepare your quote",
    privacy: "privacy policy",
    closing: "Thank you — I'm looking forward to it,",
  },
}

/** Krok „co bude dál" — tučný název a věta za ním, v jednom odstavci. */
const Step = ({ index, title, children }: { index: number; title: string; children: React.ReactNode }) => (
  <P style={{ margin: "0 0 12px" }}>
    <strong style={{ color: brand.ink, fontWeight: 700 }}>
      {index}. {title}.
    </strong>{" "}
    {children}
  </P>
)

function CommissionInquiryReceivedEmailComponent({
  customerName,
  description,
  dimensions,
  motif,
  deadline,
  phone,
  photoCount,
  termsVersionLabel,
  consentedAtLabel,
  termsUrl,
  privacyUrl,
}: CommissionInquiryReceivedEmailProps) {
  const t = useCopy(COPY)
  const photos = Math.max(0, Number(photoCount) || 0)
  const rows: Array<[string, string]> = [
    [t.dimensions, dimensions ?? ""],
    [t.motif, motif ?? ""],
    [t.deadline, deadline ?? ""],
    [t.photos, photos ? t.photoLabel(photos) : ""],
    [t.phone, phone ?? ""],
  ].filter((row): row is [string, string] => Boolean(row[1].trim()))

  const termsLabel = t.termsWith(termsVersionLabel ?? null)

  return (
    <EmailLayout preview={t.preview}>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting name={customerName} />
      <P>{t.intro}</P>

      {description?.trim() ? (
        <>
          <Eyebrow style={{ margin: "28px 0 10px" }}>{t.wish}</Eyebrow>
          <P style={{ color: brand.ink }}>
            <MultiLine value={description} />
          </P>
        </>
      ) : null}

      {rows.length ? (
        <>
          {rows.map(([label, value]) => (
            <LedgerRow key={label} label={label} value={value} />
          ))}
          <LedgerEnd />
        </>
      ) : null}

      <Eyebrow style={{ margin: "32px 0 12px" }}>{t.next}</Eyebrow>
      <Step index={1} title={t.offerTitle}>
        {t.offer}
      </Step>
      <Step index={2} title={t.confirmTitle}>
        {t.confirm}
      </Step>
      <Step index={3} title={t.productionTitle}>
        {t.production}
      </Step>

      <Note tone="clay">{t.noWithdrawal}</Note>

      <P>{t.more}</P>

      <Section style={{ margin: "8px 0 0" }}>
        <P small>
          {t.consentBefore}{" "}
          {termsUrl ? (
            <Link href={termsUrl} style={linkStyle}>
              {termsLabel}
            </Link>
          ) : (
            termsLabel
          )}
          {consentedAtLabel ? ` (${consentedAtLabel})` : ""}. {t.dataUse}
          {privacyUrl ? (
            <>
              {" — "}
              <Link href={privacyUrl} style={linkStyle}>
                {t.privacy}
              </Link>
            </>
          ) : null}
          .
        </P>
      </Section>

      <Signature closing={t.closing} />
    </EmailLayout>
  )
}

export const CommissionInquiryReceivedEmail = (props: CommissionInquiryReceivedEmailProps) => (
  <CommissionInquiryReceivedEmailComponent {...props} />
)

// Mock data for preview/development
const mockInquiry: CommissionInquiryReceivedEmailProps = {
  customerName: "Jana Nováková",
  // Text zákazníka jde, jak ho napsal — v náhledu bez českých háčků navíc.
  description: "Domovní číslo 229 s vlaštovkou, vedle vchodu.\nBarvou ladit k omítce.",
  dimensions: "asi 30 × 20 cm",
  motif: "„229“ a vlaštovka",
  deadline: "do Vánoc",
  phone: "+420 603 123 456",
  photoCount: 2,
  termsVersion: "2026-11-03",
  termsVersionLabel: "3. 11. 2026",
  consentedAt: "2026-10-14T13:32:10.000Z",
  consentedAtLabel: "14. 10. 2026 15:32",
  termsUrl: "https://keramickazahrada.cz/cz/smluvni-podminky#vyroba-na-zakazku",
  privacyUrl: "https://keramickazahrada.cz/cz/ochrana-osobnich-udaju",
}

export default () => <CommissionInquiryReceivedEmailComponent {...mockInquiry} />
