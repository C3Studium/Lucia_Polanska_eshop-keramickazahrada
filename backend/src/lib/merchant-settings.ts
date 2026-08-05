/**
 * Merchant settings — the single typed accessor (WorkflowPlan.md A3).
 *
 * ## What this is for
 *
 * A handful of shop-global preferences that no Medusa module owns: the low-stock
 * threshold she wants to be warned at, the default parcel weight, how long after
 * shipping we ask for a review, two e-mail toggles, and which one-time helper
 * cards she has dismissed. Six keys, listed in A3, and that list is closed.
 *
 * ## Prohibited content (A3)
 *
 * Never store here: workflow truth, per-order or per-entity state, caches, or
 * anything the commerce modules own. If a value belongs to an order, a product
 * or an inventory item, it belongs on that record — not in this bag.
 *
 * ## Storage decision — evaluated in P1-1, no migration needed
 *
 * A3 requires evaluating `store.metadata` before creating a table. It works, so
 * there is no `merchant-settings` module and the plan's only migration is gone:
 *
 * - `store.metadata` exists as a nullable JSON column
 *   (`@medusajs/store/dist/models/store.js:16`) and is writable through the
 *   native `updateStoresWorkflow` — no direct module writes, no SQL.
 * - Nothing else in this repo writes `store.metadata`, so the sub-key
 *   `merchant_settings` cannot collide.
 * - Every consumer (subscribers, jobs, API routes) already has a container, so
 *   reads are available everywhere they are needed.
 *
 * Known trade-offs, none of them a blocker:
 *
 * - A write replaces the whole `metadata` object, so `setMerchantSettings`
 *   re-reads and merges. With one merchant writing settings by hand this is
 *   safe; a concurrent writer to a *different* metadata key could in principle
 *   lose its change.
 * - Each read is one query against a single-row table. Settings are consumed by
 *   daily jobs and page loads, not in hot loops, so no cache is introduced —
 *   and A3 forbids caches in here anyway.
 *
 * If a future requirement genuinely breaks this (per-user settings, high write
 * frequency, values too large for a JSON column), that is the "concrete
 * blocker" A3 asks for: build `src/modules/merchant-settings/` with its one
 * table and re-point the four functions below. Call sites never learn where the
 * values live, so nothing else changes.
 */

