/**
 * Fáze výroby na zakázku pro detail objednávky — sdílí je widget „Výroba na
 * zakázku" a „Denní práce".
 *
 * U objednávky, kde je JEN zakázka, se postup výroby (Potvrdit zadání →
 * Začít výrobu → Výroba dokončena) ovládá tlačítkem v Denní práci; widget
 * výroby drží jen peníze (příplatek, doplatek). U smíšené objednávky zůstává
 * obojí zvlášť — Denní práce chystá zboží, výroba běží ve svém widgetu
 * (přání majitelky 14. 10. 2026, „kvůli praktičnosti").
 */

export type ProductionStage =
  | "specification_pending"
  | "confirmed"
  | "in_production"
  | "awaiting_balance"
  | "ready_to_ship"
  | "completed"
  | "cancelled";

export type ProductionStepAction =
  | "confirm_specification"
  | "start_production"
  | "complete_production";

export const productionStageMeta: Record<
  ProductionStage,
  { label: string; color: "blue" | "orange" | "green" | "red" | "grey" }
> = {
  specification_pending: { label: "Čeká na potvrzení zadání", color: "orange" },
  confirmed: { label: "Zadání potvrzeno", color: "blue" },
  in_production: { label: "Ve výrobě", color: "orange" },
  awaiting_balance: { label: "Hotová — čeká na doplatek", color: "orange" },
  ready_to_ship: { label: "Hotová a zaplacená", color: "green" },
  completed: { label: "Dokončeno", color: "green" },
  cancelled: { label: "Zrušeno", color: "grey" },
};

/** Další krok výroby podle fáze. Doplatek tu není — má vlastní tlačítko u peněz. */
export const productionStep: Partial<
  Record<ProductionStage, { action: ProductionStepAction; label: string }>
> = {
  specification_pending: { action: "confirm_specification", label: "Potvrdit zadání" },
  confirmed: { action: "start_production", label: "Začít výrobu" },
  in_production: { action: "complete_production", label: "Výroba dokončena" },
};

/**
 * Fáze, kdy u čisté zakázky Denní práce ukazuje výrobu místo balení zboží.
 * Od „hotová a zaplacená" dál jede běžný postup (Připraveno k odeslání…).
 */
export const isProductionPhase = (stage: string | null | undefined): boolean =>
  ["specification_pending", "confirmed", "in_production", "awaiting_balance"].includes(
    String(stage ?? "")
  );

/**
 * Kde se ovládá postup výroby — a tím i odkud zákazníkovi odejde e-mail
 * o zahájení a průběhu TÉ JEDNÉ zakázky (přání majitelky 3. 11. 2026):
 *
 * - jedna zakázka a nic jiného v objednávce → Denní práce (nahoře), jak to
 *   je od 14. 10. 2026;
 * - jedna zakázka a k ní běžné zboží → karta zakázky (tam, kde je příplatek);
 *   zboží si Denní práce vede po svém (balení, odeslání);
 * - víc zakázek (s zbožím i bez) → karta KAŽDÉ zakázky zvlášť. Jedno tlačítko
 *   nahoře by neumělo říct, které zakázky se krok týká — a server by ho bez
 *   `production_order_id` u víc zakázek odmítl (§ 0c).
 */
export const productionStepPlacement = ({
  pureCommission,
  commissionCount,
}: {
  /** Objednávka je jen zakázka (zakázky), žádné běžné zboží. */
  pureCommission: boolean;
  commissionCount: number;
}): "daily-work" | "commission-card" =>
  pureCommission && commissionCount <= 1 ? "daily-work" : "commission-card";

/** Pořadí fází od nejranější — pro souhrnný odznak nad víc zakázkami. */
const STAGE_ORDER: ProductionStage[] = [
  "specification_pending",
  "confirmed",
  "in_production",
  "awaiting_balance",
  "ready_to_ship",
  "completed",
  "cancelled",
];

/**
 * Nejméně rozpracovaná fáze ze zakázek objednávky. Denní práce ukazuje, co
 * ještě čeká — ne co je nejdál hotové. Zrušená zakázka je poslední, aby
 * neodznačila ostatní, které se pořád vyrábějí.
 */
export const leastAdvancedStage = (
  stages: Array<string | null | undefined>
): ProductionStage => {
  let best = STAGE_ORDER.length - 1;
  for (const stage of stages) {
    const index = STAGE_ORDER.indexOf(stage as ProductionStage);
    if (index >= 0 && index < best) best = index;
  }
  return STAGE_ORDER[best];
};
