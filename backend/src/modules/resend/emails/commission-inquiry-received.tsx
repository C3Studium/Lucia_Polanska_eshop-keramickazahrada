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

const photoLabel = (count: number) => {
  if (count === 1) return "1 fotka"
  if (count >= 2 && count <= 4) return `${count} fotky`
  return `${count} fotek`
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
  const photos = Math.max(0, Number(photoCount) || 0)
  const rows: Array<[string, string]> = [
    ["Rozměry", dimensions ?? ""],
    ["Motiv / text / číslo", motif ?? ""],
    ["Termín", deadline ?? ""],
    ["Fotografie místa", photos ? photoLabel(photos) : ""],
    ["Telefon", phone ?? ""],
  ].filter((row): row is [string, string] => Boolean(row[1].trim()))

  const termsLabel = termsVersionLabel
    ? `obchodními podmínkami ve znění účinném od ${termsVersionLabel}`
    : "obchodními podmínkami"

  return (
    <EmailLayout preview="Poptávka dorazila — ozvu se vám s nabídkou.">
      <Eyebrow>Zakázka · Poptávka</Eyebrow>
      <EmailH1 accent="poptávku.">Děkuji za</EmailH1>

      <Greeting name={customerName} />
      <P>
        vaše poptávka ke mně dorazila. Projdu si ji a ozvu se vám — zpravidla do
        dvou pracovních dnů — s nabídkou, nebo napřed s otázkami, které budu
        k návrhu potřebovat.
      </P>

      {description?.trim() ? (
        <>
          <Eyebrow style={{ margin: "28px 0 10px" }}>Co si představujete</Eyebrow>
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

      <Eyebrow style={{ margin: "32px 0 12px" }}>Co bude dál</Eyebrow>
      <Step index={1} title="Nabídka">
        Pošlu vám nabídku s cenou, dodací lhůtou a výší zálohy — podle potřeby
        s náčrtem nebo popisem, jak to udělám.
      </Step>
      <Step index={2} title="Potvrzení">
        Smlouva vzniká, až nabídku potvrdíte nebo zaplatíte zálohu. Do té doby
        vás poptávka k ničemu nezavazuje.
      </Step>
      <Step index={3} title="Výroba">
        Do práce se pustím po připsání zálohy — a napíšu vám, že jsem začala.
      </Step>

      <Note tone="clay">
        Zakázku vyrobenou podle vašeho zadání nelze vrátit ve 14denní lhůtě pro
        odstoupení od smlouvy (§ 1837 písm. d) občanského zákoníku). Proto si
        všechno důležité — podobu, rozměry i barvy — domluvíme předem.
      </Note>

      <P>
        Chcete něco doplnit, třeba další fotku místa? Napište mi na info@keramickazahrada.cz, odpovídám sama.
      </P>

      <Section style={{ margin: "8px 0 0" }}>
        <P small>
          Odesláním poptávky jste vyjádřili souhlas s{" "}
          {termsUrl ? (
            <Link href={termsUrl} style={linkStyle}>
              {termsLabel}
            </Link>
          ) : (
            termsLabel
          )}
          {consentedAtLabel ? ` (${consentedAtLabel})` : ""}. Údaje z poptávky
          použiju jen k vypracování nabídky
          {privacyUrl ? (
            <>
              {" — "}
              <Link href={privacyUrl} style={linkStyle}>
                zásady ochrany osobních údajů
              </Link>
            </>
          ) : null}
          .
        </P>
      </Section>

      <Signature closing="Děkuji a těším se," />
    </EmailLayout>
  )
}

export const CommissionInquiryReceivedEmail = (props: CommissionInquiryReceivedEmailProps) => (
  <CommissionInquiryReceivedEmailComponent {...props} />
)

// Mock data for preview/development
const mockInquiry: CommissionInquiryReceivedEmailProps = {
  customerName: "Jana Nováková",
  description:
    "Domovní číslo 229 s vlaštovkou, do omítky vedle vchodu.\nBarevně k terakotové střeše.",
  dimensions: "asi 30 × 20 cm",
  motif: "„229“ a vlaštovka",
  deadline: "do Vánoc",
  phone: "+420 603 123 456",
  photoCount: 2,
  termsVersion: "2026-10-15",
  termsVersionLabel: "15. 10. 2026",
  consentedAt: "2026-10-14T13:32:10.000Z",
  consentedAtLabel: "14. 10. 2026 15:32",
  termsUrl: "https://keramickazahrada.cz/cz/smluvni-podminky#vyroba-na-zakazku",
  privacyUrl: "https://keramickazahrada.cz/cz/ochrana-osobnich-udaju",
}

export default () => <CommissionInquiryReceivedEmailComponent {...mockInquiry} />
