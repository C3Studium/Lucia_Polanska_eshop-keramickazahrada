import {
  buildInquiryCustomerEmail,
  buildInquiryOwnerNotification,
  CommissionInquirySchema,
  consumeAll,
  createWindowLimiter,
  firstIssueMessage,
  formatPragueDateTime,
  INVALID_INQUIRY,
  isHoneypotFilled,
  MAX_INQUIRY_PHOTO_BYTES,
  matchesImageSignature,
  neutralizeLinks,
  photoCountLabel,
  preparePhotos,
  safeInquiryFileName,
  termsVersionLabel,
} from "../commission-inquiry"

/**
 * Poptávka zakázky ze stránky Výroba (LEGAL_AUDIT.md §2 a §9): schéma
 * s povinným souhlasem s OP, honeypot, fotky (typ podle obsahu, velikost),
 * omezovač a texty obou e-mailů.
 */

const base = {
  description: "  Domovní číslo 229 s vlaštovkou.  ",
  dimensions: "30 × 20 cm",
  motif: "229",
  deadline: "do Vánoc",
  name: " Jana Nováková ",
  email: " jana@example.cz ",
  phone: "+420 603 123 456",
  terms_accepted: true,
  terms_version: "2026-10-15",
}

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00])
const WEBP = Buffer.concat([
  Buffer.from("RIFF", "latin1"),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from("WEBPVP8 ", "latin1"),
])
const HEIC = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x18]),
  Buffer.from("ftypheic", "latin1"),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
])

const photo = (buffer: Buffer, mime = "image/jpeg", filename = "IMG_0001.JPG") => ({
  filename,
  mime_type: mime,
  data: `data:${mime};base64,${buffer.toString("base64")}`,
})

describe("CommissionInquirySchema", () => {
  it("projde úplná poptávka a ořízne mezery", () => {
    const parsed = CommissionInquirySchema.parse(base)
    expect(parsed.name).toBe("Jana Nováková")
    expect(parsed.email).toBe("jana@example.cz")
    expect(parsed.description).toBe("Domovní číslo 229 s vlaštovkou.")
  })

  it("stačí popis, jméno, e-mail a souhlas", () => {
    const parsed = CommissionInquirySchema.safeParse({
      description: "Reliéf na branku",
      name: "Jana",
      email: "jana@example.cz",
      terms_accepted: true,
    })
    expect(parsed.success).toBe(true)
  })

  it("bez souhlasu s OP neprojde — a hláška je česky", () => {
    const parsed = CommissionInquirySchema.safeParse({ ...base, terms_accepted: false })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(firstIssueMessage(parsed.error)).toBe(
        "Bez souhlasu s obchodními podmínkami poptávku odeslat nejde."
      )
    }
    const missing = CommissionInquirySchema.safeParse({ ...base, terms_accepted: undefined })
    expect(missing.success).toBe(false)
  })

  it("povinný popis, jméno a platný e-mail", () => {
    for (const [field, value, message] of [
      ["description", "   ", "Napište prosím, co si představujete."],
      ["name", "", "Napište prosím své jméno."],
      ["email", "jana@", "Zkontrolujte prosím e-mail — na něj vám pošlu nabídku."],
    ] as const) {
      const parsed = CommissionInquirySchema.safeParse({ ...base, [field]: value })
      expect(parsed.success).toBe(false)
      if (!parsed.success) expect(firstIssueMessage(parsed.error)).toBe(message)
    }
  })

  it("hlídá délky a telefon", () => {
    expect(
      CommissionInquirySchema.safeParse({ ...base, description: "x".repeat(4001) }).success
    ).toBe(false)
    expect(CommissionInquirySchema.safeParse({ ...base, motif: "x".repeat(501) }).success).toBe(
      false
    )
    expect(CommissionInquirySchema.safeParse({ ...base, phone: "12" }).success).toBe(false)
    expect(CommissionInquirySchema.safeParse({ ...base, phone: "" }).success).toBe(true)
  })

  it("verze OP je datum nebo „unknown“", () => {
    expect(CommissionInquirySchema.safeParse({ ...base, terms_version: "unknown" }).success).toBe(
      true
    )
    expect(
      CommissionInquirySchema.safeParse({ ...base, terms_version: "<script>" }).success
    ).toBe(false)
  })

  it("nejvýš 6 fotek", () => {
    const seven = Array.from({ length: 7 }, () => photo(JPEG))
    const parsed = CommissionInquirySchema.safeParse({ ...base, photos: seven })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(firstIssueMessage(parsed.error)).toBe("Přiložit jde nejvýš 6 fotek.")
    }
  })

  it("anglická hláška zodu se zákazníkovi neukáže", () => {
    const parsed = CommissionInquirySchema.safeParse({ ...base, name: 42 })
    expect(parsed.success).toBe(false)
    if (!parsed.success) expect(firstIssueMessage(parsed.error)).toBe(INVALID_INQUIRY)
  })
})

