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
  Note,
  P,
  Signature,
} from "../components/email-ui"
import {
  COURSE_NO_WITHDRAWAL_NOTICE,
  COURSE_TERMS_ARTICLE,
  hasCourseCancellationTerms,
} from "../../course/legal"

const linkStyle = { color: brand.ink, textDecoration: "underline" } as const

interface CourseReservationConfirmedEmailProps {
  customerName?: string
  courseTitle?: string
  /** Already formatted in Europe/Prague — templates do no timezone math. */
  courseDate?: string
  courseLocation?: string
  /** "3 hodiny" or "" when the term has no duration. */
  courseDuration?: string
  partySize?: number
  totalAmount?: string
  /**
   * "paid" once the card payment arrived, "on_site" for pay-at-the-door,
   * "awaiting_payment" the moment an online reservation is created — before
   * anybody knows how the card payment went.
   */
  variant?: "paid" | "on_site" | "awaiting_payment" | "payment_failed"
  /** Odkaz „Zaplatit" rovnou na bránu (čeká na platbu / platba neprošla / doplatek). */
  paymentLink?: string
  /** Úprava počtu osob: `supplement` = doplatit, `refund` = vráceno, `refund_manual` = vrátíme ručně. */
  changeKind?: "" | "supplement" | "refund" | "refund_manual"
  /** Částka doplatku / vrácení, naformátovaná. */
  changeAmount?: string
  /** Zaplaceno celkem a zbývá — u úpravy. */
  paidAmount?: string
  amountDue?: string
  /** Signed link to the reservation page. */
  reservationLink?: string
  /** Our copy of the iDoklad invoice PDF — empty when not (yet) issued. */
  invoicePdfUrl?: string
  /** Faktura jde s e-mailem jako příloha. */
  invoiceAttached?: boolean
  /** Pozvánka na kurz (PDF) — prázdné u „čeká na platbu". */
  invitationUrl?: string
  /** Pozvánka jde s e-mailem jako příloha. */
  invitationAttached?: boolean
  /** Poučení o výjimce z odstoupení (§ 1837 písm. j) OZ) — `modules/course/legal.ts`. */
  noWithdrawalNotice?: string
  /**
   * Storno podmínky kurzů — právní údaj `course.cancellation` z administrace
   * (`courseCancellationTerms`). Prázdné nebo se `[[DOPLNIT` = ještě
   * nedoplněné: šablona je necituje a odkáže na OP čl. X.
   */
  cancellationTerms?: string
  /** Obchodní podmínky, kapitola Kurzy (`…/smluvni-podminky#kurzy`). */
  termsLink?: string
  /** Znění OP, se kterým zákazník rezervoval („15. 10. 2026"). */
  termsVersionLabel?: string
  /** Stránka toho znění na webu (`…/smluvni-podminky/<verze>`) — když PDF není. */
  termsVersionUrl?: string
  /** Zveřejněné PDF toho znění — prázdné, když není (pracovní / nenahrané). */
  termsPdfUrl?: string
  /** PDF obchodních podmínek jde s e-mailem jako příloha. */
  termsAttached?: boolean
  /** Resend přílohu odmítl a e-mail odešel bez ní (doplní provider). */
  attachments_failed?: boolean
}

/** Věta o přílohách — jen o tom, co opravdu přišlo. */
function AttachmentsNote({
  invitationAttached,
  invoiceAttached,
}: {
  invitationAttached: boolean
  invoiceAttached: boolean
}) {
  if (!invitationAttached && !invoiceAttached) return null
  const what =
    invitationAttached && invoiceAttached
      ? "pozvánku na kurz a fakturu"
      : invitationAttached
        ? "pozvánku na kurz"
        : "fakturu"
  return (
    <Note>
      V příloze najdete {what} (PDF).
      {invitationAttached ? " Pozvánku si můžete vytisknout, nebo ji jen mít v telefonu." : ""}
    </Note>
  )
}

