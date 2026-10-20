const mockSendCustomerEmail = jest.fn()

jest.mock("../customer-email", () => ({
  ...jest.requireActual("../customer-email"),
  sendCustomerEmail: (...args: unknown[]) => mockSendCustomerEmail(...args),
}))

import { Modules } from "@medusajs/framework/utils"
import { sendCourseReservationConfirmedEmail } from "../course-emails"
import { MERCHANT_SETTINGS_METADATA_KEY } from "../merchant-settings"

/**
 * Potvrzení rezervace kurzu cituje storno podmínky z právních údajů
 * (`course.cancellation`, administrace → Právní údaje) — tentýž text, který
 * zákazník potvrdil v okně rezervace. Nevyplněné nebo nečitelné nastavení
 * = do dat nejde nic a šablona odkáže na OP čl. X.
 */

const logger = { warn: jest.fn(), info: jest.fn(), error: jest.fn() }

const containerWith = (listStores: () => Promise<unknown[]>) =>
  ({
    resolve: (key: string) => {
      if (key === Modules.STORE) return { listStores }
      if (key === "logger") return logger
      throw new Error(`Could not resolve '${key}'`)
    },
  }) as any

const reservation = {
  id: "res_1",
  email: "jana@example.cz",
  name: "Jana Nováková",
  party_size: 2,
  total_price: 2400,
  consents: null,
  created_at: "2026-10-20T10:00:00Z",
}
const term = {
  title: "Kurz točení",
  starts_at: "2026-11-07T09:00:00Z",
  location: "Ateliér",
  duration_minutes: 180,
}

const TERMS =
  "Rezervaci můžete zrušit zdarma nejpozději 7 dní před kurzem; později vracíme polovinu ceny."

describe("sendCourseReservationConfirmedEmail — storno podmínky", () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    // Bez storefrontu: žádné PDF k ověřování ani podepsané odkazy.
    delete process.env.STOREFRONT_PUBLIC_URL
    delete process.env.MEDUSA_STOREFRONT_URL
    delete process.env.STORE_CORS
    mockSendCustomerEmail.mockReset().mockResolvedValue(true)
  })

  afterAll(() => {
    process.env = env
  })

  const sentData = () => mockSendCustomerEmail.mock.calls[0][1].data

  it("quotes the filled-in legal fact", async () => {
    const container = containerWith(async () => [
      {
        id: "store_1",
        metadata: {
          [MERCHANT_SETTINGS_METADATA_KEY]: { legal_facts: { "course.cancellation": TERMS } },
        },
      },
    ])
    await sendCourseReservationConfirmedEmail(container, reservation, term, { variant: "paid" })
    expect(sentData().cancellationTerms).toBe(TERMS)
  })

  it("sends no terms text while the fact is not filled in", async () => {
    const container = containerWith(async () => [{ id: "store_1", metadata: {} }])
    await sendCourseReservationConfirmedEmail(container, reservation, term, { variant: "on_site" })
    expect(sentData().cancellationTerms).toBe("")
  })

  it("still sends the confirmation when the settings cannot be read", async () => {
    const container = containerWith(async () => {
      throw new Error("connection terminated")
    })
    await expect(
      sendCourseReservationConfirmedEmail(container, reservation, term, { variant: "paid" })
    ).resolves.toBe(true)
    expect(sentData().cancellationTerms).toBe("")
  })
})
