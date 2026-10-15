import {
  EMAIL_OPTOUT_KINDS,
  emailOptOutUrl,
  isEmailOptOutKind,
  signEmailOptOutToken,
  verifyEmailOptOutToken,
} from "../email-optout-link"
import {
  isInOptOutSet,
  optedOutEmails,
  recordEmailOptOut,
  type EmailOptOutStore,
} from "../email-optout"
import { signUnsubscribeToken } from "../newsletter-link"
import { buildReviewEmailData } from "../review-request"
import { rozdelPodleOdmitnuti } from "../../workflows/steps/send-abandoned-notifications"
import { GET } from "../../api/email-optout/route"

/**
 * Odmítnutí e-mailů z oprávněného zájmu jedním kliknutím (§ 7 odst. 3
 * zákona č. 480/2004 Sb., čl. 21 GDPR) — OP čl. XIV a Zásady slibují odkaz
 * v každé prosbě o recenzi, upozornění na pokles ceny a připomenutí košíku.
 */

/** Paměťová náhrada služby modulu (`listEmailOptOuts` / `createEmailOptOuts`). */
const memoryStore = (rows: Array<{ email: string; kind: string }> = []) => {
  const calls = { list: 0, create: 0 }
  const store: EmailOptOutStore = {
    listEmailOptOuts: async (filters: any) => {
      calls.list++
      const emails: string[] = Array.isArray(filters.email) ? filters.email : [filters.email]
      return rows.filter((row) => emails.includes(row.email) && row.kind === filters.kind)
    },
    createEmailOptOuts: async (data: any) => {
      calls.create++
      if (rows.some((row) => row.email === data.email && row.kind === data.kind)) {
        throw new Error('duplicate key value violates unique constraint "IDX_email_opt_out_email_kind_unique"')
      }
      rows.push({ email: data.email, kind: data.kind })
      return data
    },
  }
  return { store, rows, calls }
}