import { z } from "@medusajs/framework/zod"
import type { IStoreModuleService, MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { updateStoresWorkflow } from "@medusajs/medusa/core-flows"

/** Sub-key of `store.metadata` that holds the whole settings object. */
export const MERCHANT_SETTINGS_METADATA_KEY = "merchant_settings"

/**
 * The closed allowlist (A3). Adding a setting means editing this object — and
 * nothing else. Unknown keys are rejected on write and dropped on read.
 */
const KEY_SCHEMAS = {
  /** „Dochází" warning fires at or below this available quantity (§10). */
  low_stock_default_threshold: z.number().int().min(0).max(10_000),
  /** Used when a product has no weight of its own (D2). */
  default_parcel_weight_kg: z.number().positive().max(50),
  /** Days after shipping before the review request is sent (§12). */
  review_request_days: z.number().int().min(1).max(365),
  /** „Výroba začala" customer e-mail — default off on purpose (§16 #7). */
  production_started_email_enabled: z.boolean(),
  /** The 07:05 summary to both notification addresses (D7). */
  daily_digest_enabled: z.boolean(),
  /** Dismissed first-use helper cards, keyed by page (§19). Shop-global. */
  onboarding_dismissals: z.record(z.string(), z.boolean()),
  /**
   * Dovolená — the shop says so instead of going silent. The storefront
   * shows the banner; the backend REFUSES new commission payments while on
   * (prepare-made-to-order-payment), because a pause the server does not
   * enforce is a pause that ends the first time a browser misbehaves.
   */
  vacation_enabled: z.boolean(),
  /** ISO date (yyyy-mm-dd) she expects to be back; shown to customers. */
  vacation_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
  /** Her own words for the banner; empty falls back to a sensible default. */
  vacation_message: z.string().max(300),
  /** Oznámení — an event banner atop the storefront („v sobotu na trhu…"). */
  announcement_enabled: z.boolean(),
  announcement_text: z.string().max(300),
} as const

/** Full settings object — every key present, defaults filled in. */
export const merchantSettingsSchema = z.strictObject(KEY_SCHEMAS)

/** A partial update. Strict, so an unknown key is an error, not a silent no-op. */
export const merchantSettingsPatchSchema = z.strictObject(KEY_SCHEMAS).partial()

export type MerchantSettings = z.infer<typeof merchantSettingsSchema>
export type MerchantSettingKey = keyof MerchantSettings
export type MerchantSettingsPatch = Partial<MerchantSettings>

export const MERCHANT_SETTING_KEYS = Object.keys(KEY_SCHEMAS) as MerchantSettingKey[]

export const MERCHANT_SETTINGS_DEFAULTS: MerchantSettings = {
  vacation_enabled: false,
  vacation_until: "",
  vacation_message: "",
  announcement_enabled: false,
  announcement_text: "",
  low_stock_default_threshold: 3,
  default_parcel_weight_kg: 2.5,
  review_request_days: 10,
  production_started_email_enabled: false,
  daily_digest_enabled: true,
  onboarding_dismissals: {},
}

/**
 * Turns whatever is stored into a complete, valid settings object.
 *
 * Deliberately forgiving: a single corrupted value falls back to its default
 * instead of taking the whole shop down. Unknown keys are dropped. `onInvalid`
 * lets the caller log what was ignored without making this function impure.
 */
export const parseMerchantSettings = (
  raw: unknown,
  onInvalid?: (key: string, reason: string) => void
): MerchantSettings => {
  const settings: MerchantSettings = {
    ...MERCHANT_SETTINGS_DEFAULTS,
    onboarding_dismissals: { ...MERCHANT_SETTINGS_DEFAULTS.onboarding_dismissals },
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    if (raw !== undefined && raw !== null) {
      onInvalid?.(MERCHANT_SETTINGS_METADATA_KEY, "not an object")
    }
    return settings
  }

  const source = raw as Record<string, unknown>

  for (const key of Object.keys(source)) {
    if (!(key in KEY_SCHEMAS)) {
      onInvalid?.(key, "not in the allowlist")
      continue
    }

    const typedKey = key as MerchantSettingKey
    const parsed = KEY_SCHEMAS[typedKey].safeParse(source[key])

    if (!parsed.success) {
      onInvalid?.(key, parsed.error.issues[0]?.message ?? "invalid value")
      continue
    }

    // Each key's schema output matches its own slot; TypeScript cannot see that
    // through the dynamic key, hence the assignment through a narrowed alias.
    ;(settings as Record<string, unknown>)[typedKey] = parsed.data
  }

  return settings
}

/**
 * Validates a patch against the allowlist and merges it onto current settings.
 * Throws on an unknown key or an invalid value — those are programming errors,
 * not user input.
 */
export const applyMerchantSettingsPatch = (
  current: MerchantSettings,
  patch: MerchantSettingsPatch
): MerchantSettings => {
  const parsed = merchantSettingsPatchSchema.safeParse(patch)

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ")

    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Invalid merchant settings patch — ${detail}. Allowed keys: ${MERCHANT_SETTING_KEYS.join(", ")}.`
    )
  }

  return { ...current, ...parsed.data }
}

/**
 * Builds the `metadata` object to write back, preserving every other key that
 * happens to live on the store. Exported so the write path is unit-testable
 * without a database.
 */
export const buildStoreMetadata = (
  existingMetadata: Record<string, unknown> | null | undefined,
  settings: MerchantSettings
): Record<string, unknown> => ({
  ...(existingMetadata ?? {}),
  [MERCHANT_SETTINGS_METADATA_KEY]: settings,
})

const loadStore = async (container: MedusaContainer) => {
  const storeService = container.resolve<IStoreModuleService>(Modules.STORE)
  const [store] = await storeService.listStores(
    {},
    { take: 1, order: { created_at: "ASC" } }
  )

  if (!store) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No store found — merchant settings are stored on the store record."
    )
  }

  return store
}

/** Reads the effective settings: stored values merged over the defaults. */
export const getMerchantSettings = async (
  container: MedusaContainer
): Promise<MerchantSettings> => {
  const store = await loadStore(container)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  return parseMerchantSettings(
    (store.metadata as Record<string, unknown> | null)?.[
      MERCHANT_SETTINGS_METADATA_KEY
    ],
    (key, reason) =>
      logger.warn(
        `Ignoring merchant setting "${key}" (${reason}); using the default instead.`
      )
  )
}

/** Reads one setting. Same cost as reading all of them. */
export const getMerchantSetting = async <K extends MerchantSettingKey>(
  container: MedusaContainer,
  key: K
): Promise<MerchantSettings[K]> => {
  const settings = await getMerchantSettings(container)
  return settings[key]
}

/**
 * Writes a partial update through the native `updateStoresWorkflow` and returns
 * the full settings object as it now stands.
 */
export const setMerchantSettings = async (
  container: MedusaContainer,
  patch: MerchantSettingsPatch
): Promise<MerchantSettings> => {
  const store = await loadStore(container)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const current = parseMerchantSettings(
    (store.metadata as Record<string, unknown> | null)?.[
      MERCHANT_SETTINGS_METADATA_KEY
    ],
    (key, reason) =>
      logger.warn(
        `Dropping merchant setting "${key}" while saving (${reason}).`
      )
  )

  const next = applyMerchantSettingsPatch(current, patch)

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        metadata: buildStoreMetadata(
          store.metadata as Record<string, unknown> | null,
          next
        ),
      },
    },
  })

  return next
}
