/**
 * Co se uloží do výrobního profilu, když přijde jen kousek formuláře.
 *
 * Profil zakázky se dlouho ukládal jedinou cestou — dialogem „Nastavit
 * zakázku", který posílá všech osm polí naráz. Vynechané pole proto spadlo
 * rovnou na výchozí hodnotu a nikomu to nevadilo.
 *
 * Od 30. 10. 2026 zakázku zapíná i přepínač „Na zakázku" ve Vlastnostech
 * prodeje, který posílá jediné pole (`enabled`). Se starým pravidlem by jeho
 * vypnutí a zapnutí srazilo domluvenou zálohu zpátky na 25 %, lhůtu na
 * 14–42 dní a smazalo „co mi pošlete" — tiše, bez varování, u kusu, který
 * zákazník zrovna objednává.
 *
 * Pořadí je proto: **co přišlo > co je uložené > výchozí**. Uložená `null`
 * (nikdy nevyplněno) se bere jako „nic" a spadne na výchozí; jen
 * `specification_prompt` smí zůstat prázdný, protože prázdná výzva je
 * legitimní stav.
 */

export type ProductionProfileFields = {
  enabled: boolean
  specification_required: boolean
  specification_prompt: string | null
  production_time_min_days: number
  production_time_max_days: number
  default_deposit_percentage: number
  contact_customer_after_order: boolean
  allow_final_price_adjustment: boolean
  allow_full_prepayment: boolean
}

export type ProductionProfileInput = Partial<
  Omit<ProductionProfileFields, "specification_prompt">
> & {
  specification_prompt?: string | null
}

export const PRODUCTION_PROFILE_DEFAULTS: ProductionProfileFields = {
  enabled: true,
  specification_required: true,
  specification_prompt: null,
  production_time_min_days: 14,
  production_time_max_days: 42,
  default_deposit_percentage: 25,
  contact_customer_after_order: true,
  allow_final_price_adjustment: true,
  allow_full_prepayment: true,
}

const keep = <T>(sent: T | undefined, saved: unknown, fallback: T): T =>
  sent ?? (saved === null || saved === undefined ? fallback : (saved as T))

export const mergeProductionProfile = (
  input: ProductionProfileInput | null | undefined,
  current: Record<string, unknown> | null | undefined
): ProductionProfileFields => {
  const sent = input ?? {}
  const saved = current ?? {}
  const defaults = PRODUCTION_PROFILE_DEFAULTS

  return {
    // `enabled` je jediné pole, které tlačítko vždycky říká naplno —
    // bez něj je PATCH „zapni zakázku" (zakládání profilu z dialogu).
    enabled: sent.enabled ?? defaults.enabled,
    specification_required: keep(
      sent.specification_required,
      saved.specification_required,
      defaults.specification_required
    ),
    specification_prompt:
      sent.specification_prompt === undefined
        ? ((saved.specification_prompt as string | null) ?? null)
        : sent.specification_prompt?.trim() || null,
    production_time_min_days: keep(
      sent.production_time_min_days,
      saved.production_time_min_days,
      defaults.production_time_min_days
    ),
    production_time_max_days: keep(
      sent.production_time_max_days,
      saved.production_time_max_days,
      defaults.production_time_max_days
    ),
    default_deposit_percentage: keep(
      sent.default_deposit_percentage,
      saved.default_deposit_percentage,
      defaults.default_deposit_percentage
    ),
    contact_customer_after_order: keep(
      sent.contact_customer_after_order,
      saved.contact_customer_after_order,
      defaults.contact_customer_after_order
    ),
    allow_final_price_adjustment: keep(
      sent.allow_final_price_adjustment,
      saved.allow_final_price_adjustment,
      defaults.allow_final_price_adjustment
    ),
    allow_full_prepayment: keep(
      sent.allow_full_prepayment,
      saved.allow_full_prepayment,
      defaults.allow_full_prepayment
    ),
  }
}
