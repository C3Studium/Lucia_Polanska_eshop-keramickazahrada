import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  balancePaymentQuery,
  balancePaymentUrl,
} from "../../../../../lib/balance-payment-link"
import { buildCommissionViews } from "../../../../../lib/made-to-order/commission-view"

/**
 * Stav zakázek objednávky pro stránku potvrzení objednávky a účet.
 *
 * Doplatek žije v modulu zakázky, ne v nativní ceně objednávky (ta po zaplacení
 * zálohy vypadá „zaplaceno"). Souhrn na potvrzení proto nemůže rozpoznat „jen
 * záloha" z objednávky samotné — vezme to odsud: kolik je zaplaceno zálohou,
 * kolik zbývá doplatit, a podepsaný odkaz na doplacení (funguje i bez přihlášení).
 *
 * Od 20. 10. 2026 (LEGAL_AUDIT.md § 0c, Z-A) je zakázka = POLOŽKA objednávky:
 * `commissions[]` nese každou zakázku zvlášť (název položky, fáze, smluvní
 * záloha, zaplaceno / zbývá za položku, vlastní odkaz na doplatek, Z3, zrušení
 * s náhledem Z4/Z5, PDF, lhůta Z9), `totals` součty za objednávku. Dosavadní
 * pole na nejvyšší úrovni zůstávají kvůli starším čtenářům = hodnoty PRVNÍ
 * zakázky / součty. `pay_url` na nejvyšší úrovni jen když má otevřený doplatek
 * právě jedna zakázka — jinak null, odkazy jsou per zakázka.
 *
 * `is_commission: false` = není to zakázka → Souhrn se chová jako u běžné
 * objednávky.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const orderId = req.params.orderId

  // `balancePaymentUrl` čte base z env (BACKEND_PUBLIC_URL/MEDUSA_BACKEND_URL);
  // když nejsou nastavené, vrací null a tlačítko by zmizelo — proto fallback na
  // host z requestu, ať je odkaz vždy.
  const payUrlFor = (productionOrderId: string): string | null => {
    const fromEnv = balancePaymentUrl(orderId, productionOrderId)
    if (fromEnv) return fromEnv
    const proto = (req.headers["x-forwarded-proto"] as string | undefined) || "https"
    const host =
      (req.headers["x-forwarded-host"] as string | undefined) ||
      (req.headers.host as string | undefined) ||
      ""
    return host
      ? `${proto}://${host}/made-to-order/${orderId}/pay-balance${balancePaymentQuery(orderId, productionOrderId)}`
      : null
  }

  const views = await buildCommissionViews(req.scope, orderId, { payUrlFor })
  if (!views) {
    res.status(200).json({ is_commission: false })
    return
  }

  const { commissions, totals } = views
  const first = commissions[0]
  const open = commissions.filter((commission) => commission.pay_url)
  const maxDays = commissions
    .map((commission) => commission.production_time_max_days)
    .filter((days): days is number => typeof days === "number")

  res.status(200).json({
    is_commission: true,
    currency_code: first.currency_code,
    commissions,
    totals: {
      deposit_paid: totals.deposit_paid,
      balance_paid: totals.balance_paid,
      outstanding: totals.outstanding,
    },
    // Jen když má otevřený doplatek právě jedna zakázka; jinak odkazy per zakázka.
    pay_url: open.length === 1 ? open[0].pay_url : null,

    // ── Zpětná kompatibilita (hodnoty první zakázky / součty) ─────────────
    stage: first.stage,
    deposit_paid: totals.deposit_paid,
    balance_paid: totals.balance_paid,
    outstanding: totals.outstanding,
    deposit_amount: first.deposit_amount,
    deposit_percentage: first.deposit_percentage,
    production_start_notified_at: first.production_start_notified_at,
    cancelled_by: first.cancelled_by,
    cancellation_phase: first.cancellation_phase,
    cancellation_refund_amount: first.cancellation_refund_amount,
    confirmation_pdf_url: first.confirmation_pdf_url,
    confirmation_sent_at: first.confirmation_sent_at,
    // Z9: nejdelší lhůta výroby přes zakázky objednávky (dřív první zakázkový řádek).
    production_time_max_days: maxDays.length ? Math.max(...maxDays) : null,
  })
}
