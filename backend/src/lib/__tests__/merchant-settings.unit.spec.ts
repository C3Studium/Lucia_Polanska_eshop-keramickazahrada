import { Modules } from "@medusajs/framework/utils"
import { LEGAL_FACT_DEFAULTS } from "../legal-facts"
import {
  applyMerchantSettingsPatch,
  buildStoreMetadata,
  getLegalFacts,
  MERCHANT_SETTINGS_DEFAULTS,
  MERCHANT_SETTINGS_METADATA_KEY,
  MERCHANT_SETTING_KEYS,
  parseMerchantSettings,
} from "../merchant-settings"

describe("merchant settings allowlist", () => {
  it("exposes exactly the keys A3 permits — the list is closed", () => {
    expect([...MERCHANT_SETTING_KEYS].sort()).toEqual([
      "announcement_enabled",
      "announcement_link",
      "announcement_text",
      "company_purchase_enabled",
      "daily_digest_enabled",
      "default_parcel_weight_kg",
      "dev_notification_email",
      "dobirka_fee_czk",
      "legal_facts",
      "legal_facts_updated_at",
      "low_stock_default_threshold",
      "onboarding_dismissals",
      "owner_notification_email",
      "production_started_email_enabled",
      "return_address",
      "return_instructions",
      "review_request_days",
      "test_mode_enabled",
      "vacation_enabled",
      "vacation_message",
      "vacation_until",
    ])
  })

  it("rejects an unknown key on write", () => {
    expect(() =>
      applyMerchantSettingsPatch(MERCHANT_SETTINGS_DEFAULTS, {
        // The whole point of A3: a typo or a smuggled-in key must not persist.
        shipped_orders: 12,
      } as never)
    ).toThrow(/shipped_orders|Allowed keys/)
  })

  it("rejects an out-of-range value on write", () => {
    expect(() =>
      applyMerchantSettingsPatch(MERCHANT_SETTINGS_DEFAULTS, {
        review_request_days: 0,
      })
    ).toThrow()

    expect(() =>
      applyMerchantSettingsPatch(MERCHANT_SETTINGS_DEFAULTS, {
        default_parcel_weight_kg: -1,
      })
    ).toThrow()
  })
})

describe("parseMerchantSettings", () => {
  it("returns the seeded defaults when nothing is stored", () => {
    expect(parseMerchantSettings(undefined)).toEqual(MERCHANT_SETTINGS_DEFAULTS)
    expect(parseMerchantSettings(null)).toEqual(MERCHANT_SETTINGS_DEFAULTS)
    expect(parseMerchantSettings({})).toEqual(MERCHANT_SETTINGS_DEFAULTS)
  })

  it("keeps stored values and fills the rest from defaults", () => {
    const settings = parseMerchantSettings({
      low_stock_default_threshold: 5,
      onboarding_dismissals: { prehled: true },
    })

    expect(settings.low_stock_default_threshold).toBe(5)
    expect(settings.onboarding_dismissals).toEqual({ prehled: true })
    expect(settings.review_request_days).toBe(
      MERCHANT_SETTINGS_DEFAULTS.review_request_days
    )
  })

  it("drops unknown and invalid values instead of failing the read", () => {
    const ignored: string[] = []

    const settings = parseMerchantSettings(
      {
        low_stock_default_threshold: "tři",
        daily_digest_enabled: true,
        smuggled_key: "nope",
      },
      (key) => ignored.push(key)
    )

    // A corrupted value must never take the shop down — it falls back.
    expect(settings.low_stock_default_threshold).toBe(
      MERCHANT_SETTINGS_DEFAULTS.low_stock_default_threshold
    )
    expect(settings.daily_digest_enabled).toBe(true)
    expect(settings).not.toHaveProperty("smuggled_key")
    expect(ignored.sort()).toEqual(["low_stock_default_threshold", "smuggled_key"])
  })

  it("does not share the default dismissals object between reads", () => {
    const first = parseMerchantSettings({})
    first.onboarding_dismissals.prehled = true

    expect(parseMerchantSettings({}).onboarding_dismissals).toEqual({})
  })
})

