import { renderToStaticMarkup } from "react-dom/server"
import ResendNotificationProviderService, {
  attachmentsFromData,
  describeResendError,
  MAX_EMAIL_ATTACHMENTS,
  shouldRetryWithoutAttachments,
  templateDataOf,
} from "../service"

describe("describeResendError", () => {
  it("keeps the Resend error name, which is what says whose fault it is", () => {
    // `validation_error` and `missing_api_key` are our configuration; a
    // `rate_limit_exceeded` or `application_error` is Resend's side.
    expect(
      describeResendError({
        name: "validation_error",
        message: "The `from` address is not a verified domain",
        statusCode: 403,
      })
    ).toBe(
      "validation_error: The `from` address is not a verified domain: HTTP 403"
    )
  })

  it("reads a thrown transport error, not just a returned one", () => {
    const thrown = new Error("connect ETIMEDOUT")
    thrown.name = "FetchError"

    expect(describeResendError(thrown)).toBe("FetchError: connect ETIMEDOUT")
  })

  it("says something useful when Resend returns neither an id nor an error", () => {
    expect(describeResendError(null)).toContain("nevrátil")
    expect(describeResendError(undefined)).toContain("nevrátil")
  })

  it("never degrades to [object Object]", () => {
    // The old code logged the raw error, which printed as [object Object] and
    // told nobody anything.
    const described = describeResendError({ unexpected: "shape" })

    expect(described).not.toContain("[object Object]")
    expect(described).toContain("unexpected")
  })

  it("passes a plain string through", () => {
    expect(describeResendError("Domain not found")).toBe("Domain not found")
  })
})

