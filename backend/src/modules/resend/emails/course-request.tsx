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
import { storefrontBase } from "../../../lib/storefront-url"

/**
 * Žádost o místo na plně obsazeném termínu kurzu (`course_waitlist`).
 *
 * Tři chvíle, jedna šablona:
 * - `received` — žádost přišla; nic se neplatí, majitelka se ozve,
 * - `approved` — výjimka schválená; v rezervaci si zákazník vybere platbu
 *   (kartou / na místě) a potvrdí obchodní podmínky — do 24 hodin,
 * - `denied` — omluva, případně se vzkazem majitelky.
 */

interface CourseRequestEmailProps {
  variant?: "received" | "approved" | "denied"
  customerName?: string
  courseTitle?: string
  /** Už naformátované (Europe/Prague). */
  courseDate?: string
  courseLocation?: string
  partySize?: number
  /** Cena celkem (jen u schválené). */
  totalAmount?: string
  /** Odkaz do rezervace, kde si vybere platbu (jen u schválené). */
  reservationLink?: string
  /** Vzkaz majitelky k rozhodnutí. */
  decisionNote?: string
}

const persons = (count: number) => (count === 1 ? "1 osoba" : count < 5 ? `${count} osoby` : `${count} osob`)

function CourseRequestEmailComponent({
  variant = "received",
  customerName = "Vážený zákazníku",
  courseTitle = "Kurz točení pro dospělé",
  courseDate = "sobota 12. 9. 2026 10:00",
  courseLocation = "Ateliér u Písku",
  partySize = 1,
  totalAmount = "",
  reservationLink = "",
  decisionNote = "",
}: CourseRequestEmailProps) {
  const base = storefrontBase()
  const coursesUrl = base ? `${base}/kurzy#rezervace` : ""
  const approved = variant === "approved"
  const denied = variant === "denied"

  return (
    <EmailLayout
      preview={
        approved
          ? `Místo na kurzu ${courseTitle} pro vás mám — stačí vybrat platbu.`
          : denied
            ? `Na kurzu ${courseTitle} vám bohužel místo nabídnout nemohu.`
            : `Žádost o místo na kurzu ${courseTitle} mám — ozvu se vám.`
      }
    >
      <Eyebrow>{approved ? "Kurz · žádost schválena" : denied ? "Kurz · žádost" : "Kurz · žádost o místo"}</Eyebrow>
      <EmailH1 accent={approved ? "místo pro vás mám." : denied ? "tentokrát to nepůjde." : "ozvu se vám."}>
        {approved ? "Dobrá zpráva," : denied ? "Je mi líto," : "Žádost mám,"}
      </EmailH1>

      <Greeting name={customerName} />
      <P>
        {approved
          ? "termín byl plně obsazený, ale udělám pro vás výjimku. Rezervaci jsem vám připravila — stačí v ní vybrat, jak zaplatíte, a potvrdit podmínky."
          : denied
            ? "děkuji za zájem o kurz. Na tenhle termín vám bohužel místo navíc nabídnout nemohu — kapacita dílny je opravdu plná."
            : "děkuji za žádost o místo na kurzu. Termín je plně obsazený, takže se podívám, jestli pro vás můžu udělat výjimku, a ozvu se — e-mailem, nebo vám zavolám. Zatím nic neplatíte."}
      </P>

      <LedgerRow label="Kurz" value={courseTitle} />
      <LedgerRow label="Kdy" value={courseDate} />
      <LedgerRow label="Kde" value={courseLocation} />
      <LedgerRow label="Počet osob" value={persons(partySize)} />
      {approved && totalAmount ? <LedgerRow label="Cena" value={totalAmount} strong tone="olive" /> : null}
      <LedgerEnd />

      {decisionNote ? <Note>{decisionNote}</Note> : null}

      {approved ? (
        <>
          <P>
            Zaplatit můžete hned kartou, nebo až na místě před začátkem kurzu.
            Místo vám držím 24 hodin — když se do té doby rezervace nepotvrdí,
            nabídnu ho dalším zájemcům.
          </P>
          {reservationLink ? (
            <ButtonRow>
              <EmailButton href={reservationLink}>Potvrdit rezervaci</EmailButton>
            </ButtonRow>
          ) : null}
        </>
      ) : denied ? (
        <>
          <P>Rezervovat si můžete jiný termín — nové termíny pravidelně vypisuji.</P>
          {coursesUrl ? (
            <ButtonRow>
              <EmailButton href={coursesUrl}>Vybrat jiný termín</EmailButton>
            </ButtonRow>
          ) : null}
        </>
      ) : (
        <Note>Kdyby se mezitím místo uvolnilo, napíšu vám i tak.</Note>
      )}

      <Signature />
    </EmailLayout>
  )
}

export const CourseRequestEmail = (props: CourseRequestEmailProps) => <CourseRequestEmailComponent {...props} />

const mock: CourseRequestEmailProps = {
  variant: "approved",
  customerName: "Jana Nováková",
  courseTitle: "Kurz točení pro dospělé",
  courseDate: "sobota 12. 9. 2026 10:00",
  courseLocation: "Ateliér u Písku",
  partySize: 3,
  totalAmount: "3 000 Kč",
  reservationLink: "https://keramickazahrada.cz/cz/kurzy/rezervace/res_123?token=abc",
}

export default () => <CourseRequestEmailComponent {...mock} />
