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
  COURSE_CANCELLATION_TERMS,
  COURSE_NO_WITHDRAWAL_NOTICE,
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
  /** "paid" once the card payment arrived, "on_site" for pay-at-the-door. */
  variant?: "paid" | "on_site"
  /** Signed link to the reservation page. */
  reservationLink?: string
  /** Our copy of the iDoklad invoice PDF — empty when not (yet) issued. */
  invoicePdfUrl?: string
  /** Poučení o výjimce z odstoupení (§ 1837 písm. j) OZ) — `modules/course/legal.ts`. */
  noWithdrawalNotice?: string
  /** Storno podmínky kurzů — `modules/course/legal.ts` (zatím zástupný text). */
  cancellationTerms?: string
  /** Obchodní podmínky, kapitola Kurzy (`…/smluvni-podminky#kurzy`). */
  termsLink?: string
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
  // Výchozí = konstanty: i notifikace uložená před touhle změnou (bez těch
  // klíčů v `data`) se při opakovaném odeslání vykreslí s poučením.
  noWithdrawalNotice = COURSE_NO_WITHDRAWAL_NOTICE,
  cancellationTerms = COURSE_CANCELLATION_TERMS,
  termsLink = "",
}: CourseReservationConfirmedEmailProps) {
  const paid = variant === "paid"
  return (
    <EmailLayout
      preview={`Rezervace kurzu ${courseTitle} — ${courseDate}.`}
    >
      <Eyebrow>Kurzy</Eyebrow>
      <EmailH1 accent={paid ? "a je zaplacená." : "máte rezervované."}>
        Místo u hlíny
      </EmailH1>

      <Greeting name={customerName} />
      <P>
        {paid
          ? "děkujeme — platba dorazila a vaše místo na kurzu je závazně rezervované. Tady je vše důležité na jednom místě:"
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
        label={paid ? "Zaplaceno" : "Cena (na místě)"}
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
          písm. j) OZ), a storno podmínky, které platí místo toho. */}
      <P>
        <strong>Storno podmínky.</strong> {noWithdrawalNotice}
      </P>
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
