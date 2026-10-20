import { Modules } from "@medusajs/framework/utils"
import { LEGAL_FACT_DEFAULTS, LEGAL_FACT_KEYS } from "../../../../../lib/legal-facts"
import { MERCHANT_SETTINGS_METADATA_KEY } from "../../../../../lib/merchant-settings"
import { GET } from "../route"

/**
 * GET /store/legal/facts — to, co web dosazuje do obchodních podmínek. Musí
 * odpovědět vždy (poškozená hodnota v nastavení = výchozí údaj, ne 500)
 * a nesmí poslat nic, co v podmínkách na webu není.
 */

const logger = { warn: jest.fn(), info: jest.fn(), error: jest.fn() }

const requestWith = (listStores: () => Promise<unknown[]>) =>
  ({
    scope: {
      resolve: (key: string) => {
        if (key === Modules.STORE) return { listStores }
        if (key === "logger") return logger
        throw new Error(`Could not resolve '${key}'`)
      },
    },
  }) as any

const storeWith = (settings: unknown) => async () => [
  { id: "store_1", metadata: { [MERCHANT_SETTINGS_METADATA_KEY]: settings, other: "x" } },
]

const response = () => {
  const res: any = { headers: {} as Record<string, string> }
  res.setHeader = jest.fn((name: string, value: string) => {
    res.headers[name] = value
    return res
  })
  res.status = jest.fn((code: number) => {
    res.statusCode = code
    return res
  })
  res.json = jest.fn((body: unknown) => {
    res.body = body
    return res
  })
  return res
}

describe("GET /store/legal/facts", () => {
  beforeEach(() => jest.clearAllMocks())

  it("returns every fact (stored over defaults) with a one-minute public cache", async () => {
    const res = response()
    await GET(
      requestWith(
        storeWith({
          legal_facts: { "mto.deposit": "40 %", "seller.phone": "" },
          legal_facts_updated_at: "2026-10-15T10:00:00.000Z",
          // Ostatní nastavení obchodu do odpovědi nepatří.
          owner_notification_email: "lucie@example.cz",
        })
      ),
      res
    )

    expect(res.statusCode).toBe(200)
    expect(res.headers["Cache-Control"]).toBe("public, max-age=60")
    expect(Object.keys(res.body)).toEqual(["facts", "updated_at"])
    expect(Object.keys(res.body.facts)).toEqual([...LEGAL_FACT_KEYS])
    expect(res.body.facts["mto.deposit"]).toBe("40 %")
    expect(res.body.facts["seller.phone"]).toBeNull()
    expect(res.body.facts["seller.name"]).toBe("Lucie Polanská")
    expect(res.body.updated_at).toBe("2026-10-15T10:00:00.000Z")
    expect(JSON.stringify(res.body)).not.toContain("lucie@example.cz")
  })

  it("never saved = defaults and no timestamp", async () => {
    const res = response()
    await GET(requestWith(storeWith(undefined)), res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ facts: LEGAL_FACT_DEFAULTS, updated_at: null })
  })

  it("a corrupted stored value falls back instead of failing", async () => {
    const res = response()
    await GET(
      requestWith(
        storeWith({
          legal_facts: { "mto.deposit": "40 %", "bank.account": { iban: "CZ" } },
          legal_facts_updated_at: 42,
        })
      ),
      res
    )
    expect(res.statusCode).toBe(200)
    expect(res.body.facts["mto.deposit"]).toBe("40 %")
    expect(res.body.facts["bank.account"]).toBeNull()
    expect(res.body.updated_at).toBeNull()

    const broken = response()
    await GET(requestWith(storeWith("nesmysl")), broken)
    expect(broken.statusCode).toBe(200)
    expect(broken.body.facts).toEqual(LEGAL_FACT_DEFAULTS)
  })

  it("unreadable settings: 503 without cache, still with the defaults", async () => {
    const res = response()
    await GET(
      requestWith(async () => {
        throw new Error("connection terminated")
      }),
      res
    )
    expect(res.statusCode).toBe(503)
    expect(res.headers["Cache-Control"]).toBe("no-store")
    expect(res.body.facts).toEqual(LEGAL_FACT_DEFAULTS)
    expect(res.body.updated_at).toBeNull()
  })
})
