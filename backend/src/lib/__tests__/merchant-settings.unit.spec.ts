import {
  applyMerchantSettingsPatch,
  buildStoreMetadata,
  MERCHANT_SETTINGS_DEFAULTS,
  MERCHANT_SETTINGS_METADATA_KEY,
  MERCHANT_SETTING_KEYS,
  parseMerchantSettings,
} from "../merchant-settings"

describe("merchant settings allowlist", () => {
  it("exposes exactly the six keys A3 permits", () => {
    expect([...MERCHANT_SETTING_KEYS].sort()).toEqual([
      "daily_digest_enabled",
      "default_parcel_weight_kg",
      "low_stock_default_threshold",
      "onboarding_dismissals",
      "production_started_email_enabled",
      "review_request_days",
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
