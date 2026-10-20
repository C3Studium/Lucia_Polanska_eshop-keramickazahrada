/**
 * Merchant settings — the single typed accessor (WorkflowPlan.md A3).
 *
 * ## What this is for
 *
 * A handful of shop-global preferences that no Medusa module owns: the low-stock
 * threshold she wants to be warned at, the default parcel weight, how long after
 * shipping we ask for a review, e-mail toggles and addresses, dovolená and
 * oznámení, doběrečné, zkušební režim, the return address, the legal facts
 * („Právní údaje") and which one-time helper cards she has dismissed. The list
 * is `KEY_SCHEMAS` below and it is closed: a new key is a deliberate edit there,
 * never something a caller can invent at runtime.
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
import {
  LEGAL_FACT_KEYS,
  legalFactProblem,
  pickStoredLegalFacts,
  resolveLegalFacts,
  sameLegalFacts,
  type LegalFactKey,
  type LegalFactValues,
  type StoredLegalFacts,
} from "./legal-facts"

/** Sub-key of `store.metadata` that holds the whole settings object. */
export const MERCHANT_SETTINGS_METADATA_KEY = "merchant_settings"

/**
 * Právní údaje při zápisu: jen známé klíče (strict — překlep v klíči je
 * chyba, ne tichý nový údaj), každý text nejvýš `maxLength` znaků a ve tvaru
 * z `LEGAL_FACT_META` (e-mail, odkaz). Ořízne se; `""` = výslovně nevyplněno.
 */
const legalFactsWriteSchema = z.strictObject(
  Object.fromEntries(
    LEGAL_FACT_KEYS.map((key) => [
      key,
      z
        .string()
        .trim()
        .superRefine((value, ctx) => {
          const problem = legalFactProblem(key, value)
          if (problem) ctx.addIssue({ code: "custom", message: problem })
        })
        .optional(),
    ])
  ) as Record<LegalFactKey, z.ZodOptional<z.ZodString>>
)

/** ISO okamžik, nebo `""` (údaje se ještě nikdy neuložily). */
const isoInstantOrEmpty = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/)
  .or(z.literal(""))

/**
 * The closed allowlist (A3). Adding a setting means editing this object — and
 * nothing else. Unknown keys are rejected on write and dropped on read.
 */
