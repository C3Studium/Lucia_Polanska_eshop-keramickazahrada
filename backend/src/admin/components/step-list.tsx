import { CheckMini } from "@medusajs/icons";
import { Text } from "@medusajs/ui";
import type { ReactNode } from "react";

/**
 * Očíslované kroky s čarou mezi nimi — stejný vzhled jako „Postup
 * objednávky" (StepRow ve widgets/order-steps.tsx), aby Lucie četla detail
 * výrobku i objednávky stejně: zelené kolečko s fajfkou = hotovo, modrý
 * kroužek = na řadě, šedé číslo = potom. Zkopírované, ne sdílené, protože
 * widget objednávky má vlastní typ kroku a nemá se kvůli výrobku měnit.
 */

export type StepState = "done" | "current" | "todo";

export const StepRow = ({
  state,
  index,
  last,
  title,
  compact = false,
  children,
}: {
  state: StepState;
  index: number;
  last: boolean;
  title: ReactNode;
  /** Menší kolečka a mezery — když je všechno hotové a kroky jen potvrzují. */
  compact?: boolean;
  children?: ReactNode;
}) => (
  <li className={`relative flex gap-x-3 last:pb-0 ${compact ? "pb-2" : "pb-5"}`}>
    {!last && (
      <span
        aria-hidden
        className={`absolute bottom-0 w-px ${
          compact ? "left-[9px] top-5" : "left-[13px] top-7"
        } ${state === "done" ? "bg-ui-tag-green-icon" : "bg-ui-border-base"}`}
      />
    )}
    <span
      aria-hidden
      className={`relative z-10 flex shrink-0 items-center justify-center rounded-full text-xs font-medium ${
        compact ? "size-5" : "size-7"
      } ${
        state === "done"
          ? "bg-ui-tag-green-icon text-ui-fg-on-color"
          : state === "current"
            ? "bg-ui-bg-base text-ui-fg-interactive ring-2 ring-ui-fg-interactive"
            : "bg-ui-bg-base text-ui-fg-muted ring-1 ring-ui-border-strong"
      }`}
    >
      {state === "done" ? <CheckMini /> : index + 1}
    </span>
    <div
      className={`flex min-w-0 flex-1 flex-col ${compact ? "gap-y-1" : "gap-y-1.5 pt-0.5"}`}
    >
      <Text
        size={compact ? "small" : "base"}
        weight={state === "current" ? "plus" : "regular"}
        className={
          state === "todo"
            ? "text-ui-fg-muted"
            : state === "done"
              ? "text-ui-fg-subtle"
              : ""
        }
      >
        <span className="sr-only">
          {state === "done" ? "Hotovo: " : state === "current" ? "Teď: " : "Později: "}
        </span>
        {title}
      </Text>
      {children}
    </div>
  </li>
);
