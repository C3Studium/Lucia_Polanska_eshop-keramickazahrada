import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { renderToStaticMarkup } from "react-dom/server"
import { sendCourseMessage } from "../course-message"
import { CourseMessageEmail } from "../../modules/resend/emails/course-message"

/**
 * „Napsat všem účastníkům" proti falešnému notifikačnímu modulu: komu to
 * odejde, s jakým klíčem (dvojklik = stejné klíče) a že chyba jednoho
 * nezastaví ostatní.
 */

const makeContainer = (failFor: string[] = []) => {
  const sent: any[] = []
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const notifications = {
    createNotifications: jest.fn(async (payload: any) => {
      if (failFor.includes(payload.to)) throw new Error("rate_limit_exceeded")
      sent.push(payload)
      return payload
    }),
  }
  const container = {
    resolve: (key: string) => {
      if (key === ContainerRegistrationKeys.LOGGER) return logger
      if (key === Modules.NOTIFICATION) return notifications
      throw new Error(`neznámá služba ${key}`)
    },
  }
  return { container: container as any, sent, logger }
}

const term = {
  id: "term_1",
  title: "Kurz točení",
  location: "Ateliér Putim",
  starts_at: "2026-11-07T09:00:00.000Z",
  status: "published",
  reservations: [
    { id: "a", name: "Jana", email: "jana@example.cz", status: "active" },
    { id: "b", name: "Jana podruhé", email: "jana@example.cz", status: "active" },
    { id: "c", name: "Petr", email: "petr@example.cz", status: "cancelled" },
    { id: "d", name: "Paní Malá", email: null, phone: "603 000 000", status: "active" },
    { id: "e", name: "Eva", email: "eva@example.cz", status: "active" },
  ],
}

describe("napsat všem účastníkům", () => {
  const env = process.env
  beforeEach(() => {
    process.env = { ...env, STOREFRONT_PUBLIC_URL: "https://keramickazahrada.cz", JWT_SECRET: "test-secret" }
  })
  afterAll(() => {
    process.env = env
  })

  it("jeden e-mail na platnou adresu, česky, s klíčem dávky a předmětem", async () => {
    const { container, sent } = makeContainer()
    const result = await sendCourseMessage(
      container,
      term,
      { message: "Zdržím se o 30 minut.", subject: "", batchKey: "batch-1234" },
      { pauseMs: 0 }
    )
    expect(result.sent).toBe(2)
    expect(result.failed).toEqual([])
    expect(result.without_email).toEqual([{ name: "Paní Malá", phone: "603 000 000" }])
    expect(sent.map((row) => row.to)).toEqual(["jana@example.cz", "eva@example.cz"])
    expect(sent.map((row) => row.idempotency_key)).toEqual([
      "course-message:batch-1234:a",
      "course-message:batch-1234:e",
    ])
    expect(sent[0].template).toBe("course-message")
    // Kurzy jen česky — žádný jazyk v datech.
    expect(sent[0].data.locale).toBeUndefined()
    expect(sent[0].data.subject).toContain("Zpráva ke kurzu Kurz točení")
    expect(sent[0].data.message).toBe("Zdržím se o 30 minut.")
    expect(sent[0].data.reservationLink).toContain("/kurzy/rezervace/a?token=")
  })

  it("vlastní předmět má přednost; chyba u jednoho nezastaví ostatní", async () => {
    const { container, sent } = makeContainer(["jana@example.cz"])
    const result = await sendCourseMessage(
      container,
      term,
      { message: "Přineste zástěru.", subject: "Zástěry s sebou", batchKey: "batch-5678" },
      { pauseMs: 0 }
    )
    expect(result.sent).toBe(1)
    expect(result.failed).toEqual(["Jana"])
    expect(sent[0].data.subject).toBe("Zástěry s sebou")
  })

  it("šablona: text zprávy, údaje kurzu a tlačítko na rezervaci", () => {
    const html = renderToStaticMarkup(
      CourseMessageEmail({
        customerName: "Jana Nováková",
        courseTitle: "Kurz točení",
        courseDate: "sobota 7. 11. 2026 10:00",
        courseLocation: "Ateliér Putim",
        message: "Zdržím se o 30 minut.",
        reservationLink: "https://keramickazahrada.cz/cz/kurzy/rezervace/a?token=x",
        canReply: true,
      }) as React.ReactElement
    )
    expect(html).toContain("Zdržím se o 30 minut.")
    expect(html).toContain("Ateliér Putim")
    expect(html).toContain("Zobrazit rezervaci")
    expect(html).toContain("stačí na tento e-mail odpovědět")
  })
})
