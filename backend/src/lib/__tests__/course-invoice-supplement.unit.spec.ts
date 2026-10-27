import { ensureInvoiceForCourseSupplement } from "../course-invoice"
import { IDOKLAD_MODULE } from "../../modules/idoklad"
import { COURSE_MODULE } from "../../modules/course"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Faktura na doplatek po přidání osob: vlastní doklad na ROZDÍL (ne na celou
 * cenu), zaznamená se k doplatku, zapíše úhradu a PDF; podruhé už nevystaví.
 */
const makeContainer = () => {
  const idoklad = {
    vatPayer: false,
    numericSequenceId: 7,
    findContactByEmail: jest.fn().mockResolvedValue({ Id: 11 }),
    findCountryIdByCode: jest.fn(),
    createContact: jest.fn(),
    getInvoiceDefault: jest.fn().mockResolvedValue({ CurrencyId: 1, PaymentOptionId: 2, DocumentSerialNumber: 5 }),
    listPaymentOptions: jest.fn().mockResolvedValue([]),
    createInvoice: jest.fn().mockResolvedValue({ Id: 99, DocumentNumber: "20260077" }),
    fullyPayInvoice: jest.fn().mockResolvedValue(undefined),
    getInvoicePdf: jest.fn().mockResolvedValue(Buffer.from("%PDF-fake")),
  }
  const courseService = { updateCoursePaymentRequests: jest.fn().mockResolvedValue({}) }
  const fileModule = { createFiles: jest.fn().mockResolvedValue([{ url: "https://files.test/faktura-20260077.pdf" }]) }
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const container = {
    resolve: (key: string) =>
      key === IDOKLAD_MODULE
        ? idoklad
        : key === COURSE_MODULE
          ? courseService
          : key === Modules.FILE
            ? fileModule
            : key === ContainerRegistrationKeys.LOGGER
              ? logger
              : (() => {
                  throw new Error(`neznámé ${key}`)
                })(),
  } as any
  return { container, idoklad, courseService }
}

const request = { id: "cpr_1", amount: 1000, party_size: 2, paid_at: "2026-10-28T10:00:00Z" }
const reservation = { id: "res_1", name: "Jana", email: "jana@test.cz", idoklad_invoice_number: "20260041" }
const term = { title: "Večerní kurz", starts_at: "2026-11-10T16:00:00Z" }

describe("faktura na doplatek kurzu", () => {
  it("vystaví fakturu na rozdíl, zapíše úhradu a uloží PDF k doplatku", async () => {
    const { container, idoklad, courseService } = makeContainer()
    const result = await ensureInvoiceForCourseSupplement(container, request, reservation, term)
    expect(result).toMatchObject({ status: "created", invoice_number: "20260077", pdf_url: "https://files.test/faktura-20260077.pdf" })
    const payload = idoklad.createInvoice.mock.calls[0][0]
    expect(payload.Items[0].UnitPrice).toBe(1000)
    expect(payload.Items[0].Name).toContain("navýšení na 2 os.")
    expect(payload.Note).toContain("20260041")
    expect(idoklad.fullyPayInvoice).toHaveBeenCalledWith(99, expect.any(String))
    expect(courseService.updateCoursePaymentRequests).toHaveBeenCalledWith(
      expect.objectContaining({ id: "cpr_1", idoklad_invoice_id: 99, idoklad_invoice_number: "20260077" })
    )
  })

  it("podruhé nevystaví — doplatek už fakturu má", async () => {
    const { container, idoklad } = makeContainer()
    const result = await ensureInvoiceForCourseSupplement(
      container,
      { ...request, idoklad_invoice_id: 99, idoklad_invoice_number: "20260077" },
      reservation,
      term
    )
    expect(result.status).toBe("exists")
    expect(idoklad.createInvoice).not.toHaveBeenCalled()
  })
})
