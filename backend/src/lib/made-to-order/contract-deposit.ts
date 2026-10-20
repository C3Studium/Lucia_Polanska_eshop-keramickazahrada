import { round2, toNumber } from "../claims/refund-rules"

/**
 * SMLUVNÍ záloha zakázky (LEGAL_AUDIT.md § 0, Z2 + Z5) — čisté výpočty bez
 * kontejneru, dokazované testem (`lib/__tests__/made-to-order-contract-deposit`).
 *
 * ## Dvě různé „zálohy", které se dřív slévaly
 *
 * - **Smluvní záloha** = procento z profilu výroby (přebití u provedení
 *   vyhrává), nejvýš 50 % (Z2, § 1813 a § 1814 odst. 1 písm. l) OZ). Po
 *   zahájení výroby se tahle část nevrací (Z5). Nese ji
 *   `production_order.deposit_percentage` + `deposit_amount`.
 * - **Zaplaceno v pokladně** = kolik zákazník skutečně poslal (posuvník:
 *   od zálohy po celou cenu). Nese ji žádost o platbu typu `deposit`.
 *
 * Do 20. 10. 2026 se do `deposit_percentage` ukládalo zaplaceno/celkem (u
 * plné platby 100 %), takže „záloha" u zakázky zaplacené celá byla celá cena
 * — a při zrušení po zahájení výroby by se podle OP nevracelo nic. Proto
 * pokladna teď ukládá k řádku i `contract_*` snímek PŘED tím, než ho posuvník
 * přepíše, a tahle funkce z něj počítá smluvní zálohu zakázky.
 */

/** Z2: strop smluvní zálohy v procentech. Hlídá ho i DB check. */
export const MAX_CONTRACT_DEPOSIT_PERCENTAGE = 50

/** Výchozí procento profilu, když profil žádné nemá (model má default 25). */
export const DEFAULT_CONTRACT_DEPOSIT_PERCENTAGE = 25

/** Procento sevřené do 1–50 (nesmysl → výchozí). */
export const clampContractPercentage = (
  value: unknown,
  fallback: number = DEFAULT_CONTRACT_DEPOSIT_PERCENTAGE
): number => {
  const numeric = toNumber(value)
  const base = numeric > 0 ? numeric : fallback
  return Math.min(MAX_CONTRACT_DEPOSIT_PERCENTAGE, Math.max(1, base))
}

/**
 * Snímek zakázkového řádku z metadat platební kolekce pokladny
 * (`production_lines[]`, `workflows/prepare-made-to-order-payment`).
 * `contract_*` pole mají řádky od 20. 10. 2026; starší je nemají.
 */
export type ContractDepositLine = {
  product_id?: string | null
  /** Cena řádku po slevě (základ posuvníku i strop zálohy). */
  line_total?: unknown
  /** Smluvní procento z profilu / přebití (1–50). */
  contract_deposit_percentage?: unknown
  /** Smluvní záloha v penězích (z nezlevněné ceny, nejvýš cena řádku). */
  contract_deposit_amount?: unknown
  /** Nezlevněný základ řádku, ze kterého se smluvní záloha počítala. */
  contract_line_base?: unknown
}

export type ContractDeposit = {
  /** Smluvní procento zakázky — u víc řádků vážený průměr, 2 desetinná místa, 1–50. */
  percentage: number
  /** Σ smluvních záloh řádků (měna objednávky). */
  amount: number
  /** `true`, když se počítalo z `contract_*` snímku; `false` = odhad z profilu (stará kolekce). */
  from_snapshot: boolean
}

const hasContractSnapshot = (line: ContractDepositLine): boolean =>
  line?.contract_deposit_amount !== undefined &&
  line?.contract_deposit_amount !== null &&
  Number.isFinite(toNumber(line.contract_deposit_amount))

/**
 * Smluvní záloha celé zakázky z řádků pokladny.
 *
 * - S `contract_*` snímkem: `amount = Σ contract_deposit_amount`,
 *   `percentage = Σ contract_deposit_amount / Σ contract_line_base × 100`
 *   (vážený průměr přes řádky; chybí-li základ, bere se `line_total`).
 * - Bez snímku (kolekce z doby před 20. 10. 2026): procento z profilu
 *   (`fallbackPercentage`, výchozí 25) a záloha = Σ line_total × procento.
 *   NIKDY 100 — to bylo „zaplaceno", ne smluvní záloha.
 *
 * Procento je vždy sevřené do 1–50 (Z2), ať do DB nikdy nejde nic, co by
 * check odmítl.
 */
export const contractDepositOf = (
  lines: ContractDepositLine[] | null | undefined,
  fallbackPercentage: unknown = DEFAULT_CONTRACT_DEPOSIT_PERCENTAGE
): ContractDeposit => {
  const rows = (lines ?? []).filter(Boolean)
  const fallback = clampContractPercentage(fallbackPercentage)

  if (rows.length && rows.every(hasContractSnapshot)) {
    const amount = round2(
      rows.reduce((sum, line) => sum + toNumber(line.contract_deposit_amount), 0)
    )
    const base = rows.reduce(
      (sum, line) => sum + toNumber(line.contract_line_base ?? line.line_total),
      0
    )
    const percentage =
      base > 0
        ? clampContractPercentage(round2((amount / base) * 100), fallback)
        : clampContractPercentage(
            rows.length === 1 ? rows[0].contract_deposit_percentage : fallback,
            fallback
          )
    return { percentage, amount, from_snapshot: true }
  }

  const total = rows.reduce((sum, line) => sum + toNumber(line.line_total), 0)
  return {
    percentage: fallback,
    amount: round2((total * fallback) / 100),
    from_snapshot: false,
  }
}

/**
 * Smluvní záloha z uloženého řádku `production_order`: `deposit_amount`, a u
 * zakázek z doby před 20. 10. 2026 (sloupec null) odhad
 * `original_total × deposit_percentage / 100` — tam ale `deposit_percentage`
 * mohlo být „zaplaceno" (i 100 %), proto sevřené na 50 %.
 */
export const contractDepositAmountOf = (productionOrder: {
  deposit_amount?: unknown
  deposit_percentage?: unknown
  original_total?: unknown
  agreed_total?: unknown
}): number => {
  if (
    productionOrder?.deposit_amount !== undefined &&
    productionOrder?.deposit_amount !== null
  ) {
    return Math.max(0, round2(toNumber(productionOrder.deposit_amount)))
  }
  const total = toNumber(productionOrder?.original_total ?? productionOrder?.agreed_total)
  const percentage = clampContractPercentage(productionOrder?.deposit_percentage)
  return Math.max(0, round2((total * percentage) / 100))
}
