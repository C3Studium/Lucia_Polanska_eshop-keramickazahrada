import {
  attendanceRows,
  attendanceSheetKey,
  attendanceSummary,
  courseMessageKey,
  formatKc,
  isValidBatchKey,
  messageRecipients,
  termsDueForAttendanceSheet,
} from "../course-attendance"
import { generateAttendanceSheetPdf } from "../course-attendance-pdf"

const NOW = new Date("2026-11-03T08:00:00.000Z")
const inHours = (hours: number) => new Date(NOW.getTime() + hours * 3600_000).toISOString()

const reservation = (overrides: Record<string, unknown> = {}) => ({
  id: "res_1",
  name: "Jana Nováková",
  email: "jana@example.cz",
  phone: "+420 777 111 222",
  party_size: 2,
  total_price: 1800,
  paid_amount: 0,
  amount_due: 1800,
  payment_method: "on_site",
  payment_status: "pending",
  status: "active",
  note: null,
  ...overrides,
})

const term = (overrides: Record<string, unknown> = {}) => ({
  id: "term_1",
  starts_at: inHours(6),
  status: "published",
  reservations: [reservation()],
  ...overrides,
})

describe("prezenční listina — výběr termínů pro job", () => {
  it("bere termín, který začíná do 12 hodin", () => {
    expect(termsDueForAttendanceSheet([term()], NOW)).toHaveLength(1)
    expect(termsDueForAttendanceSheet([term({ starts_at: inHours(12) })], NOW)).toHaveLength(1)
  })

  it("nebere termín dál než 12 h ani termín, který už začal", () => {
    expect(termsDueForAttendanceSheet([term({ starts_at: inHours(12.1) })], NOW)).toHaveLength(0)
    expect(termsDueForAttendanceSheet([term({ starts_at: inHours(-0.5) })], NOW)).toHaveLength(0)
    expect(termsDueForAttendanceSheet([term({ starts_at: NOW.toISOString() })], NOW)).toHaveLength(0)
  })

  it("zrušený a skončený termín neposílá, koncept s rezervací ano", () => {
    expect(termsDueForAttendanceSheet([term({ status: "cancelled" })], NOW)).toHaveLength(0)
    expect(termsDueForAttendanceSheet([term({ status: "finished" })], NOW)).toHaveLength(0)
    expect(termsDueForAttendanceSheet([term({ status: "draft" })], NOW)).toHaveLength(1)
  })

  it("termín bez platných účastníků neposílá", () => {
    expect(termsDueForAttendanceSheet([term({ reservations: [] })], NOW)).toHaveLength(0)
    expect(
      termsDueForAttendanceSheet(
        [term({ reservations: [reservation({ status: "cancelled" })] })],
        NOW
      )
    ).toHaveLength(0)
  })

  it("jednou: odeslaný klíč se přeskočí, posunutý začátek má klíč nový", () => {
    const original = term()
    const sent = new Set([attendanceSheetKey(original)])
    expect(termsDueForAttendanceSheet([original], NOW, sent)).toHaveLength(0)
    const moved = term({ starts_at: inHours(7) })
    expect(attendanceSheetKey(moved)).not.toBe(attendanceSheetKey(original))
    expect(termsDueForAttendanceSheet([moved], NOW, sent)).toHaveLength(1)
  })

  it("klíč je oznámení majitelce s typem course-attendance", () => {
    const key = attendanceSheetKey(term())
    expect(key.startsWith("mn:course-attendance:term_1:")).toBe(true)
    expect(key.split(":")[1]).toBe("course-attendance")
  })
})