const KEY_SCHEMAS = {
  /** „Dochází" warning fires at or below this available quantity (§10). */
  low_stock_default_threshold: z.number().int().min(0).max(10_000),
  /** Used when a product has no weight of its own (D2). */
  default_parcel_weight_kg: z.number().positive().max(50),
  /** Days after the parcel was received before the review request is sent (§12, sledovani-zasilek.md §6). */
  review_request_days: z.number().int().min(1).max(365),
  /** „Výroba začala" customer e-mail — default off on purpose (§16 #7). */
  production_started_email_enabled: z.boolean(),
  /** The 07:05 summary to both notification addresses (D7). */
  daily_digest_enabled: z.boolean(),
  /** Dismissed first-use helper cards, keyed by page (§19). Shop-global. */
  onboarding_dismissals: z.record(z.string(), z.boolean()),
  /**
   * Dovolená — obchod to řekne, místo aby ztichl. JEN UPOZORNĚNÍ: objednávky
   * i zakázky jdou dál, zákazník se dozví, že je vyřídí po návratu (rozhodnutí
   * 14. 10. 2026 — dřív platba zakázky padala na „Výroba má přestávku", i dva
   * měsíce po návratu, protože přepínač nikdo nevypnul). Aktivní je jen do
   * data návratu — viz `isVacationActive`.
   */
  vacation_enabled: z.boolean(),
  /** ISO date (yyyy-mm-dd) she expects to be back; shown to customers. */
  vacation_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
  /** Her own words for the banner; empty falls back to a sensible default. */
  vacation_message: z.string().max(300),
  /**
   * Nákup na firmu — smí zákazník v pokladně vyplnit firemní údaje?
   *
   * Vypnutí schová volbu v obchodě, nic víc. Objednávky, které tak už vznikly,
   * zůstávají i s firemními údaji: jsou na vystavené faktuře a zmizet z dohledu
   * nesmí jen proto, že se od zítřka na firmu prodávat nebude.
   */
  company_purchase_enabled: z.boolean(),
  /**
   * Zkušební režim — obchod běží nanečisto.
   *
   * Zapnuto znamená dvě věci naráz:
   *
   * - **iDoklad nevystavuje faktury.** Zkušební objednávka nemá co dělat
   *   v účetnictví — číselná řada je jednosměrná a vytržené číslo se nevrací.
   *   Tohle je jediná polovina, kterou přepínač opravdu ovládá za běhu.
   * - **ComGate má běžet nanečisto.** Tady je přepínač jen záznam rozhodnutí,
   *   ne vypínač: platební poskytovatel dostává `test` z konfigurace při
   *   startu a k nastavení obchodu se za běhu nedostane (žije ve vlastním
   *   kontejneru modulu, kde není modul obchodu). Ostrý provoz se přepíná
   *   proměnnou `COMGATE_TEST` — stránka Zkušební režim to říká nahlas
   *   a ukazuje, co je právě nastavené.
   *
   * Vypnuto je výchozí schválně: kdyby se výchozí hodnotou zapínal zkušební
   * režim, obchod, kterému nikdo nastavení neuložil, by tiše nefakturoval.
   */
  test_mode_enabled: z.boolean(),
  /**
   * Doběrečné — příplatek za platbu na dobírku, v korunách.
   *
   * Účtuje se jako samostatná položka košíku ve chvíli, kdy si zákazník
   * zvolí dobírku (`lib/dobirka-fee.ts`), a s jiným způsobem platby zase
   * zmizí. Nula znamená „dobírka bez příplatku" — položka se pak nepřidává.
   */
  dobirka_fee_czk: z.number().min(0).max(2000),
  /** Oznámení — an event banner atop the storefront („v sobotu na trhu…"). */
  announcement_enabled: z.boolean(),
  announcement_text: z.string().max(300),
  /** Where the announcement's button leads — mapa, událost, článek. */
  announcement_link: z.string().url().or(z.literal("")),
  /**
   * Kam chodí provozní e-maily OBCHODU (majitelce/klientce) — nová objednávka,
   * zakázka, doplatek, štítek, denní souhrn. Prázdné = spadne na env
   * `OWNER_NOTIFICATION_EMAIL`, aby se nic nerozbilo, než se nastaví v adminu.
   */
  owner_notification_email: z.string().email().or(z.literal("")),
  /**
   * Kam chodí VÝVOJÁŘSKÉ e-maily o obchodu (nezdařené e-maily, chyby dopravce,
   * technické hlídky). Prázdné = spadne na env `DEV_NOTIFICATION_EMAIL`.
   */
  dev_notification_email: z.string().email().or(z.literal("")),
  /**
   * Adresa, kam zákazník posílá zboží zpět (reklamace, vrácení, odstoupení).
   * Víceřádkový text; jde do e-mailu „schváleno" i na stránku stavu žádosti.
   * Nahrazuje tři natvrdo zapsané „Putim 229" (docs/reklamace-a-zruseni.md §5).
   */
  return_address: z.string().max(500),
  /**
   * Pokyny k vrácení („zabalte pečlivě, přiložte číslo objednávky"). Volitelné;
   * prázdné = e-mail i stránka pokyny vynechají.
   */
  return_instructions: z.string().max(1000),
  /**
   * Právní údaje („Právní údaje" v administraci) — fakta `{{klíč}}` do
   * obchodních podmínek, poučení, zásad, pokladny a e-mailů
   * (`lib/legal-facts.ts`). Uložené jsou jen vyplněné klíče: chybějící klíč
   * = výchozí hodnota z kódu, `""` = výslovně nevyplněno (na webu
   * `[[DOPLNIT]]`). Zápis se do uloženého objektu slučuje po klíčích, takže
   * částečný zápis neshodí ostatní údaje.
   */
  legal_facts: legalFactsWriteSchema,
  /**
   * Kdy se právní údaje naposledy opravdu změnily (ISO). Zapisuje ho server
   * při uložení `legal_facts` — formulář ho poslat nemůže (patch ho odmítne),
   * a uložení beze změny ho neposune.
   */
  legal_facts_updated_at: isoInstantOrEmpty,
} as const

