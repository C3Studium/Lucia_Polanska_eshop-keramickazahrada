/**
 * Fáze Denní práce slovy — a jak se tytéž fáze čtou u osobního odběru.
 *
 * Fází je jedna sada (jeden workflow, jedna tabulka). Mění se jen slova:
 * u osobního odběru se NIKAM nic neposílá, zákazník si pro objednávku
 * dojede. „K odeslání" je proto „Připraveno k vyzvednutí" a „Odesláno" je
 * „Vyzvednuto" (přání majitelky 30. 10. 2026) — a další krok není „Označit
 * jako odeslané", ale „Vyzvednuto a zaplaceno".
 *
 * Proč vlastní soubor: popisky fází se do té doby psaly dvakrát (`stageMeta`
 * ve frontě Denní práce kvůli barvám a `stageLabels` v přehledech), takže
 * přejmenování na jednom místě by druhé nechalo mluvit o odesílání. Barvy
 * zůstávají tam, kde byly — odběr je mění jen ve slovech.
 */

export const STAGE_LABELS: Record<string, string> = {
  received: "Nové",
  working: "Připravujeme",
  shipping: "K odeslání",
  shipped: "Odesláno",
  payment_problem: "Problém s platbou",
  cancelled: "Zrušeno",
};

/** Co z toho čte osobní odběr jinak. Co tu není, platí shora. */
export const PICKUP_STAGE_LABELS: Record<string, string> = {
  shipping: "Připraveno k vyzvednutí",
  shipped: "Vyzvednuto",
};

export const stageLabel = (
  stage: string | null | undefined,
  personalPickup = false
): string => {
  const key = String(stage ?? "");
  return (
    (personalPickup ? PICKUP_STAGE_LABELS[key] : undefined) ??
    STAGE_LABELS[key] ??
    key
  );
};

/** Jediný další krok každé fáze — věta na tlačítku i v „Další krok: …". */
export const NEXT_STEP_LABELS: Record<string, string> = {
  received: "Začít připravovat",
  working: "Připraveno k odeslání",
  shipping: "Označit jako odeslané",
};

/**
 * U odběru je „připraveno" pozvánka pro zákazníka a poslední krok je výdej
 * u pultu — ne předání dopravci.
 */
export const PICKUP_NEXT_STEP_LABELS: Record<string, string> = {
  working: "Připraveno k vyzvednutí",
  shipping: "Vyzvednuto a zaplaceno",
};

export const nextStepLabel = (
  stage: string | null | undefined,
  personalPickup = false
): string | undefined => {
  const key = String(stage ?? "");
  return (
    (personalPickup ? PICKUP_NEXT_STEP_LABELS[key] : undefined) ??
    NEXT_STEP_LABELS[key]
  );
};
