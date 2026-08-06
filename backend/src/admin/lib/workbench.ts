/**
 * Shared bits of the four advanced workbenches (admin-advanced-plan.md).
 *
 * The workbenches are one idea rendered four times — a dense row-list over a
 * joined dataset, filters as chips, Czech money — so the idea lives once.
 * Anything a single workbench needs alone stays in that workbench.
 */

export const formatCzk = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
};

export const formatCount = (value: number, one: string, few: string, many: string): string => {
  if (value === 1) return `1 ${one}`;
  if (value >= 2 && value <= 4) return `${value} ${few}`;
  return `${value} ${many}`;
};

/** The merchant stages, in the owner's words — mirrors Denní práce. */
export const stageLabels: Record<string, string> = {
  received: "Nové",
  working: "Připravujeme",
  shipping: "K odeslání",
  shipped: "Odesláno",
  payment_problem: "Problém s platbou",
  cancelled: "Zrušeno",
};

/**
 * Production-order stages (made-to-order module) in her words. Distinct from
 * the merchant stages above — mixing the two maps is how the products
 * statistics ended up printing `specification_pending: 3` in English.
 */
export const productionStageLabels: Record<string, string> = {
  specification_pending: "Čeká na zadání",
  confirmed: "Potvrzeno",
  in_production: "Ve výrobě",
  awaiting_balance: "Čeká na doplatek",
  ready_to_ship: "Připraveno k odeslání",
  completed: "Dokončeno",
  cancelled: "Zrušeno",
};

export const stageColors: Record<
  string,
  "green" | "orange" | "blue" | "red" | "grey" | "purple"
> = {
  received: "blue",
  working: "orange",
  shipping: "purple",
  shipped: "green",
  payment_problem: "red",
  cancelled: "grey",
};