function CourseReservationConfirmedEmailComponent({
  customerName = "Vážený zákazníku",
  courseTitle = "Kurz točení pro dospělé",
  courseDate = "sobota 12. 9. 2026 10:00",
  courseLocation = "Ateliér u Písku",
  courseDuration = "",
  partySize = 1,
  totalAmount = "1 200 Kč",
  variant = "on_site",
  reservationLink = "",
  paymentLink = "",
  changeKind = "",
  changeAmount = "",
  paidAmount = "",
  amountDue = "",
  invoicePdfUrl = "",
  invoiceAttached = false,
  invitationUrl = "",
  invitationAttached = false,
  // Výchozí poučení = konstanta: i notifikace uložená před zavedením poučení
  // (bez toho klíče v `data`) se při opakovaném odeslání vykreslí s ním.
  // Storno bez údaje = odkaz na OP čl. X, jako u nevyplněných podmínek.
  noWithdrawalNotice = COURSE_NO_WITHDRAWAL_NOTICE,
  cancellationTerms = "",
  termsLink = "",
  termsVersionLabel = "",
  termsVersionUrl = "",
  termsPdfUrl = "",
  termsAttached = false,
  attachments_failed = false,
}: CourseReservationConfirmedEmailProps) {
  const paid = variant === "paid"
  /* Rezervace založená, platba ještě nedoputovala. Není to chyba — zákazník
     se z brány vrátí dřív, než dorazí ověřené oznámení. */
  const awaiting = variant === "awaiting_payment"
  /* Platba na bráně zrušená, zamítnutá nebo vypršelá — místo pořád držím. */
  const failed = variant === "payment_failed"
  const supplement = changeKind === "supplement"
  const refund = changeKind === "refund" || changeKind === "refund_manual"
  const changed = supplement || refund
  const unpaid = awaiting || failed || supplement
  // Zástupný text `[[DOPLNIT …]]` zákazník nikdy neuvidí.
  const termsReady = hasCourseCancellationTerms(cancellationTerms)
  const attached = termsAttached && !attachments_failed
  const versionSuffix = termsVersionLabel ? ` (znění od ${termsVersionLabel})` : ""
  return (
    <EmailLayout
      preview={
        paid
          ? `Platba za kurz ${courseTitle} (${courseDate}) dorazila, rezervace je potvrzená.`
          : failed
            ? `Platba za kurz ${courseTitle} (${courseDate}) neprošla. Místo vám držím, zkuste to prosím znovu.`
            : awaiting
            ? `Rezervaci kurzu ${courseTitle} (${courseDate}) mám, platba zatím nedorazila.`
            : `Rezervace kurzu ${courseTitle} (${courseDate}) je potvrzená, platíte na místě.`
      }
    >
      <Eyebrow>
        {changed ? "Kurz · úprava rezervace" : paid ? "Kurz · platba přijata" : failed ? "Kurz · platba neprošla" : "Kurz · rezervace"}
      </Eyebrow>
      <EmailH1
        accent={
          supplement
            ? "čeká na doplatek."
            : refund
              ? "rozdíl vám vracím."
              : paid
            ? "je zaplacená a potvrzená."
            : failed
              ? "místo vám pořád držím."
              : awaiting
                ? "čeká na platbu."
                : "je potvrzená."
        }
      >
        {supplement ? "Změna rezervace" : changed ? "Rezervace je upravená," : failed ? "Platba neprošla," : "Vaše rezervace"}
      </EmailH1>

      <Greeting name={customerName} />
      <P>
        {supplement
          ? `změnu počtu osob mám. Platit začne, jakmile doplatíte rozdíl ${changeAmount} — tlačítkem níž. Do té doby platí rezervace, jak byla. Přehled po změně:`
          : changeKind === "refund"
            ? `změnu počtu osob mám. Rozdíl ${changeAmount} vám vracím stejnou cestou, jakou jste platili — obvykle dorazí do několika dní. Tady je přehled:`
            : changeKind === "refund_manual"
              ? `změnu počtu osob mám. Rozdíl ${changeAmount} vám vrátím — automaticky to tentokrát nešlo, ozvu se vám. Tady je přehled:`
        : paid
          ? "platba dorazila, děkuji. Rezervace kurzu je tím potvrzená a místo je vaše. Tady je přehled:"
          : failed
            ? "platba za rezervaci kurzu neprošla nebo byla zrušená — nic jsme vám nestrhli. Místo vám ale pořád držím, stačí zaplatit znovu. Tady je přehled:"
            : awaiting
            ? "děkuji za rezervaci kurzu. Platba kartou k nám zatím nedorazila; místo vám mezitím držím. Tady je přehled:"
            : "děkuji za rezervaci kurzu, je potvrzená. Zaplatíte na místě, hotově nebo kartou. Tady je přehled:"}
      </P>

      <LedgerRow label="Kurz" value={courseTitle} />
      <LedgerRow label="Kdy" value={courseDate} />
      <LedgerRow label="Kde" value={courseLocation} />
      {courseDuration ? (
        <LedgerRow label="Délka" value={courseDuration} />
      ) : null}
      <LedgerRow
        label="Počet osob"
        value={`${partySize} ${partySize === 1 ? "osoba" : partySize < 5 ? "osoby" : "osob"}`}
      />
      {changed ? (
        <>
          <LedgerRow label="Cena celkem" value={totalAmount} />
          <LedgerRow label="Zaplaceno" value={paidAmount} />
          {supplement ? <LedgerRow label="K doplacení" value={amountDue} strong tone="olive" /> : null}
          {refund ? <LedgerRow label="Vracím" value={changeAmount} strong tone="olive" /> : null}
        </>
      ) : (
        <LedgerRow
          label={paid ? "Zaplaceno" : unpaid ? "K zaplacení" : "Cena (na místě)"}
          value={totalAmount}
          strong
          tone="olive"
        />
      )}
      <LedgerEnd />

      {paid ? (
        <>
          <P>
            Teď už stačí jen přijít. Vezměte si pohodlné oblečení, kterému
            nevadí hlína; hlínu, nářadí i zástěry máme v dílně připravené.
          </P>
          <AttachmentsNote
            invitationAttached={invitationAttached}
            invoiceAttached={invoiceAttached}
          />
        </>
      ) : failed ? (
        <>
          <P>
            Tlačítkem Zaplatit níž otevřete novou platbu. Jakmile projde, pošlu
            vám potvrzení s pozvánkou a fakturou.
          </P>
          <Note>
            Místo vám držím 24 hodin od rezervace, potom ho nabídnu dalším
            zájemcům. Kdyby platba kartou nešla, napište mi a domluvíme se.
          </Note>
        </>
      ) : awaiting ? (
        <>
          <P>
            Pokud jste platbu kartou dokončili, nemusíte nic dělat. Jakmile ji
            banka potvrdí, pošlu vám potvrzení s pozvánkou a fakturou.
          </P>
          <Note>
            Kdyby platba neprošla nebo jste ji nestihli dokončit, zaplatíte
            tlačítkem níž. Místo vám držím 24 hodin, potom ho nabídnu dalším
            zájemcům.
          </Note>
        </>
      ) : (
        <>
          <P>
            Kurz zaplatíte na místě, hotově nebo kartou. Vezměte si pohodlné
            oblečení, kterému nevadí hlína; hlínu, nářadí i zástěry máme
            v dílně připravené.
          </P>
          <AttachmentsNote invitationAttached={invitationAttached} invoiceAttached={false} />
        </>
      )}

      {/* Potvrzení smlouvy v textové podobě (§ 1827 odst. 2 OZ): poučení,
          že od kurzu v pevném termínu nelze odstoupit do 14 dnů (§ 1837
          písm. j) OZ), a storno podmínky, které platí místo toho. Dokud
          nejsou doplněné, odkaz na jejich místo v OP — ne zástupný text. */}
      <P>
        <strong>Kdyby vám termín nevyšel.</strong> {noWithdrawalNotice}
      </P>
      {termsReady ? (
        <>
          <P>{cancellationTerms}</P>
          {termsLink ? (
            <P small>
              Celé znění najdete v{" "}
              <Link href={termsLink} style={linkStyle}>
                obchodních podmínkách (kapitola Kurzy)
              </Link>
              .
            </P>
          ) : null}
        </>
      ) : (
        <P>
          Storno podmínky kurzů jsou v obchodních podmínkách, {COURSE_TERMS_ARTICLE}
          {termsLink ? (
            <>
              {" — "}
              <Link href={termsLink} style={linkStyle}>
                zobrazit na webu
              </Link>
            </>
          ) : null}
          .
        </P>
      )}
      {/* Obchodní podmínky té verze, se kterou zákazník rezervoval — PDF
          v příloze, nebo aspoň odkaz, když příloha neprošla. Bez PDF (pracovní
          znění, nebo verze vydaná ve Studiu, kterou backend ještě nezná)
          aspoň datum znění a jeho stránka — nikdy jiné znění místo něj. */}
      {attached ? (
        <P small>
          Obchodní podmínky{versionSuffix}, podle kterých rezervace platí,
          máte v příloze tohoto e-mailu (PDF).
        </P>
      ) : termsPdfUrl ? (
        <P small>
          Obchodní podmínky{versionSuffix}, podle kterých rezervace platí, si
          můžete{" "}
          <Link href={termsPdfUrl} style={linkStyle}>
            stáhnout jako PDF
          </Link>
          .
        </P>
      ) : termsVersionLabel ? (
        <P small>
          Rezervace platí podle obchodních podmínek ve znění od {termsVersionLabel}
          {termsVersionUrl ? (
            <>
              {" — "}
              <Link href={termsVersionUrl} style={linkStyle}>
                zobrazit na webu
              </Link>
            </>
          ) : null}
          .
        </P>
      ) : null}

      {reservationLink || invoicePdfUrl || invitationUrl || paymentLink ? (
        <ButtonRow>
          {unpaid && paymentLink ? (
            <>
              <EmailButton href={paymentLink}>
                {supplement ? `Doplatit ${amountDue}` : failed ? "Zaplatit znovu" : "Zaplatit"}
              </EmailButton>{" "}
            </>
          ) : null}
          {reservationLink ? (
            <EmailButton href={reservationLink} variant={unpaid && paymentLink ? "ghost" : undefined}>
              {unpaid && !paymentLink ? "Zobrazit rezervaci a zaplatit" : "Zobrazit rezervaci"}
            </EmailButton>
          ) : null}
          {invitationUrl && !invitationAttached ? (
            <>
              {" "}
              <EmailButton href={invitationUrl} variant="ghost">
                Pozvánka (PDF)
              </EmailButton>
            </>
          ) : null}
          {invoicePdfUrl && !invoiceAttached ? (
            <>
              {" "}
              <EmailButton href={invoicePdfUrl} variant="ghost">
                Stáhnout fakturu (PDF)
              </EmailButton>
            </>
          ) : null}
        </ButtonRow>
      ) : null}

      <Signature closing="Děkuji a těším se," />
    </EmailLayout>
  )
}

export const CourseReservationConfirmedEmail = (
  props: CourseReservationConfirmedEmailProps
) => <CourseReservationConfirmedEmailComponent {...props} />

// Mock data for preview/development
const mockCourseReservationConfirmed: CourseReservationConfirmedEmailProps = {
  customerName: "Jana Nováková",
  courseTitle: "Kurz točení pro dospělé",
  courseDate: "sobota 12. 9. 2026 10:00",
  courseLocation: "Ateliér u Písku",
  courseDuration: "3 hodiny",
  partySize: 2,
  totalAmount: "2 200 Kč",
  variant: "paid",
  reservationLink: "https://keramickazahrada.cz/cz/kurzy/rezervace/res_123?token=abc",
  invoicePdfUrl: "https://keramickazahrada.cz/faktura-20260042.pdf",
  invoiceAttached: true,
  invitationUrl: "https://img.matejforejt.com/courses/res_123/pozvanka.pdf",
  invitationAttached: true,
  termsLink: "https://keramickazahrada.cz/cz/smluvni-podminky#kurzy",
}

export default () => (
  <CourseReservationConfirmedEmailComponent
    {...mockCourseReservationConfirmed}
  />
)
