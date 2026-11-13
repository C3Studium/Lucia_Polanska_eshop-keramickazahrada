/**
 * Věta nad tlačítkem „Odstoupit od smlouvy".
 *
 * Vytažená z `withdrawal/entry.tsx` (13. 11. 2026): při převodu vět do
 * administrace se šablona rozbila — zákazník viděl doslovné
 * `{texty["order.withdrawal_2"]}` a uložená věta končila znakem „$".
 * Konec věty se proto čistí od „$" i tady, kdyby ho měla uloženou
 * i administrace.
 */
type EntryState =
  | { kind: "available"; deadlineText?: string | null }
  | { kind: string; text?: string; deadlineText?: string | null }

export const withdrawalLead = (
  state: EntryState,
  basis: string | null | undefined,
  texty: Record<string, string | undefined>
): string => {
  if (state.kind !== "available") return (state as { text?: string }).text ?? ""
  if (basis === "not_shipped" || basis === "in_transit") {
    return texty["order.withdrawal_1"] ?? ""
  }
  if (state.deadlineText) {
    const zacatek = (texty["order.withdrawal_2"] ?? "Od smlouvy můžete odstoupit bez udání důvodu do")
      .replace(/\s*\$\s*$/, "")
      .trimEnd()
    return `${zacatek} ${state.deadlineText} (14 dnů od převzetí zboží).`
  }
  return "Od smlouvy můžete odstoupit bez udání důvodu do 14 dnů od převzetí zboží."
}