describe("honeypot", () => {
  it("vyplněné pole website = robot, prázdné ne", () => {
    expect(isHoneypotFilled({ website: "https://spam.example" })).toBe(true)
    expect(isHoneypotFilled({ website: "   " })).toBe(false)
    expect(isHoneypotFilled({})).toBe(false)
    expect(isHoneypotFilled(null)).toBe(false)
  })
})

describe("preparePhotos", () => {
  it("přijme JPG, PNG, WEBP i HEIC podle obsahu a vrátí čisté base64", () => {
    const result = preparePhotos([
      photo(JPEG),
      photo(PNG, "image/png", "a.png"),
      photo(WEBP, "image/webp", "b.webp"),
      photo(HEIC, "image/heic", "c.heic"),
    ])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.files).toHaveLength(4)
      expect(result.files[0].content).toBe(JPEG.toString("base64"))
      expect(result.files[0].access).toBe("public")
      expect(result.files[0].filename).toBe("poptavka-IMG_0001.JPG")
    }
  })

  it("odmítne jiný typ i soubor, který se za fotku jen vydává", () => {
    expect(preparePhotos([photo(JPEG, "image/gif")]).ok).toBe(false)
    const html = Buffer.from("<html><script>alert(1)</script></html>")
    const fake = preparePhotos([photo(html, "image/jpeg")])
    expect(fake.ok).toBe(false)
    if (!fake.ok) expect(fake.message).toContain("není fotka")
  })

  it("odmítne prázdnou a příliš velkou fotku i příliš velký součet", () => {
    expect(preparePhotos([{ filename: "x.jpg", mime_type: "image/jpeg", data: "data:image/jpeg;base64," }]).ok).toBe(false)

    const big = Buffer.alloc(MAX_INQUIRY_PHOTO_BYTES + 1)
    JPEG.copy(big)
    expect(preparePhotos([photo(big)]).ok).toBe(false)

    const five = Buffer.alloc(5 * 1024 * 1024)
    JPEG.copy(five)
    const total = preparePhotos([photo(five), photo(five)])
    expect(total.ok).toBe(false)
    if (!total.ok) expect(total.message).toContain("dohromady")
  })

  it("signatury formátů", () => {
    expect(matchesImageSignature("image/png", JPEG)).toBe(false)
    expect(matchesImageSignature("image/jpeg", JPEG)).toBe(true)
    expect(matchesImageSignature("image/webp", WEBP)).toBe(true)
    expect(matchesImageSignature("image/heic", HEIC)).toBe(true)
  })

  it("bezpečný název souboru", () => {
    expect(safeInquiryFileName("Fasáda domu č. 229.jpg")).toBe("poptavka-Fasada-domu-c.-229.jpg")
    expect(safeInquiryFileName("../../etc/passwd")).toBe("poptavka-etc-passwd")
    expect(safeInquiryFileName("")).toBe("poptavka-foto")
  })
})