describe("prezenční listina — řádky a peníze", () => {
  it("jen platné rezervace, podle jména, se stavem peněz", () => {
    const rows = attendanceRows([
      reservation({ id: "a", name: "Zdeněk", payment_method: "online", payment_status: "paid", paid_amount: 900, amount_due: 0, total_price: 900, party_size: 1 }),
      reservation({ id: "b", name: "Čestmír" }),
      reservation({ id: "c", name: "Adam", status: "cancelled" }),
      reservation({ id: "d", name: "Alena", payment_method: "online", payment_status: "pending", total_price: 900, party_size: 1 }),
    ])
    expect(rows.map((row) => row.name)).toEqual(["Alena", "Čestmír", "Zdeněk"])
    const [alena, cestmir, zdenek] = rows
    expect(zdenek).toMatchObject({ paid: 900, due: 0, payment_note: "zaplaceno kartou" })
    expect(cestmir).toMatchObject({ paid: 0, due: 1800, payment_note: "platí na místě" })
    expect(alena).toMatchObject({ paid: 0, due: 900, payment_note: "čeká na platbu kartou" })
  })

  it("zaplacená rezervace po přidání osob: zbývá rozdíl", () => {
    const [row] = attendanceRows([
      reservation({ payment_method: "online", payment_status: "paid", paid_amount: 900, total_price: 1800 }),
    ])
    expect(row).toMatchObject({ paid: 900, due: 900, payment_note: "doplatit rozdíl" })
  })

  it("starší zaplacená rezervace bez evidence peněz = zaplaceno celé", () => {
    const [row] = attendanceRows([
      reservation({ payment_method: "on_site", payment_status: "paid", paid_amount: 0, total_price: 1800 }),
    ])
    expect(row).toMatchObject({ paid: 1800, due: 0, payment_note: "zaplaceno na místě" })
  })

  it("souhrn: osoby, rezervace, vybrat celkem, bez e-mailu", () => {
    const rows = attendanceRows([
      reservation({ id: "a", party_size: 2 }),
      reservation({ id: "b", party_size: 3, email: null, total_price: 2400 }),
    ])
    expect(attendanceSummary(rows)).toEqual({
      reservations: 2,
      people: 5,
      due_total: 4200,
      without_email: 1,
    })
  })

  it("částka bez pevných mezer", () => {
    expect(formatKc(1800)).toBe("1 800 Kč")
  })
})

describe("napsat všem — adresáti a klíče", () => {
  it("jen platné rezervace s e-mailem, každá adresa jednou; bez e-mailu zvlášť", () => {
    const { recipients, withoutEmail } = messageRecipients([
      reservation({ id: "a", email: "jana@example.cz" }),
      reservation({ id: "b", email: "JANA@example.cz ", name: "Jana znovu" }),
      reservation({ id: "c", email: "petr@example.cz", status: "cancelled" }),
      reservation({ id: "d", email: null, name: "Paní Malá", phone: "603 000 000" }),
      reservation({ id: "e", email: "eva@example.cz", name: "Eva" }),
    ])
    expect(recipients.map((r) => r.reservation_id)).toEqual(["a", "e"])
    expect(withoutEmail).toEqual([{ name: "Paní Malá", phone: "603 000 000" }])
  })

  it("klíč dávky: dvojklik = stejný klíč, nesmí obsahovat dvojtečku", () => {
    expect(courseMessageKey("batch-1234", "res_1")).toBe("course-message:batch-1234:res_1")
    expect(isValidBatchKey("1b4e28ba-2fa1-11d2-883f-0016d3cca427")).toBe(true)
    expect(isValidBatchKey("a:b:c:d:e")).toBe(false)
    expect(isValidBatchKey("short")).toBe(false)
    expect(isValidBatchKey(undefined)).toBe(false)
  })
})

describe("prezenční listina (PDF)", () => {
  it("vznikne PDF s diakritikou; dlouhý seznam jde na víc stran", async () => {
    const many = Array.from({ length: 30 }, (_, index) =>
      reservation({
        id: `r${index}`,
        name: `Účastník Žluťoučký ${index}`,
        email: `velmi.dlouha.adresa.ucastnika.${index}@nejakadomena-keramika.cz`,
        note: index % 3 ? null : "Přijde o 15 minut později, alergie na latex — rukavice nitrilové.",
      })
    )
    const bytes = await generateAttendanceSheetPdf({
      termId: "term_1",
      courseTitle: "Večerní kurz točení na kruhu",
      courseDate: "středa 4. 11. 2026 17:00",
      courseLocation: "Ateliér Putim 229, Písek",
      courseDuration: "3 hodiny",
      rows: attendanceRows(many),
    })
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-")
    const { PDFDocument } = await import("pdf-lib")
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThan(1)
    expect(doc.getTitle()).toContain("Prezenční listina")
    if (process.env.ATTENDANCE_OUT) require("fs").writeFileSync(process.env.ATTENDANCE_OUT, bytes)
  })
})
