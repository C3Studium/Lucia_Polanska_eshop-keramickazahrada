import { renderToStaticMarkup } from "react-dom/server"
import { CoursePaymentExpiredEmail } from "../emails/course-payment-expired"
import { CourseReminderEmail } from "../emails/course-reminder"
import { CourseWaitlistSpotEmail } from "../emails/course-waitlist-spot"
import { CourseTermCancelledEmail } from "../emails/course-term-cancelled"
import { CourseReservationCancelledEmail } from "../emails/course-reservation-cancelled"

/**
 * The course completion e-mails on real rendered HTML — same renderer
 * trade-off as customer-emails.unit.spec.tsx (react-dom's
 * renderToStaticMarkup, because @react-email/render dynamic-imports
 * react-dom/server, which jest's CJS sandbox refuses).
 *
 * What is pinned is the load-bearing copy: the expiry mail's honest reason
 * and its way back, the reminder's amount-to-bring for pay-on-site bookings,
 * the waitlist mail's „not held" promise, and the term-cancelled mail
 * telling refunded customers their money is already moving — and only them.
 */

describe("course lifecycle e-mails", () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    process.env.STOREFRONT_PUBLIC_URL = "https://keramickazahrada.cz"
    delete process.env.MEDUSA_STOREFRONT_URL
    delete process.env.STOREFRONT_COUNTRY
  })

  afterAll(() => {
    process.env = env
  })

  describe("course-payment-expired", () => {
    it("says the payment never arrived, the seats were freed, and links the kurzy page", () => {
      const html = renderToStaticMarkup(
        CoursePaymentExpiredEmail({
          customerName: "Jana Nováková",
          courseTitle: "Kurz točení pro dospělé",
          courseDate: "sobota 12. 9. 2026 10:00",
          courseLocation: "Ateliér u Písku",
          partySize: 2,
          totalAmount: "2 600 Kč",
        }) as React.ReactElement
      )

      expect(html).toContain("Platba nedorazila")
      expect(html).toContain("do 24 hodin")
      expect(html).toContain("uvolnili")
      expect(html).toContain("Kurz točení pro dospělé")
      expect(html).toContain("2 osoby")
      expect(html).toContain("https://keramickazahrada.cz/cz/kurzy#rezervace")
      expect(html).toContain("Rezervovat znovu")
      // The money line is labelled as unpaid — this is not a receipt.
      expect(html).toContain("nezaplaceno")
    })
  })

  describe("course-reminder", () => {
    const base = {
      customerName: "Jana Nováková",
      courseTitle: "Kurz točení pro dospělé",
      courseDate: "sobota 12. 9. 2026 10:00",
      courseLocation: "Ateliér u Písku",
      courseDuration: "3 hodiny",
      partySize: 2,
      reservationLink:
        "https://keramickazahrada.cz/cz/kurzy/rezervace/res_123?token=abc",
    }

    it("tells pay-on-site bookings how much to bring", () => {
      const html = renderToStaticMarkup(
        CourseReminderEmail({
          ...base,
          payOnSiteAmount: "2 600 Kč",
        }) as React.ReactElement
      )
      expect(html).toContain("Na místě zaplatíte")
      expect(html).toContain("2 600 Kč")
      expect(html).toContain("sobota 12. 9. 2026 10:00")
      expect(html).toContain("Ateliér u Písku")
      expect(html).toContain(
        "https://keramickazahrada.cz/cz/kurzy/rezervace/res_123?token=abc"
      )
    })

    it("keeps money out of the reminder for already-paid bookings", () => {
      const html = renderToStaticMarkup(
        CourseReminderEmail({ ...base, payOnSiteAmount: "" }) as React.ReactElement
      )
      expect(html).not.toContain("Na místě zaplatíte")
    })

    it("carries the term note — the owner's co-s-sebou line", () => {
      const html = renderToStaticMarkup(
        CourseReminderEmail({
          ...base,
          courseNote: "Vezměte si prosím ručník a přezůvky.",
        }) as React.ReactElement
      )
      expect(html).toContain("Vezměte si prosím ručník a přezůvky.")
    })
  })

  describe("course-waitlist-spot", () => {
    it("says seats are free NOW but not held, and buttons to the reservation section", () => {
      const html = renderToStaticMarkup(
        CourseWaitlistSpotEmail({
          customerName: "Jana Nováková",
          courseTitle: "Kurz točení pro dospělé",
          courseDate: "sobota 12. 9. 2026 10:00",
          courseLocation: "Ateliér u Písku",
          partySize: 2,
        }) as React.ReactElement
      )
      expect(html).toContain("Uvolnilo se místo")
      expect(html).toContain("kdo dřív dokončí rezervaci")
      expect(html).toContain("https://keramickazahrada.cz/cz/kurzy#rezervace")
      expect(html).toContain("Rezervovat místo")
      // One-notification promise, spelled out.
      expect(html).toContain("jediná zpráva")
    })
  })

  describe("course-term-cancelled — refund variants", () => {
    const base = {
      customerName: "Jana Nováková",
      courseTitle: "Kurz točení pro dospělé",
      courseDate: "sobota 12. 9. 2026 10:00",
      courseLocation: "Ateliér u Písku",
      partySize: 2,
      totalAmount: "2 200 Kč",
      paidOnline: true,
    }

    it("tells a refunded customer the money is already on its way — with the amount", () => {
      const html = renderToStaticMarkup(
        CourseTermCancelledEmail({
          ...base,
          refundedAutomatically: true,
        }) as React.ReactElement
      )
      expect(html).toContain("2 200 Kč")
      expect(html).toContain("vracíme")
      expect(html).toContain("do několika dní")
      expect(html).not.toContain("Ozveme se vám co")
    })

    it("keeps the manual promise when the automatic refund did not run", () => {
      const html = renderToStaticMarkup(
        CourseTermCancelledEmail({
          ...base,
          refundedAutomatically: false,
        }) as React.ReactElement
      )
      expect(html).toContain("vrátíme v plné výši")
      expect(html).not.toContain("do několika dní")
    })

    it("says nothing about money to bookings that were not paid online", () => {
      const html = renderToStaticMarkup(
        CourseTermCancelledEmail({
          ...base,
          paidOnline: false,
          refundedAutomatically: false,
        }) as React.ReactElement
      )
      expect(html).not.toContain("vrátíme")
      expect(html).not.toContain("vracíme")
    })
  })

  describe("course-reservation-cancelled — single-cancel money variants", () => {
    const base = {
      customerName: "Jana Nováková",
      courseTitle: "Kurz točení pro dospělé",
      courseDate: "sobota 12. 9. 2026 10:00",
      courseLocation: "Ateliér u Písku",
      partySize: 2,
      totalAmount: "2 200 Kč",
    }

    it("tells a refunded customer the amount is already coming back", () => {
      const html = renderToStaticMarkup(
        CourseReservationCancelledEmail({
          ...base,
          variant: "refunded",
        }) as React.ReactElement
      )
      expect(html).toContain("byla zrušena")
      expect(html).toContain("2 200 Kč")
      expect(html).toContain("vracíme")
      expect(html).toContain("do několika dní")
      expect(html).not.toContain("Ozveme se")
    })

    it("promises a follow-up when the money has to come back by hand", () => {
      const html = renderToStaticMarkup(
        CourseReservationCancelledEmail({
          ...base,
          variant: "manual_refund",
        }) as React.ReactElement
      )
      expect(html).toContain("vrátíme v plné výši")
      expect(html).toContain("Ozveme se")
      expect(html).not.toContain("do několika dní")
    })

    it("says nothing about money on an unpaid reservation", () => {
      const html = renderToStaticMarkup(
        CourseReservationCancelledEmail({
          ...base,
          variant: "unpaid",
        }) as React.ReactElement
      )
      expect(html).not.toContain("vrátíme")
      expect(html).not.toContain("vracíme")
      expect(html).not.toContain("Zaplaceno")
    })
  })

  describe("course-reservation-cancelled — who cancelled", () => {
    const base = {
      customerName: "Jana Nováková",
      courseTitle: "Kurz točení pro dospělé",
      courseDate: "sobota 12. 9. 2026 10:00",
      courseLocation: "Ateliér u Písku",
      partySize: 2,
      totalAmount: "2 200 Kč",
    }

    it("confirms the customer's own cancel as their action, without apologising for a misunderstanding", () => {
      const html = renderToStaticMarkup(
        CourseReservationCancelledEmail({
          ...base,
          variant: "refunded",
          cancelledByCustomer: true,
        }) as React.ReactElement
      )
      expect(html).toContain("na vaši žádost")
      expect(html).not.toContain("nedorozumění")
      // The way back stays open — and the refund promise still holds.
      expect(html).toContain("rozmysleli")
      expect(html).toContain("vracíme")
    })

    it("keeps the owner's voice by default — including the misunderstanding line", () => {
      const html = renderToStaticMarkup(
        CourseReservationCancelledEmail({
          ...base,
          variant: "unpaid",
        }) as React.ReactElement
      )
      expect(html).not.toContain("na vaši žádost")
      expect(html).toContain("nedorozumění")
    })
  })
})