describe("omezovač", () => {
  it("pustí tři pokusy za okno, čtvrtý odmítne, po okně zase pustí", () => {
    const limiter = createWindowLimiter({ name: "email", windowMs: 1000, limit: 3 })
    const t0 = 1_000_000
    expect(consumeAll([[limiter, "a"]], t0)).toBeNull()
    expect(consumeAll([[limiter, "a"]], t0 + 1)).toBeNull()
    expect(consumeAll([[limiter, "a"]], t0 + 2)).toBeNull()
    expect(consumeAll([[limiter, "a"]], t0 + 3)).toBe("email")
    // Jiný klíč má vlastní okno.
    expect(consumeAll([[limiter, "b"]], t0 + 3)).toBeNull()
    // Klouzavé okno: po vypršení prvního pokusu je místo pro jeden další.
    expect(consumeAll([[limiter, "a"]], t0 + 1000)).toBeNull()
    expect(consumeAll([[limiter, "a"]], t0 + 1000)).toBe("email")
  })

  it("odmítnutý pokus se nezapisuje do žádného okna", () => {
    const perEmail = createWindowLimiter({ name: "email", windowMs: 1000, limit: 1 })
    const perIp = createWindowLimiter({ name: "ip", windowMs: 1000, limit: 5 })
    const t0 = 5_000_000
    expect(consumeAll([[perEmail, "a"], [perIp, "1.2.3.4"]], t0)).toBeNull()
    expect(consumeAll([[perEmail, "a"], [perIp, "1.2.3.4"]], t0 + 1)).toBe("email")
    // IP má zapsaný jen ten jeden úspěšný pokus → ještě čtyři projdou.
    for (let index = 0; index < 4; index++) {
      expect(consumeAll([[perEmail, `x${index}`], [perIp, "1.2.3.4"]], t0 + 2)).toBeNull()
    }
    expect(consumeAll([[perEmail, "y"], [perIp, "1.2.3.4"]], t0 + 2)).toBe("ip")
  })

  it("paměť má strop", () => {
    const limiter = createWindowLimiter({ name: "ip", windowMs: 60_000, limit: 3, maxKeys: 10 })
    for (let index = 0; index < 50; index++) limiter.record(`ip-${index}`, 1000 + index)
    expect(limiter.size()).toBeLessThanOrEqual(10)
  })
})

