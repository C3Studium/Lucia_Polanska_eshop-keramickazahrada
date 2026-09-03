import { Input, Label, RadioGroup, Text } from "@medusajs/ui";
import { useMemo } from "react";
import {
  resolveScopeTermIds,
  type BulkScope,
} from "../../modules/course/bulk-scope";
import { groupByPragueDay, pragueDayKey } from "../lib/course-calendar";
import { CourseDayPicker } from "./course-day-picker";

/**
 * „Kde se to má projevit?" — the question both bulk dialogs ask.
 *
 * A price or a note is rarely about one session. „Od září zdražuju" and
 * „přes zimu si vezměte přezůvky" are statements about a stretch of the
 * calendar, and before this the only way to say either was to open every term
 * in turn and retype it — which is how two of them end up disagreeing.
 *
 * The count under the choice is not decoration. It is computed with
 * `resolveScopeTermIds`, the same pure function the server runs on the way in
 * (`modules/course/bulk-scope.ts`), so „změní 14 termínů" is a promise rather
 * than an estimate — and a scope that would reach nothing says so before the
 * owner presses save.
 */

export type ScopeChoice = "this" | "terms" | "all_upcoming" | "period";

export type ScopeState = {
  choice: ScopeChoice;
  /** Day keys picked in the calendar — every term on them is in scope. */
  days: string[];
  from: string;
  to: string;
};

export type ScopeTerm = {
  id: string;
  title: string;
  starts_at: string;
  status: string;
};

export const emptyScopeState: ScopeState = {
  choice: "this",
  days: [],
  from: "",
  to: "",
};

/**
 * The wire shape for the chosen scope, or null while the choice is still
 * incomplete (no days picked, a half-filled period).
 *
 * „Jen tento termín" collapses into an explicit id list rather than being its
 * own server-side kind — one term is just the smallest selection.
 */
export const scopeToPayload = (
  state: ScopeState,
  thisTermId: string,
  terms: ScopeTerm[]
): BulkScope | null => {
  if (state.choice === "this") {
    return { kind: "terms", ids: [thisTermId] };
  }
  if (state.choice === "all_upcoming") {
    return { kind: "all_upcoming" };
  }
  if (state.choice === "period") {
    if (!state.from || !state.to) {
      return null;
    }
    return { kind: "period", from: state.from, to: state.to };
  }
  if (!state.days.length) {
    return null;
  }
  // A picked day means every term standing on it.
  const wanted = new Set(state.days);
  const ids = terms
    .filter((term) => wanted.has(pragueDayKey(term.starts_at)))
    .map((term) => term.id);
  return ids.length ? { kind: "terms", ids } : null;
};

export const CourseScopePicker = ({
  state,
  onChange,
  thisTermId,
  terms,
  /** What the edit is, for the count sentence: „změní 14 termínů". */
  noun = "termínů",
}: {
  state: ScopeState;
  onChange: (next: ScopeState) => void;
  thisTermId: string;
  terms: ScopeTerm[];
  noun?: string;
}) => {
  const set = (patch: Partial<ScopeState>) =>
    onChange({ ...state, ...patch });

  // Only days that already carry a term can be picked — the click means
  // „this existing session", not „make one here".
  const termCounts = useMemo(() => {
    const byDay = groupByPragueDay(
      terms.filter((term) => term.status !== "cancelled")
    );
    return new Map(
      Array.from(byDay.entries()).map(([key, list]) => [key, list.length])
    );
  }, [terms]);

  const payload = scopeToPayload(state, thisTermId, terms);
  const affected = payload
    ? resolveScopeTermIds(terms as never, payload).length
    : 0;

  const countLine = !payload
    ? state.choice === "period"
      ? "Vyplňte obě data."
      : "Vyberte v kalendáři aspoň jeden den."
    : affected === 0
      ? "Tenhle výběr neobsahuje žádný termín, který jde upravit."
      : affected === 1
        ? `Změní 1 ${noun === "termínů" ? "termín" : noun}.`
        : affected < 5
          ? `Změní ${affected} termíny.`
          : `Změní ${affected} ${noun}.`;

  return (
    <div className="flex flex-col gap-y-3">
      <Label>Kde se to má projevit?</Label>
      <RadioGroup
        value={state.choice}
        onValueChange={(value) => set({ choice: value as ScopeChoice })}
      >
        <RadioGroup.ChoiceBox
          value="this"
          label="Jen tenhle termín"
          description="Ostatní termíny zůstanou, jak jsou."
        />
        <RadioGroup.ChoiceBox
          value="terms"
          label="Vybrané termíny"
          description="Naklikejte v kalendáři dny — projeví se na všech termínech, které na nich stojí."
        />
        <RadioGroup.ChoiceBox
          value="all_upcoming"
          label="Všechny nadcházející"
          description="Každý termín, který ještě nezačal. Proběhlé zůstanou beze změny."
        />
        <RadioGroup.ChoiceBox
          value="period"
          label="Dané období"
          description="Od data do data — hodí se na sezónu."
        />
      </RadioGroup>

      {state.choice === "terms" ? (
        <CourseDayPicker
          selected={state.days}
          onChange={(days) => set({ days })}
          termCounts={termCounts}
          selectableDays
          emptyHint="Klikněte na dny s termínem — tečka označuje den, kde termín je."
        />
      ) : null}

      {state.choice === "period" ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="scope-from" size="small">
              Od
            </Label>
            <Input
              id="scope-from"
              type="date"
              value={state.from}
              onChange={(event) => set({ from: event.target.value })}
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="scope-to" size="small">
              Do
            </Label>
            <Input
              id="scope-to"
              type="date"
              value={state.to}
              onChange={(event) => set({ to: event.target.value })}
            />
          </div>
        </div>
      ) : null}

      <Text
        size="small"
        className={
          payload && affected > 0 ? "text-ui-fg-subtle" : "text-ui-fg-muted"
        }
        aria-live="polite"
      >
        {countLine}
      </Text>
    </div>
  );
};
