import {
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
}

export default () => (
  <CourseReservationConfirmedEmailComponent
    {...mockCourseReservationConfirmed}
  />
)
