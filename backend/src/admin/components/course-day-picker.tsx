import { Button, Heading, Text } from "@medusajs/ui";
import { useState } from "react";
import {
  type CalendarMonth,
  CZECH_WEEKDAYS,
  addMonths,
  buildMonthGrid,
  dayLabel,
  monthTitle,
  pragueDayKey,
  pragueMonthOf,
} from "../lib/course-calendar";

/**
 * The month grid the owner clicks to say *when*.
 *
 * Replaces the `dd.mm.rrrr --:--` field that used to sit in the term drawer.
 * Typing a date is a translation step — the owner thinks „ten čtvrtek a ten
 * po něm", and a text field makes her convert that into digits and get it
 * wrong at the end of a month. Clicking days is the thing she already means.
 *
 * Two jobs, one component:
 *
 * - **Creating terms** — any future day is selectable; days that already carry
 *   a term show a dot, so she can see she is about to double-book before she
 *   does it rather than in the „přeskočeno, už existoval" toast afterwards.
 * - **Choosing a scope** — only days that already carry terms are selectable
 *   (`selectableDays`), because there the click means „this existing session",
 *   not „make one here".
 *
 * Grid maths and Czech names come from `lib/course-calendar.ts`, which is the
 * mirror of the storefront's own calendar and is pinned by
 * `modules/course/__tests__/calendar-math.unit.spec.ts`.
 */

export type CourseDayPickerProps = {
  /** Selected Prague day keys, "YYYY-MM-DD". */
  selected: string[];
  onChange: (next: string[]) => void;
  /**
   * Day key → how many terms already sit on that day. Rendered as a dot with
   * the count; also drives `selectableDays` when that is on.
   */
  termCounts?: Map<string, number>;
  /** Refuse days before this key — the create flow passes today. */
  minDayKey?: string;
  /** When true, only days present in `termCounts` can be clicked. */
  selectableDays?: boolean;
  /** Shown under the grid when nothing is selected yet. */
  emptyHint?: string;
};

export const CourseDayPicker = ({
  selected,
  onChange,
  termCounts,
  minDayKey,
  selectableDays = false,
  emptyHint = "Klikněte na dny, kdy se kurz koná.",
}: CourseDayPickerProps) => {
  // Opens on the month of the first pick, so re-opening an edited selection
  // does not start in today's month with the picks invisible somewhere else.
  const [month, setMonth] = useState<CalendarMonth>(() =>
    selected.length
      ? pragueMonthOf(`${selected.slice().sort()[0]}T12:00:00.000Z`)
      : pragueMonthOf(new Date().toISOString())
  );

  const weeks = buildMonthGrid(month.year, month.month);
  const todayKey = pragueDayKey(new Date().toISOString());
  const chosen = new Set(selected);

  const toggle = (key: string) => {
    const next = new Set(chosen);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onChange(Array.from(next).sort());
  };

  return (
    <div className="flex flex-col gap-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-x-2">
          <Button
            type="button"
            variant="secondary"
            size="small"
            aria-label="Předchozí měsíc"
            onClick={() => setMonth((current) => addMonths(current, -1))}
          >
            ‹
          </Button>
          <Heading level="h3" className="min-w-32 text-center" aria-live="polite">
            {monthTitle(month)}
          </Heading>
          <Button
            type="button"
            variant="secondary"
            size="small"
            aria-label="Další měsíc"
            onClick={() => setMonth((current) => addMonths(current, 1))}
          >
            ›
          </Button>
        </div>
        <Button
          type="button"
          variant="transparent"
          size="small"
          onClick={() => setMonth(pragueMonthOf(new Date().toISOString()))}
        >
          Dnes
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {CZECH_WEEKDAYS.map((weekday) => (
          <Text
            key={weekday.short}
            size="xsmall"
            weight="plus"
            className="text-ui-fg-muted px-1 text-center uppercase"
            aria-label={weekday.long}
          >
            {weekday.short}
          </Text>
        ))}
        {weeks.flat().map((cell, index) => {
          if (!cell) {
            return (
              <div key={`pad-${index}`} className="h-11" aria-hidden="true" />
            );
          }
          const count = termCounts?.get(cell.key) ?? 0;
          const isChosen = chosen.has(cell.key);
          const tooEarly = Boolean(minDayKey && cell.key < minDayKey);
          const needsTerm = selectableDays && count === 0;
          const disabled = tooEarly || needsTerm;

          return (
            <button
              key={cell.key}
              type="button"
              disabled={disabled}
              aria-pressed={isChosen}
              aria-label={`${dayLabel(cell.key)}${
                count ? ` — ${count === 1 ? "1 termín" : `${count} termínů`}` : ""
              }`}
              onClick={() => toggle(cell.key)}
              className={[
                "relative flex h-11 flex-col items-center justify-center rounded-lg border text-sm transition-colors",
                disabled
                  ? "text-ui-fg-disabled border-ui-border-base cursor-not-allowed opacity-50"
                  : "hover:bg-ui-bg-base-hover cursor-pointer",
                isChosen
                  ? "bg-ui-bg-interactive text-ui-fg-on-color border-ui-border-interactive font-medium"
                  : cell.key === todayKey
                    ? "border-ui-border-interactive"
                    : "border-ui-border-base",
              ].join(" ")}
            >
              <span>{cell.day}</span>
              {count > 0 ? (
                <span
                  className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${
                    isChosen ? "bg-ui-fg-on-color" : "bg-ui-tag-orange-icon"
                  }`}
                  aria-hidden="true"
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {selected.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {selected.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className="bg-ui-bg-subtle text-ui-fg-subtle hover:bg-ui-bg-base-hover rounded-full px-2.5 py-1 text-xs"
              aria-label={`Odebrat ${key}`}
            >
              {(() => {
                const [, m, d] = key.split("-");
                return `${Number(d)}. ${Number(m)}.`;
              })()}{" "}
              ×
            </button>
          ))}
          <Button
            type="button"
            variant="transparent"
            size="small"
            onClick={() => onChange([])}
          >
            Zrušit výběr
          </Button>
        </div>
      ) : (
        <Text size="small" className="text-ui-fg-muted">
          {emptyHint}
        </Text>
      )}
    </div>
  );
};