describe("e-mail attachments (data.__attachments)", () => {
  const pdf = (name: string) => ({
    filename: `${name}.pdf`,
    url: `https://img.example.cz/legal/${name}.pdf`,
  })

  it("accepts only https URLs and plain .pdf file names", () => {
    expect(
      attachmentsFromData({
        __attachments: [
          pdf("obchodni-podminky-2026-10-15"),
          { filename: "x.pdf", url: "http://img.example.cz/x.pdf" },
          { filename: "../etc/passwd.pdf", url: "https://img.example.cz/a.pdf" },
          { filename: "faktura.exe", url: "https://img.example.cz/a.exe" },
          { filename: "bez-url.pdf" },
          null,
          "nesmysl",
        ],
      })
    ).toEqual([pdf("obchodni-podminky-2026-10-15")])
  })

  it("caps the number of attachments", () => {
    const many = Array.from({ length: 9 }, (_, index) => pdf(`dokument-${index}`))
    expect(attachmentsFromData({ __attachments: many })).toHaveLength(MAX_EMAIL_ATTACHMENTS)
  })

  it("ignores data without attachments", () => {
    expect(attachmentsFromData(undefined)).toEqual([])
    expect(attachmentsFromData({ __attachments: "a.pdf" })).toEqual([])
  })

  it("strips transport keys from the template data, and only then", () => {
    const data = { order: { id: "o" }, __attachments: [pdf("a")], __resendTags: [] }
    expect(templateDataOf(data)).toEqual({ order: { id: "o" } })
    // Bez přepravních klíčů jde do šablony tentýž objekt.
    const plain = { order: { id: "o" } }
    expect(templateDataOf(plain)).toBe(plain)
  })

  it("retries without attachments only after an API rejection that is not a quota or key problem", () => {
    expect(shouldRetryWithoutAttachments({ name: "validation_error", message: "x" })).toBe(true)
    expect(shouldRetryWithoutAttachments({ name: "application_error" })).toBe(true)
    expect(shouldRetryWithoutAttachments({ name: "rate_limit_exceeded" })).toBe(false)
    expect(shouldRetryWithoutAttachments({ name: "daily_quota_exceeded" })).toBe(false)
    expect(shouldRetryWithoutAttachments(new Error("ETIMEDOUT"))).toBe(false)
    expect(shouldRetryWithoutAttachments(null)).toBe(false)
  })

  describe("send()", () => {
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }

    const makeService = (
      send: jest.Mock,
      loadLegalFacts: () => Promise<unknown> = async () => null
    ) => {
      const service = new ResendNotificationProviderService({ logger } as any, {
        api_key: "re_test",
        from: "Keramická zahrada <obchod@example.cz>",
      })
      ;(service as any).resendClient = { emails: { send } }
      // Skutečný loader sahá na kořenový kontejner aplikace — v testu není.
      ;(service as any).loadLegalFacts = loadLegalFacts
      return service
    }

    const notification = (data: Record<string, unknown>) =>
      ({
        to: "jana@example.cz",
        channel: "email",
        template: "order-placed",
        data,
      }) as any

    const order = { id: "order_1", display_id: 42, currency_code: "czk", items: [] }

    beforeEach(() => {
      jest.clearAllMocks()
    })

    it("passes attachments to Resend as hosted paths and keeps them out of the template", async () => {
      const send = jest.fn().mockResolvedValue({ data: { id: "email_1" }, error: null })
      const service = makeService(send)

      await expect(
        service.send(notification({ order, __attachments: [pdf("obchodni-podminky-2026-10-15")] }))
      ).resolves.toEqual({ id: "email_1" })

      const options = send.mock.calls[0][0]
      expect(options.attachments).toEqual([
        {
          filename: "obchodni-podminky-2026-10-15.pdf",
          path: "https://img.example.cz/legal/obchodni-podminky-2026-10-15.pdf",
        },
      ])
      expect(options.react.props.__attachments).toBeUndefined()
      expect(options.react.props.order).toBe(order)
    })

    it("sends without an attachments field when there are none", async () => {
      const send = jest.fn().mockResolvedValue({ data: { id: "email_2" }, error: null })
      await makeService(send).send(notification({ order }))
      expect(send.mock.calls[0][0]).not.toHaveProperty("attachments")
    })

    it("re-sends without attachments when Resend rejects the mail with them", async () => {
      const send = jest
        .fn()
        .mockResolvedValueOnce({
          data: null,
          error: { name: "validation_error", message: "Unable to fetch attachment" },
        })
        .mockResolvedValueOnce({ data: { id: "email_3" }, error: null })
      const service = makeService(send)

      await expect(
        service.send(notification({ order, __attachments: [pdf("obchodni-podminky-2026-10-15")] }))
      ).resolves.toEqual({ id: "email_3" })

      expect(send).toHaveBeenCalledTimes(2)
      const retry = send.mock.calls[1][0]
      expect(retry).not.toHaveProperty("attachments")
      // Šablona se dozví, že „v příloze" už neplatí.
      expect(retry.react.props.attachments_failed).toBe(true)
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("bez příloh"))
    })

    it("does not retry on a rate limit — the notification fails as before", async () => {
      const send = jest.fn().mockResolvedValue({
        data: null,
        error: { name: "rate_limit_exceeded", message: "Too many requests" },
      })
      const service = makeService(send)

      await expect(
        service.send(notification({ order, __attachments: [pdf("a")] }))
      ).rejects.toThrow(/rate_limit_exceeded/)
      expect(send).toHaveBeenCalledTimes(1)
    })

    it("puts the live legal facts into the footer of the rendered e-mail", async () => {
      const send = jest.fn().mockResolvedValue({ data: { id: "email_4" }, error: null })
      const service = makeService(send, async () => ({
        "seller.name": "Lucie Polanská",
        "seller.address": "Nová 1, 397 01 Písek",
        "seller.ico": "03441482",
        "seller.email": "dilna@keramickazahrada.cz",
        "seller.phone": null,
      }))

      await service.send(notification({ order }))

      const html = renderToStaticMarkup(send.mock.calls[0][0].react)
      expect(html).toContain("Prodávající: Lucie Polanská · Nová 1, 397 01 Písek · IČO 03441482")
      expect(html).toContain("mailto:dilna@keramickazahrada.cz")
      // Telefon výslovně nevyplněný → v patičce není (ani záložní).
      expect(html).not.toContain("775 211 578")
    })

    it("falls back to the manifest identity when the facts cannot be read", async () => {
      const send = jest.fn().mockResolvedValue({ data: { id: "email_5" }, error: null })
      const service = makeService(send, async () => {
        throw new Error("databáze spí")
      })

      await expect(service.send(notification({ order }))).resolves.toEqual({ id: "email_5" })

      const options = send.mock.calls[0][0]
      // Bez údajů se šablona neobaluje — dostane svá data přímo.
      expect(options.react.props.order).toBe(order)
      const html = renderToStaticMarkup(options.react)
      expect(html).toContain("Prodávající: Lucie Polanská · Putim 229, 397 01 Písek · IČO 03441482")
      expect(html).toContain("+420 775 211 578")
    })
  })
})
