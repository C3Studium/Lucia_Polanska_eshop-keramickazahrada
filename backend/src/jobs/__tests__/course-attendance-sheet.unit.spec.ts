import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import courseAttendanceSheet from "../course-attendance-sheet"
import { attendanceSheetKey } from "../../lib/course-attendance"
import { COURSE_MODULE } from "../../modules/course"

/**
 * Job prezenční listiny proti falešnému kontejneru: kdo dostane listinu,
 * že se nic neposílá dvakrát a že e-mail jde majitelce i bez přílohy.
 */

const inHours = (hours: number) => new Date(Date.now() + hours * 3600_000).toISOString()

const reservation = (overrides: Record<string, unknown> = {}) => ({
  id: "res_1",
  name: "Jana Nováková",
  email: "jana@example.cz",
  phone: "777 111 222",
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

const makeContainer = (terms: any[], existingKeys: string[] = []) => {
  const created: any[] = []
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const notifications = {
    listNotifications: jest.fn(async (filters: any) =>
      existingKeys
        .filter((key) => (filters.idempotency_key as string[]).includes(key))
        .map((key) => ({ id: key, idempotency_key: key }))
    ),
    createNotifications: jest.fn(async (payloads: any[]) => {
      created.push(...payloads)
      return payloads
    }),
  }
  const courseService = { listCourseTerms: jest.fn(async () => terms) }
  const files = {
    createFiles: jest.fn(async () => [{ url: "http://localhost:9100/static/listina.pdf" }]),
  }
  const container = {
    resolve: (key: string) => {
      if (key === ContainerRegistrationKeys.LOGGER) return logger
      if (key === Modules.NOTIFICATION) return notifications
      if (key === COURSE_MODULE) return courseService
      if (key === Modules.FILE) return files
      throw new Error(`neznámá služba ${key}`)
    },
  }
  return { container: container as any, created, notifications, logger, files }
}

describe("job prezenční listiny", () => {
  const env = process.env
  beforeEach(() => {
    process.env = { ...env, OWNER_NOTIFICATION_EMAIL: "lucie@example.cz" }
  })
  afterAll(() => {
    process.env = env
  })

  it("pošle majitelce zvoneček + e-mail se seznamem; bez https PDF nic neslibuje v příloze", async () => {
    const term = {
      id: "term_1",
      title: "Kurz točení",
      location: "Ateliér",
      starts_at: inHours(5),
      duration_minutes: 180,
      status: "published",
      reservations: [reservation(), reservation({ id: "res_2", name: "Zrušená", status: "cancelled" })],
    }
    const { container, created, files } = makeContainer([term])
    await courseAttendanceSheet(container)

    expect(files.createFiles).toHaveBeenCalledTimes(1)
    expect(created).toHaveLength(2)
    const [feed, email] = created
    expect(feed.channel).toBe("feed")
    expect(feed.idempotency_key).toBe(attendanceSheetKey(term))
    expect(email.channel).toBe("email")
    expect(email.to).toBe("lucie@example.cz")
    expect(email.idempotency_key).toBe(`${attendanceSheetKey(term)}:email`)
    expect(email.data.description).toContain("Jana Nováková")
    expect(email.data.description).toContain("vybrat 1 800 Kč")
    expect(email.data.description).not.toContain("Zrušená")
    expect(email.data.description).toContain("v administraci")
    expect(email.data.__attachments).toBeUndefined()
  })

  it("odeslanou listinu znovu neposílá a PDF už nedělá", async () => {
    const term = {
      id: "term_1",
      title: "Kurz",
      location: "Ateliér",
      starts_at: inHours(5),
      status: "published",
      reservations: [reservation()],
    }
    const { container, created, files } = makeContainer([term], [attendanceSheetKey(term)])
    await courseAttendanceSheet(container)
    expect(created).toHaveLength(0)
    expect(files.createFiles).not.toHaveBeenCalled()
  })

  it("prázdný termín neposílá", async () => {
    const { container, created } = makeContainer([
      { id: "t", title: "Kurz", location: "A", starts_at: inHours(3), status: "published", reservations: [] },
    ])
    await courseAttendanceSheet(container)
    expect(created).toHaveLength(0)
  })

  it("bez adresy majitelky jde aspoň zvoneček", async () => {
    delete process.env.OWNER_NOTIFICATION_EMAIL
    const { container, created, logger } = makeContainer([
      { id: "t", title: "Kurz", location: "A", starts_at: inHours(3), status: "published", reservations: [reservation()] },
    ])
    await courseAttendanceSheet(container)
    expect(created.map((row) => row.channel)).toEqual(["feed"])
    expect(logger.warn).toHaveBeenCalled()
  })
})
