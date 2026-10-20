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
  variant?: "paid" | "on_site" | "awaiting_payment"
  /** Signed link to the reservation page. */
  reservationLink?: string
  /** Our copy of the iDoklad invoice PDF — empty when not (yet) issued. */
  invoicePdfUrl?: string
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
  invoicePdfUrl = "",
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
  // Zástupný text `[[DOPLNIT …]]` zákazník nikdy neuvidí.
  const termsReady = hasCourseCancellationTerms(cancellationTerms)
  const attached = termsAttached && !attachments_failed
  const versionSuffix = termsVersionLabel ? ` (znění od ${termsVersionLabel})` : ""
  return (
    <EmailLayout
      preview={`Rezervace kurzu ${courseTitle} — ${courseDate}.`}
    >
      <Eyebrow>Kurzy</Eyebrow>
      <EmailH1
        accent={
          paid
            ? "a je zaplacená."
            : awaiting
              ? "pro vás držíme."
              : "máte rezervované."
        }
      >
        Místo u hlíny
      </EmailH1>

      <Greeting name={customerName} />
      <P>
        {paid
          ? "děkujeme — platba dorazila a vaše místo na kurzu je závazně rezervované. Tady je vše důležité na jednom místě:"
          : awaiting
            ? "děkujeme za rezervaci. Místo pro vás držíme; jakmile dorazí platba, pošleme vám potvrzení s dokladem. Tady je vše důležité na jednom místě:"
            : "vaše místo na kurzu je rezervované. Tady je vše důležité na jednom místě:"}
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
      <LedgerRow
        label={paid ? "Zaplaceno" : awaiting ? "K zaplacení" : "Cena (na místě)"}
        value={totalAmount}
        strong
        tone="olive"
      />
      <LedgerEnd />

      {paid ? (
        <>
          <P>
            Teď už se nemusíte o nic starat — stačí přijít. Vezměte si pohodlné
            oblečení, kterému nevadí hlína; všechno ostatní bude v ateliéru
            připravené.
          </P>
          {/* Storno patří i do zaplacené varianty — kdo zaplatil, potřebuje
              vědět, že se dá ozvat, nejen kdo platí na místě. */}
          <Note>
            Kdyby vám termín nakonec nevyšel, dejte nám prosím co nejdříve
            vědět — stačí odpovědět na tento e-mail a společně to vyřešíme.
          </Note>
        </>
      ) : awaiting ? (
        <>
          <P>
            Pokud jste platbu kartou už dokončili, je všechno v pořádku —
            potvrzení s dokladem vám přijde hned, jak ji banka potvrdí.
            Obvykle to jsou minuty.
          </P>
          <Note>
            Kdyby platba neprošla nebo jste ji nestihli dokončit, můžete to
            zkusit znovu na stránce rezervace níž. Místo pro vás držíme
            24 hodin; potom ho nabídneme dalším zájemcům.
          </Note>
        </>
      ) : (
        <>
          <P>
            Kurz zaplatíte hotově nebo kartou přímo na místě. Vezměte si
            pohodlné oblečení, kterému nevadí hlína; všechno ostatní bude
            v ateliéru připravené.
          </P>
          <Note>
            Kdyby vám termín nakonec nevyšel, dejte nám prosím vědět — místo
            uvolníme někomu dalšímu. Stačí odpovědět na tento e-mail.
          </Note>
        </>
      )}

      {/* Potvrzení smlouvy v textové podobě (§ 1827 odst. 2 OZ): poučení,
          že od kurzu v pevném termínu nelze odstoupit do 14 dnů (§ 1837
          písm. j) OZ), a storno podmínky, které platí místo toho. Dokud
          nejsou doplněné, odkaz na jejich místo v OP — ne zástupný text. */}
      <P>
        <strong>Storno podmínky.</strong> {noWithdrawalNotice}
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

      {reservationLink || invoicePdfUrl ? (
        <ButtonRow>
          {reservationLink ? (
            <EmailButton href={reservationLink}>Detail rezervace</EmailButton>
          ) : null}
          {invoicePdfUrl ? (
            <>
              {" "}
              <EmailButton href={invoicePdfUrl} variant="ghost">
                Stáhnout fakturu (PDF)
              </EmailButton>
            </>
          ) : null}
        </ButtonRow>
      ) : null}

      <Signature />
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
  termsLink: "https://keramickazahrada.cz/cz/smluvni-podminky#kurzy",
}

export default () => (
  <CourseReservationConfirmedEmailComponent
    {...mockCourseReservationConfirmed}
  />
)