describe("email opt-out", () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env, JWT_SECRET: "test-secret" }
    delete process.env.BACKEND_PUBLIC_URL
    delete process.env.MEDUSA_BACKEND_URL
    delete process.env.STOREFRONT_PUBLIC_URL
    delete process.env.MEDUSA_STOREFRONT_URL
  })

  afterAll(() => {
    process.env = env
  })

  describe("signed link", () => {
    it("verifies only for the same address and kind", () => {
      const token = signEmailOptOutToken("jana@example.cz", "price_drop")
      expect(verifyEmailOptOutToken("jana@example.cz", "price_drop", token)).toBe(true)
      // Velikost písmen a mezery nehrají roli — adresa se normalizuje.
      expect(verifyEmailOptOutToken("  Jana@Example.CZ ", "price_drop", token)).toBe(true)
      // Token pro poklesy cen neodhlásí recenze ani jinou adresu.
      expect(verifyEmailOptOutToken("jana@example.cz", "review_request", token)).toBe(false)
      expect(verifyEmailOptOutToken("petr@example.cz", "price_drop", token)).toBe(false)
      expect(verifyEmailOptOutToken("jana@example.cz", "newsletter", token)).toBe(false)
      expect(verifyEmailOptOutToken("jana@example.cz", "price_drop", "")).toBe(false)
      expect(verifyEmailOptOutToken("jana@example.cz", "price_drop", undefined)).toBe(false)
    })

    it("a newsletter unsubscribe token is not an opt-out token (and vice versa)", () => {
      const newsletter = signUnsubscribeToken("jana@example.cz")
      for (const kind of EMAIL_OPTOUT_KINDS) {
        expect(verifyEmailOptOutToken("jana@example.cz", kind, newsletter)).toBe(false)
        expect(signEmailOptOutToken("jana@example.cz", kind)).not.toBe(newsletter)
      }
    })

    it("knows exactly the three kinds", () => {
      expect([...EMAIL_OPTOUT_KINDS].sort()).toEqual(["abandoned_cart", "price_drop", "review_request"])
      expect(isEmailOptOutKind("review_request")).toBe(true)
      expect(isEmailOptOutKind("newsletter")).toBe(false)
      expect(isEmailOptOutKind(undefined)).toBe(false)
    })

    it("builds an absolute backend URL, or null when the backend URL is not configured", () => {
      expect(emailOptOutUrl("jana@example.cz", "review_request")).toBeNull()

      process.env.BACKEND_PUBLIC_URL = "https://api.example.cz/"
      expect(emailOptOutUrl("", "review_request")).toBeNull()
      expect(emailOptOutUrl(null, "review_request")).toBeNull()

      const url = new URL(emailOptOutUrl("Jana+test@Example.cz", "review_request") as string)
      expect(url.origin + url.pathname).toBe("https://api.example.cz/email-optout")
      expect(url.searchParams.get("email")).toBe("jana+test@example.cz")
      expect(url.searchParams.get("kind")).toBe("review_request")
      expect(
        verifyEmailOptOutToken(
          url.searchParams.get("email") as string,
          url.searchParams.get("kind"),
          url.searchParams.get("token")
        )
      ).toBe(true)
    })
  })

  describe("who is skipped", () => {
    it("returns the normalized addresses that refused this kind only", async () => {
      const { store } = memoryStore([
        { email: "jana@example.cz", kind: "price_drop" },
        { email: "petr@example.cz", kind: "review_request" },
      ])
      const refused = await optedOutEmails(
        store,
        ["JANA@example.cz", "petr@example.cz", null, ""],
        "price_drop"
      )
      expect([...refused]).toEqual(["jana@example.cz"])
      expect(isInOptOutSet(refused, " Jana@Example.cz")).toBe(true)
      expect(isInOptOutSet(refused, "petr@example.cz")).toBe(false)
      expect(isInOptOutSet(refused, null)).toBe(false)
    })

    it("does not query at all without addresses", async () => {
      const { store, calls } = memoryStore()
      expect((await optedOutEmails(store, [null, undefined, " "], "abandoned_cart")).size).toBe(0)
      expect(calls.list).toBe(0)
    })

    it("abandoned carts of refusing addresses are not sent but count as handled", () => {
      const carts = [
        { id: "cart_1", email: "jana@example.cz" },
        { id: "cart_2", email: "Petr@Example.cz" },
        { id: "cart_3", email: null },
      ]
      const { kOdeslani, odmitnute } = rozdelPodleOdmitnuti(carts, new Set(["petr@example.cz"]))
      expect(kOdeslani.map((cart) => cart.id)).toEqual(["cart_1", "cart_3"])
      expect(odmitnute.map((cart) => cart.id)).toEqual(["cart_2"])
    })
  })

  describe("recording", () => {
    it("is idempotent — a second click (or a mail-client prefetch) changes nothing", async () => {
      const { store, rows, calls } = memoryStore()
      expect(await recordEmailOptOut(store, " Jana@Example.cz", "review_request")).toBe("created")
      expect(await recordEmailOptOut(store, "jana@example.cz", "review_request")).toBe("existing")
      expect(rows).toEqual([{ email: "jana@example.cz", kind: "review_request" }])
      expect(calls.create).toBe(1)
      // Jiný druh je samostatné odmítnutí.
      expect(await recordEmailOptOut(store, "jana@example.cz", "price_drop")).toBe("created")
    })

    it("a concurrent click hitting the unique index still ends as opted out", async () => {
      const { store, rows } = memoryStore()
      const racing: EmailOptOutStore = {
        // První čtení řádek ještě nevidí (souběžné kliknutí ho právě zapisuje).
        listEmailOptOuts: (() => {
          let first = true
          return async (filters: any) => {
            if (first) {
              first = false
              rows.push({ email: "jana@example.cz", kind: "price_drop" })
              return []
            }
            return store.listEmailOptOuts(filters)
          }
        })(),
        createEmailOptOuts: store.createEmailOptOuts,
      }
      expect(await recordEmailOptOut(racing, "jana@example.cz", "price_drop")).toBe("existing")
    })
  })

  describe("review request data", () => {
    it("carries the opt-out link for the order's address", () => {
      process.env.BACKEND_PUBLIC_URL = "https://api.example.cz"
      const data = buildReviewEmailData({ id: "order_1", display_id: 7, email: "jana@example.cz", items: [] })
      expect(String(data.unsubscribe_url)).toContain("/email-optout?email=jana%40example.cz&kind=review_request&token=")
    })
  })

  describe("GET /email-optout", () => {
    const run = async (query: Record<string, unknown>, store = memoryStore()) => {
      const errors: string[] = []
      const req: any = {
        query,
        scope: {
          resolve: (key: string) =>
            key === "emailOptOut" ? store.store : { error: (msg: string) => errors.push(msg) },
        },
      }
      const res: any = {
        statusCode: 0,
        location: "",
        body: "",
        redirect(code: number, location: string) {
          this.statusCode = code
          this.location = location
        },
        status(code: number) {
          this.statusCode = code
          return this
        },
        type() {
          return this
        },
        send(body: string) {
          this.body = body
          return this
        },
      }
      await GET(req, res)
      return { res, store, errors }
    }

    it("records the opt-out and bounces to the storefront confirmation", async () => {
      process.env.STOREFRONT_PUBLIC_URL = "https://keramickazahrada.cz"
      const token = signEmailOptOutToken("jana@example.cz", "price_drop")
      const { res, store } = await run({ email: "Jana@example.cz", kind: "price_drop", token })
      expect(res.statusCode).toBe(302)
      expect(res.location).toBe(
        "https://keramickazahrada.cz/cz/newsletter?stav=odhlaseno-upozorneni&druh=price_drop"
      )
      expect(store.rows).toEqual([{ email: "jana@example.cz", kind: "price_drop" }])

      // Druhé kliknutí: stejný výsledek, žádný druhý řádek.
      const again = await run({ email: "jana@example.cz", kind: "price_drop", token }, store)
      expect(again.res.location).toContain("stav=odhlaseno-upozorneni")
      expect(store.rows).toHaveLength(1)
    })

    it("rejects a forged or mismatched token without writing anything", async () => {
      process.env.STOREFRONT_PUBLIC_URL = "https://keramickazahrada.cz"
      const token = signEmailOptOutToken("jana@example.cz", "price_drop")
      for (const query of [
        { email: "jana@example.cz", kind: "review_request", token },
        { email: "petr@example.cz", kind: "price_drop", token },
        { email: "jana@example.cz", kind: "newsletter", token },
        { email: "jana@example.cz", kind: "price_drop", token: "x".repeat(32) },
      ]) {
        const { res, store } = await run(query)
        expect(res.location).toBe("https://keramickazahrada.cz/cz/newsletter?stav=neplatny-odkaz")
        expect(store.rows).toHaveLength(0)
      }
    })

    it("answers in Czech without a configured storefront", async () => {
      const token = signEmailOptOutToken("jana@example.cz", "review_request")
      const { res } = await run({ email: "jana@example.cz", kind: "review_request", token })
      expect(res.statusCode).toBe(200)
      expect(res.body).toBe("Hotovo — prosby o hodnocení nákupu vám už posílat nebudeme.")
    })
  })
})
