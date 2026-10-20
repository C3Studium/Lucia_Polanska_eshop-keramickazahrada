import { MAX_CONTRACT_DEPOSIT_PERCENTAGE } from "./contract-deposit"

/**
 * Validace profilu výroby (admin `PATCH /admin/made-to-order/products/:id`) —
 * čistá, ať jde dokázat testem, že strop zálohy je 50 % (LEGAL_AUDIT.md § 0,
 * Z2) u profilu i u přebití provedení. Routa z ní jen dělá `MedusaError`.
 */

export const DEPOSIT_RANGE_MESSAGE =
  "Výše zálohy musí být mezi 1 a 50 % (obchodní podmínky, čl. Výroba na zakázku)."

export const VARIANT_DEPOSIT_RANGE_MESSAGE =
  "Záloha u provedení musí být mezi 1 a 50 % (obchodní podmínky, čl. Výroba na zakázku)."

export type ProfileValidationInput = {
  default_deposit_percentage?: number
  production_time_min_days?: number
  production_time_max_days?: number
  variants?: Array<{ deposit_percentage_override?: number | null }>
}

export type ProfileValidationVerdict = { ok: true } | { ok: false; message: string }

const inDepositRange = (value: number): boolean =>
  Number.isFinite(value) && value >= 1 && value <= MAX_CONTRACT_DEPOSIT_PERCENTAGE

export const validateProductionProfile = (
  input: ProfileValidationInput
): ProfileValidationVerdict => {
  const deposit = input.default_deposit_percentage
  if (deposit !== undefined && !inDepositRange(deposit)) {
    return { ok: false, message: DEPOSIT_RANGE_MESSAGE }
  }
  const min = input.production_time_min_days
  const max = input.production_time_max_days
  if (min !== undefined && (!Number.isInteger(min) || min < 0)) {
    return { ok: false, message: "Minimální doba výroby není platná." }
  }
  if (max !== undefined && (!Number.isInteger(max) || max < 0)) {
    return { ok: false, message: "Maximální doba výroby není platná." }
  }
  if (min !== undefined && max !== undefined && min > max) {
    return { ok: false, message: "Minimální doba výroby nesmí být delší než maximální." }
  }
  for (const variant of input.variants || []) {
    const override = variant.deposit_percentage_override
    if (override != null && !inDepositRange(override)) {
      return { ok: false, message: VARIANT_DEPOSIT_RANGE_MESSAGE }
    }
  }
  return { ok: true }
}
