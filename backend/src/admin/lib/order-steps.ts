/**
 * Postup objednávky — kroky v pravém sloupci detailu (17. 11. 2026).
 *
 * Jedna řada kroků místo dvou míst (Denní práce + karta zakázky). Každý krok
 * je jeden e-mail zákazníkovi; hotové mají fajfku, aktuální jedno tlačítko,
 * budoucí jsou šedé (přání majitelky 17. 11. 2026):
 *
 *  - běžné zboží:   Přijata → Připravujeme → Zabaleno → Odesláno
 *  - se zakázkou:   Přijata → Zadání potvrzeno → Ve výrobě → Výroba hotová
 *                   → Doplaceno → Zabaleno → Odesláno
 *  - osobní odběr:  … → Připraveno k vyzvednutí → Vyzvednuto
 *
 * U smíšené objednávky (zboží + zakázka) se „Připravujeme" vynechává — lidé
 * čekají na všechno najednou a roli „začínáme" hraje potvrzení zadání
 * (stejné pravidlo drží subscriber e-mailů).
 *
 * Víc zakázek v jedné objednávce: výroba je jeden krok s řádkem pro každou
 * zakázku — krok výroby se vždycky týká jedné konkrétní zakázky.
 */

export type StepKey =
  | "received"
  | "working"
  | "confirm"
  | "production"
  | "complete"
  | "production_multi"
  | "balance"
  | "packed"
  | "done";

export type StepState = "done" | "current" | "todo";

export type OrderStep = { key: StepKey; state: StepState };

export type StepsInput = {
  /** Fáze objednávky (merchant_order_state.stage). */
  stage: string;
  pickup: boolean;
  commissions: Array<{ stage: string; outstanding: number }>;
};

const PRODUCTION_RANK: Record<string, number> = {
  specification_pending: 0,
  confirmed: 1,
  in_production: 2,
  awaiting_balance: 3,
  ready_to_ship: 4,
  completed: 5,
};

const ORDER_RANK: Record<string, number> = {
  received: 0,
  payment_problem: 0,
  working: 1,
  shipping: 2,
  shipped: 3,
};

/** Zakázky, které se ještě počítají (zrušená postup nedrží). */
export const liveCommissions = <T extends { stage: string }>(commissions: T[]): T[] =>
  commissions.filter((commission) => commission.stage !== "cancelled");

export const buildOrderSteps = ({ stage, pickup, commissions }: StepsInput): OrderStep[] => {
  const live = liveCommissions(commissions);
  const rank = (value: string) => PRODUCTION_RANK[value] ?? 0;
  const all = (min: number) => live.every((commission) => rank(commission.stage) >= min);
  const orderRank = ORDER_RANK[stage] ?? 0;

  const raw: Array<{ key: StepKey; done: boolean }> = [{ key: "received", done: true }];

  if (live.length > 1) {
    raw.push({ key: "production_multi", done: all(3) });
  } else if (live.length === 1) {
    raw.push({ key: "confirm", done: all(1) });
    raw.push({ key: "production", done: all(2) });
    raw.push({ key: "complete", done: all(3) });
  } else if (!pickup) {
    raw.push({ key: "working", done: orderRank >= 1 });
  }

  if (live.length) {
    raw.push({
      key: "balance",
      done: live.every((commission) => commission.outstanding <= 0.005),
    });
  }

  raw.push({ key: "packed", done: orderRank >= 2 });
  raw.push({ key: "done", done: orderRank >= 3 });

  // Zrušená objednávka: nic dalšího se nedělá, kroky jen ukazují, kam došla.
  const cancelled = stage === "cancelled";
  let currentTaken = cancelled;
  return raw.map(({ key, done }) => {
    if (done) return { key, state: "done" as const };
    if (!currentTaken) {
      currentTaken = true;
      return { key, state: "current" as const };
    }
    return { key, state: "todo" as const };
  });
};