/**
 * Klíče, u kterých je čtení shovívavější než zápis. U `legal_facts` by jeden
 * poškozený údaj (nebo údaj delší, než dovolí pozdější zpřísnění limitu)
 * jinak shodil celý objekt — a s ním všechny údaje na webu i v e-mailech.
 * Čtení proto nechá každý známý textový údaj, jak je, a zahodí jen zbytek.
 */
const READ_SCHEMAS: { legal_facts: z.ZodType<StoredLegalFacts> } = {
  legal_facts: z.record(z.string(), z.unknown()).transform(pickStoredLegalFacts),
}

/** Keys only the server writes — a patch that sends them is rejected. */
const SERVER_OWNED_KEYS = { legal_facts_updated_at: true } as const

/** Full settings object — every key present, defaults filled in. */
export const merchantSettingsSchema = z.strictObject(KEY_SCHEMAS)

/** A partial update. Strict, so an unknown key is an error, not a silent no-op. */
export const merchantSettingsPatchSchema = z
  .strictObject(KEY_SCHEMAS)
  .omit(SERVER_OWNED_KEYS)
  .partial()

export type MerchantSettings = z.infer<typeof merchantSettingsSchema>
export type MerchantSettingKey = keyof MerchantSettings
export type MerchantSettingsPatch = Partial<
  Omit<MerchantSettings, keyof typeof SERVER_OWNED_KEYS>
>

export const MERCHANT_SETTING_KEYS = Object.keys(KEY_SCHEMAS) as MerchantSettingKey[]

