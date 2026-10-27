import { generateCourseInvitationPdf } from "../course-invitation"

const sample = {
  reservationId: "01M5ZC5BATND561D2HMSWN76QT",
  customerName: "Matěj Forejt",
  courseTitle: "Večerní kurz točení na kruhu",
  courseDate: "středa 28. 10. 2026 17:00",
  courseLocation: "Ateliér Putim 229, Písek",
  courseDuration: "3 hodiny",
  partySize: 2,
  totalAmount: "900 Kč",
  paid: true,
  sellerName: "Lucie Polanská",
  sellerPhone: "+420 775 211 578",
  sellerEmail: "info@keramickazahrada.cz",
  sellerWeb: "keramickazahrada.cz",
  cancellationTerms:
    "Rezervaci můžete zrušit v účtu nebo z e-mailu nejpozději 24 hodin před začátkem kurzu — vrátíme vám celou zaplacenou částku do 14 dnů stejným způsobem, jakým jste platili. Méně než 24 hodin před začátkem už online zrušit nejde; zavolejte nám a domluvíme se individuálně (přesun na jiný termín, náhradník).",
}

describe("pozvánka na kurz (PDF)", () => {
  it("vznikne jednostránkové PDF s českou diakritikou", async () => {
    const bytes = await generateCourseInvitationPdf(sample)
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-")
    const { PDFDocument } = await import("pdf-lib")
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
    expect(doc.getTitle()).toContain("Večerní kurz")
    if (process.env.INVITATION_OUT) require("fs").writeFileSync(process.env.INVITATION_OUT, bytes)
  })

  it("nezaplacená rezervace a dlouhý název se vejdou", async () => {
    const bytes = await generateCourseInvitationPdf({
      ...sample,
      paid: false,
      courseTitle: "Víkendový intenzivní kurz modelování z volné ruky pro začátečníky i pokročilé",
      cancellationTerms: "",
      courseDuration: "",
    })
    expect(bytes.length).toBeGreaterThan(1000)
  })
})