describe("texty", () => {
  const receivedAt = new Date("2026-10-14T13:32:10.000Z")
  const input = CommissionInquirySchema.parse({
    ...base,
    description: "Číslo 229, inspirace: https://pinterest.example/pin/1 a www.example.cz",
  })
  const context = {
    receivedAt,
    photoUrls: ["https://img.example/poptavka-1.jpg", "https://img.example/poptavka-2.jpg"],
    photosFailed: 0,
  }

  it("pražský čas a popisky", () => {
    expect(formatPragueDateTime(receivedAt)).toBe("14. 10. 2026 15:32")
    expect(formatPragueDateTime(receivedAt, true)).toBe("14. 10. 2026 15:32:10")
    expect(termsVersionLabel("2026-10-15")).toBe("15. 10. 2026")
    expect(termsVersionLabel("unknown")).toBeNull()
    expect(photoCountLabel(1)).toBe("1 fotka")
    expect(photoCountLabel(3)).toBe("3 fotky")
    expect(photoCountLabel(5)).toBe("5 fotek")
  })

  it("e-mail majitelce nese všechna pole, fotky, kontakt a souhlas s verzí a časem", () => {
    const owner = buildInquiryOwnerNotification(input, context)
    expect(owner.title).toBe("Poptávka zakázky — Jana Nováková")
    expect(owner.replyTo).toBe("jana@example.cz")
    expect(owner.key.startsWith("mn:commission-inquiry:")).toBe(true)
    const text = owner.description
    expect(text).toContain("Od: Jana Nováková <jana@example.cz>")
    expect(text).toContain("Telefon: +420 603 123 456")
    // Majitelka dostane text celý, i s odkazy.
    expect(text).toContain("https://pinterest.example/pin/1")
    expect(text).toContain("Rozměry: 30 × 20 cm")
    expect(text).toContain("Motiv / text / číslo: 229")
    expect(text).toContain("Termín: do Vánoc")
    expect(text).toContain("Fotografie místa (2):")
    expect(text).toContain("https://img.example/poptavka-2.jpg")
    expect(text).toContain("verze 2026-10-15 (účinná od 15. 10. 2026)")
    expect(text).toContain("14. 10. 2026 15:32:10")
    expect(text).toContain("2026-10-14T13:32:10.000Z")
    expect(text).toContain("§ 1837 písm. d)")
  })

  it("chybějící pole a nenahrané fotky majitelka vidí", () => {
    const minimal = CommissionInquirySchema.parse({
      description: "Reliéf",
      name: "Jana",
      email: "jana@example.cz",
      terms_accepted: true,
    })
    const owner = buildInquiryOwnerNotification(minimal, {
      receivedAt,
      photoUrls: [],
      photosFailed: 2,
    })
    expect(owner.description).toContain("Telefon: neuveden")
    expect(owner.description).toContain("Rozměry: neuvedeno")
    expect(owner.description).toContain("Fotografie místa: žádné")
    expect(owner.description).toContain("2 fotky se nepodařilo uložit")
    expect(owner.description).toContain("verze neznámá")
  })

  it("potvrzení zákazníkovi: zneškodněné odkazy, počet fotek, verze a čas, odkazy na OP", () => {
    const email = buildInquiryCustomerEmail(input, context, {
      storefrontBase: "https://keramickazahrada.cz/cz/",
      replyTo: "info@keramickazahrada.cz",
    })
    expect(email.template).toBe("commission-inquiry-received")
    expect(email.to).toBe("jana@example.cz")
    expect(email.key.startsWith("commission-inquiry:")).toBe(true)
    expect(email.data.description).toBe("Číslo 229, inspirace: (odkaz) a (odkaz)")
    expect(email.data.photoCount).toBe(2)
    expect(email.data.termsVersion).toBe("2026-10-15")
    expect(email.data.termsVersionLabel).toBe("15. 10. 2026")
    expect(email.data.consentedAt).toBe("2026-10-14T13:32:10.000Z")
    expect(email.data.consentedAtLabel).toBe("14. 10. 2026 15:32")
    expect(email.data.termsUrl).toBe(
      "https://keramickazahrada.cz/cz/smluvni-podminky#vyroba-na-zakazku"
    )
    expect(email.data.privacyUrl).toBe("https://keramickazahrada.cz/cz/ochrana-osobnich-udaju")
    expect(email.data.reply_to).toBe("info@keramickazahrada.cz")
  })

  it("dvojklik téhož dne = stejný klíč; jiný den nebo jiný text = jiný", () => {
    const a = buildInquiryOwnerNotification(input, context).key
    const b = buildInquiryOwnerNotification(input, { ...context, receivedAt: new Date("2026-10-14T20:00:00Z") }).key
    const nextDay = buildInquiryOwnerNotification(input, { ...context, receivedAt: new Date("2026-10-15T08:00:00Z") }).key
    const other = buildInquiryOwnerNotification({ ...input, description: "Jiný text" }, context).key
    expect(a).toBe(b)
    expect(a).not.toBe(nextDay)
    expect(a).not.toBe(other)
  })

  it("neutralizeLinks", () => {
    expect(neutralizeLinks("viz http://a.example/x?y=1, díky")).toBe("viz (odkaz) díky")
    expect(neutralizeLinks("bez odkazu")).toBe("bez odkazu")
  })
})

describe("poptávka z výrobku s cenou po domluvě", () => {
  const base = {
    description: "Znamení s liškou",
    name: "Jana Nováková",
    email: "jana@example.com",
    terms_accepted: true as const,
    terms_version: "2026-10-15",
  }

  it("product_handle a product_title projdou schématem a jsou nepovinné", () => {
    expect(CommissionInquirySchema.safeParse(base).success).toBe(true)
    const parsed = CommissionInquirySchema.safeParse({
      ...base,
      product_handle: " domovni-znameni-na-zakazku ",
      product_title: "Domovní znamení",
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.product_handle).toBe("domovni-znameni-na-zakazku")
    }
  })

  it("majitelka vidí „K výrobku“ jen když výrobek přišel", () => {
    const context = { receivedAt: new Date("2026-10-21T10:00:00Z"), photoUrls: [], photosFailed: 0 }
    const bez = buildInquiryOwnerNotification(base, context)
    expect(String(bez.description)).not.toContain("K výrobku")
    const s = buildInquiryOwnerNotification(
      { ...base, product_handle: "domovni-znameni-na-zakazku", product_title: "Domovní znamení" },
      context
    )
    const text = String(s.description)
    expect(text).toContain("K výrobku: Domovní znamení")
    expect(text.indexOf("K výrobku")).toBeLessThan(text.indexOf("Co si představuje"))
  })
})