export const MERCHANT_SETTINGS_DEFAULTS: MerchantSettings = {
  vacation_enabled: false,
  vacation_until: "",
  vacation_message: "",
  announcement_enabled: false,
  announcement_text: "",
  announcement_link: "",
  /* Prázdné: dokud klientka nevyplní, berou se adresy z env (zpětně kompatibilní). */
  owner_notification_email: "",
  dev_notification_email: "",
  /* Adresa pro vrácení zboží. Adresát je prodávající (podnikatelka
     Lucie Polanská, ne název obchodu) — stejně jako v poučení o odstoupení
     (NV 29/2023 Sb., pokyn [6] a) 2.) a v OP. */
  return_address: "Lucie Polanská\nPutim 229\n397 01 Písek",
  return_instructions: "",
  /* Zapnuto: firemní nákup je běžná věc a vypínač je tu pro případ, že ho
     nebude chtít, ne naopak. */
  company_purchase_enabled: true,
  /* Vypnuto: obchod, kterému nikdo nastavení neuložil, musí fakturovat. */
  test_mode_enabled: false,
  /* 39 Kč — částka dohodnutá při zavedení dobírky; v administraci jde změnit. */
  dobirka_fee_czk: 39,
  low_stock_default_threshold: 3,
  default_parcel_weight_kg: 2.5,
  /* Týden od PŘEVZETÍ (sledování zásilek ČP zná den doručení), ne od
     odeslání — proto 7, dřív 10 „ať balík stihne dojít". Viz
     docs/sledovani-zasilek.md §6. */
  review_request_days: 7,
  production_started_email_enabled: false,
  daily_digest_enabled: true,
  onboarding_dismissals: {},
  /* Nic uloženého = všude výchozí hodnoty z `lib/legal-facts.ts`. */
  legal_facts: {},
  legal_facts_updated_at: "",
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
    legal_facts: { ...MERCHANT_SETTINGS_DEFAULTS.legal_facts },
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
    const schema =
      typedKey in READ_SCHEMAS
        ? READ_SCHEMAS[typedKey as keyof typeof READ_SCHEMAS]
        : KEY_SCHEMAS[typedKey]
    const parsed = schema.safeParse(source[key])

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
 *
 * `legal_facts` is the one nested key: it merges per fact (a partial write
 * must not drop the others) and stamps `legal_facts_updated_at` with `now`
 * when the effective facts actually changed.
 */
export const applyMerchantSettingsPatch = (
  current: MerchantSettings,
  patch: MerchantSettingsPatch,
  now: Date = new Date()
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

  const next: MerchantSettings = { ...current, ...parsed.data }

  if (parsed.data.legal_facts !== undefined) {
    // Jen poslané texty — klíč, který v zápisu chybí, zůstává, jak byl.
    next.legal_facts = {
      ...current.legal_facts,
      ...pickStoredLegalFacts(parsed.data.legal_facts),
    }
    if (!sameLegalFacts(current.legal_facts, next.legal_facts)) {
      next.legal_facts_updated_at = now.toISOString()
    }
  }

  return next
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

/** Dnešní datum v Praze jako yyyy-mm-dd (stejný tvar jako `vacation_until`). */
const pragueToday = (now: Date): string =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(now)

/**
 * Je dovolená právě teď? Zapnutá A (bez data, nebo ještě před dnem návratu).
 *
 * Den návratu už dovolená není — „Návrat 16. 8." znamená, že 16. 8. je zpátky.
 * Bez téhle meze visel pás „Dovolená" na webu i dva měsíce po návratu, dokud
 * přepínač někdo nevypnul ručně.
 */
export const isVacationActive = (
  settings: Pick<MerchantSettings, "vacation_enabled" | "vacation_until"> | null | undefined,
  now: Date = new Date()
): boolean => {
  if (!settings?.vacation_enabled) return false
  const until = settings.vacation_until?.trim()
  if (!until) return true
  return pragueToday(now) < until
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

export type LegalFactsSnapshot = {
  /** Platné hodnoty všech údajů — `null` = nevyplněno. */
  facts: LegalFactValues
  /** Kdy se údaje naposledy změnily (ISO), `null` = ještě nikdy neuložené. */
  updated_at: string | null
  /**
   * `settings` = z nastavení obchodu. `defaults` = nastavení nejde přečíst
   * a `facts` jsou výchozí hodnoty z kódu — e-mail pak radši sáhne po
   * manifestu právních dokumentů, web po své záloze.
   */
  source: "settings" | "defaults"
}

/**
 * Právní údaje tak, jak teď platí (`lib/legal-facts.ts`). Nikdy nevyhodí:
 * čte se při odesílání e-mailů a e-mail nesmí neodejít jen proto, že nejde
 * přečíst nastavení — pak vrátí výchozí hodnoty se `source: "defaults"`.
 */
export const getLegalFacts = async (
  container: MedusaContainer
): Promise<LegalFactsSnapshot> => {
  try {
    const settings = await getMerchantSettings(container)
    return {
      facts: resolveLegalFacts(settings.legal_facts),
      updated_at: settings.legal_facts_updated_at || null,
      source: "settings",
    }
  } catch (error) {
    try {
      container
        .resolve(ContainerRegistrationKeys.LOGGER)
        .warn(
          `[právní údaje] Nastavení obchodu nejde přečíst (${(error as Error)?.message ?? error}) — beru výchozí údaje z kódu.`
        )
    } catch {
      // Ani logger — nic dalšího se dělat nedá, výchozí údaje stačí.
    }
    return { facts: resolveLegalFacts(undefined), updated_at: null, source: "defaults" }
  }
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
