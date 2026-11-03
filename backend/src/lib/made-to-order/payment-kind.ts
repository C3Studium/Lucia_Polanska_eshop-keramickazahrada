/**
 * Záloha, nebo doplatek? Podle toho, co to opravdu je — ne podle sloupce.
 *
 * Záloha u ceny po domluvě se ukládá s `type: "balance"` SCHVÁLNĚ: dohled nad
 * platbami (`jobs/reconcile-balance-payments`) i vypořádání po návratu
 * z brány (`lib/balance-settlement`) znají jen doplatek, takže by se zaplacení
 * jinak vůbec nezapsalo. Rozliší se až idempotenčním klíčem
 * `deposit:<zakázka>:<částka>`, který zakládá `lib/balance-payment`.
 *
 * Dokud se podle toho nerozlišovalo, zůstala zakázka s cenou po domluvě BEZ
 * FAKTURY (3. 11. 2026): zaplacená záloha se nepočítala mezi zálohy (jiný typ)
 * ani mezi doplatky (ty se fakturují, až když zakázka nic nedluží — a ona
 * dlužila zbytek ceny). Ve smlouvě i v rozpisu plateb chyběla ze stejného
 * důvodu a v administraci se popisovala jako „Doplatek".
 *
 * Platí to jen tam, kde se platba POPISUJE (faktury, doklady, e-maily,
 * administrace). Hledání otevřené žádosti k zaplacení, dohled a vypořádání
 * dál jedou na `type`, jinak by se zaplacená záloha neměla kde zapsat.
 */

export type PaymentRequestKindInput = {
  type?: string | null
  idempotency_key?: string | null
}

/** Idempotenční klíč zálohy (`lib/balance-payment`). */
const DEPOSIT_KEY_PREFIX = "deposit:"

export const isDepositRequest = (
  request: PaymentRequestKindInput | null | undefined
): boolean =>
  request?.type === "deposit" ||
  String(request?.idempotency_key ?? "").startsWith(DEPOSIT_KEY_PREFIX)

/** Doplatek = co není záloha. */
export const isBalanceRequest = (
  request: PaymentRequestKindInput | null | undefined
): boolean => !isDepositRequest(request)
