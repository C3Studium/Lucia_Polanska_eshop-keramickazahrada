import { Text } from "@medusajs/ui";
import { formatDateTime } from "../../lib/format";
import type { ClaimStep, ClaimStepState } from "../../lib/return-requests";

/**
 * Průběh žádosti — kroky podle případu (docs/reklamace-a-zruseni.md §12.5).
 * Kroky skládá server (`steps`); komponenta jen kreslí stav a datum. Když
 * server kroky neposlal, stránka si je dopočítá (`fallbackSteps`) a předá sem.
 */

const DOT: Record<ClaimStepState, string> = {
  done: "bg-ui-tag-green-icon",
  current: "bg-ui-tag-orange-icon",
  upcoming: "bg-ui-border-strong",
  skipped: "bg-ui-border-base",
};

export const Timeline = ({ steps }: { steps: ClaimStep[] }) => {
  if (steps.length === 0) {
    return (
      <Text size="small" className="text-ui-fg-muted">
        Průběh zatím není k dispozici.
      </Text>
    );
  }

  return (
    <ol className="flex flex-col gap-y-2">
      {steps.map((step, index) => {
        const state: ClaimStepState = step.state in DOT ? step.state : "upcoming";
        const muted = state === "upcoming" || state === "skipped";
        return (
          <li key={step.key || index} className="flex items-start gap-x-3">
            <span
              aria-hidden="true"
              className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[state]}`}
            />
            <div className="min-w-0">
              <Text
                size="small"
                weight={state === "current" ? "plus" : "regular"}
                className={muted ? "text-ui-fg-muted" : ""}
              >
                {step.label}
              </Text>
              {step.at && (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {formatDateTime(step.at)}
                </Text>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
};