describe("write/read round-trip", () => {
  it("survives the exact metadata shape that gets persisted", () => {
    const stored = applyMerchantSettingsPatch(
      parseMerchantSettings(undefined),
      { low_stock_default_threshold: 2, production_started_email_enabled: true }
    )

    const metadata = buildStoreMetadata(
      { some_other_owner: "left alone" },
      stored
    )

    expect(metadata.some_other_owner).toBe("left alone")

    const readBack = parseMerchantSettings(
      metadata[MERCHANT_SETTINGS_METADATA_KEY]
    )

    expect(readBack).toEqual(stored)
    expect(readBack.low_stock_default_threshold).toBe(2)
    expect(readBack.production_started_email_enabled).toBe(true)
    expect(readBack.daily_digest_enabled).toBe(
      MERCHANT_SETTINGS_DEFAULTS.daily_digest_enabled
    )
  })

  it("applies patches cumulatively across writes", () => {
    let settings = parseMerchantSettings(undefined)
    settings = applyMerchantSettingsPatch(settings, { review_request_days: 14 })
    settings = applyMerchantSettingsPatch(settings, {
      onboarding_dismissals: { "denni-prace": true },
    })

    const readBack = parseMerchantSettings(
      buildStoreMetadata(null, settings)[MERCHANT_SETTINGS_METADATA_KEY]
    )

    expect(readBack.review_request_days).toBe(14)
    expect(readBack.onboarding_dismissals).toEqual({ "denni-prace": true })
  })
})

describe("legal_facts (Právní údaje)", () => {
  const NOW = new Date("2026-10-15T10:00:00.000Z")

  it("defaults to nothing stored and never shares the default object", () => {
    expect(MERCHANT_SETTINGS_DEFAULTS.legal_facts).toEqual({})
    expect(MERCHANT_SETTINGS_DEFAULTS.legal_facts_updated_at).toBe("")
    const first = parseMerchantSettings({})
    first.legal_facts["mto.deposit"] = "40 %"
    expect(parseMerchantSettings({}).legal_facts).toEqual({})
  })

  it("stores trimmed text, keeps '' as explicitly empty and stamps the change", () => {
    const next = applyMerchantSettingsPatch(
      MERCHANT_SETTINGS_DEFAULTS,
      { legal_facts: { "mto.deposit": " 40 % ", "seller.phone": "" } },
      NOW
    )
    expect(next.legal_facts).toEqual({ "mto.deposit": "40 %", "seller.phone": "" })
    expect(next.legal_facts_updated_at).toBe("2026-10-15T10:00:00.000Z")
  })

  it("merges per fact — a partial write keeps the other facts", () => {
    let settings = applyMerchantSettingsPatch(
      MERCHANT_SETTINGS_DEFAULTS,
      { legal_facts: { "mto.deposit": "40 %", "course.minAge": "6 let" } },
      NOW
    )
    settings = applyMerchantSettingsPatch(settings, {
      legal_facts: { "course.minAge": "8 let" },
    })
    expect(settings.legal_facts).toEqual({ "mto.deposit": "40 %", "course.minAge": "8 let" })
  })

  it("does not move the timestamp when nothing effectively changed", () => {
    const saved = applyMerchantSettingsPatch(
      MERCHANT_SETTINGS_DEFAULTS,
      { legal_facts: { "mto.deposit": "40 %" } },
      NOW
    )
    const later = new Date("2026-10-16T08:00:00.000Z")
    // Stejná hodnota, i výchozí identita uložená výslovně = žádná změna.
    const again = applyMerchantSettingsPatch(
      saved,
      { legal_facts: { "mto.deposit": "40 %", "seller.name": "Lucie Polanská" } },
      later
    )
    expect(again.legal_facts_updated_at).toBe("2026-10-15T10:00:00.000Z")
    // Jiný klíč než právní údaje časem nehne.
    const other = applyMerchantSettingsPatch(saved, { review_request_days: 9 }, later)
    expect(other.legal_facts_updated_at).toBe("2026-10-15T10:00:00.000Z")
  })

  it("rejects an unknown fact, a too long or malformed value, and a client timestamp", () => {
    expect(() =>
      applyMerchantSettingsPatch(MERCHANT_SETTINGS_DEFAULTS, {
        legal_facts: { "seller.iban": "CZ00" } as never,
      })
    ).toThrow(/seller\.iban|Unrecognized/)
    expect(() =>
      applyMerchantSettingsPatch(MERCHANT_SETTINGS_DEFAULTS, {
        legal_facts: { "mto.deposit": "x".repeat(61) },
      })
    ).toThrow(/nejvýš 60 znaků/)
    expect(() =>
      applyMerchantSettingsPatch(MERCHANT_SETTINGS_DEFAULTS, {
        legal_facts: { "seller.email": "bez zavináče" },
      })
    ).toThrow(/e-mailová adresa/)
    expect(() =>
      applyMerchantSettingsPatch(MERCHANT_SETTINGS_DEFAULTS, {
        legal_facts: { "seller.phone": 775211578 as never },
      })
    ).toThrow()
    // Čas změny píše server — formulář ho podstrčit nesmí.
    expect(() =>
      applyMerchantSettingsPatch(MERCHANT_SETTINGS_DEFAULTS, {
        legal_facts_updated_at: "2020-01-01T00:00:00.000Z",
      } as never)
    ).toThrow(/legal_facts_updated_at|Unrecognized/)
  })

  it("reads a damaged stored object without losing the good facts", () => {
    const ignored: string[] = []
    const settings = parseMerchantSettings(
      {
        legal_facts: {
          "mto.deposit": "40 %",
          // Delší než dnešní limit (např. po zpřísnění) — zůstává, jak byl uložen.
          "course.minAge": "x".repeat(200),
          "seller.phone": 12,
          smuggled: "x",
        },
        legal_facts_updated_at: "včera",
      },
      (key) => ignored.push(key)
    )
    expect(settings.legal_facts).toEqual({
      "mto.deposit": "40 %",
      "course.minAge": "x".repeat(200),
    })
    expect(settings.legal_facts_updated_at).toBe("")
    expect(ignored).toEqual(["legal_facts_updated_at"])

    // Úplně rozbitá hodnota → nic uloženého, tedy výchozí údaje.
    expect(parseMerchantSettings({ legal_facts: "nesmysl" }).legal_facts).toEqual({})
  })

  it("survives the persisted metadata round-trip", () => {
    const stored = applyMerchantSettingsPatch(
      parseMerchantSettings(undefined),
      { legal_facts: { "bank.account": "2500675505/2010" } },
      NOW
    )
    const readBack = parseMerchantSettings(
      buildStoreMetadata({}, stored)[MERCHANT_SETTINGS_METADATA_KEY]
    )
    expect(readBack.legal_facts).toEqual({ "bank.account": "2500675505/2010" })
    expect(readBack.legal_facts_updated_at).toBe("2026-10-15T10:00:00.000Z")
  })
})

describe("getLegalFacts", () => {
  const logger = { warn: jest.fn(), info: jest.fn(), error: jest.fn() }
  const containerWith = (listStores: () => Promise<unknown[]>) =>
    ({
      resolve: (key: string) => {
        if (key === Modules.STORE) return { listStores }
        if (key === "logger") return logger
        throw new Error(`Could not resolve '${key}'`)
      },
    }) as any

  beforeEach(() => jest.clearAllMocks())

  it("resolves the stored facts over the defaults", async () => {
    const snapshot = await getLegalFacts(
      containerWith(async () => [
        {
          id: "store_1",
          metadata: {
            [MERCHANT_SETTINGS_METADATA_KEY]: {
              legal_facts: { "mto.deposit": "40 %", "seller.phone": "" },
              legal_facts_updated_at: "2026-10-15T10:00:00.000Z",
            },
          },
        },
      ])
    )
    expect(snapshot.source).toBe("settings")
    expect(snapshot.updated_at).toBe("2026-10-15T10:00:00.000Z")
    expect(snapshot.facts["mto.deposit"]).toBe("40 %")
    expect(snapshot.facts["seller.phone"]).toBeNull()
    expect(snapshot.facts["seller.name"]).toBe("Lucie Polanská")
  })

  it("never throws — unreadable settings give the defaults", async () => {
    const snapshot = await getLegalFacts(
      containerWith(async () => {
        throw new Error("connection terminated")
      })
    )
    expect(snapshot).toEqual({ facts: LEGAL_FACT_DEFAULTS, updated_at: null, source: "defaults" })
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("connection terminated"))

    // Ani bez loggeru (kontejner bez ničeho) nespadne.
    const bare = await getLegalFacts({ resolve: () => { throw new Error("nic") } } as any)
    expect(bare.source).toBe("defaults")
  })
})
