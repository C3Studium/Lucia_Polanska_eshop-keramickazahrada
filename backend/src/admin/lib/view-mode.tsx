import { GridList, ListBullet, QueueList } from "@medusajs/icons";
import { useState } from "react";

/**
 * Tři styly zobrazení seznamu — řádky / mřížka / kompaktní (2026-08-16).
 *
 * Born in Rozdělení and promoted to a shared control: every page that lists
 * pieces offers the same three ways to look at them. Řádky carry the full
 * controls, mřížka is photos side by side (2 columns on a phone), kompakt is
 * the dense scan-a-long-list view. The choice persists per page in
 * localStorage — same pattern as expert mode, one key per page so the shop
 * list and the packaging list can disagree.
 *
 * Pages where a photo grid means nothing (orders, customers) simply pass
 * `modes` without "mrizka" — the control renders only what makes sense.
 */

export type ViewMode = "radky" | "mrizka" | "kompakt";

const readStored = (storageKey: string, fallback: ViewMode): ViewMode => {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored === "radky" || stored === "mrizka" || stored === "kompakt"
      ? stored
      : fallback;
  } catch {
    return fallback;
  }
};

/** Per-page persisted view mode. `storageKey` names the page, e.g. "kz-view-produkty". */
export const useViewMode = (
  storageKey: string,
  fallback: ViewMode = "radky"
): [ViewMode, (next: ViewMode) => void] => {
  const [view, setView] = useState<ViewMode>(() =>
    readStored(storageKey, fallback)
  );
  const change = (next: ViewMode) => {
    setView(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // Private mode etc. — the choice just won't survive a reload.
    }
  };
  return [view, change];
};

const meta: Record<ViewMode, { label: string; short: string; Icon: typeof ListBullet }> = {
  radky: { label: "Řádky — plné ovládání", short: "Řádky", Icon: ListBullet },
  mrizka: { label: "Mřížka — fotky vedle sebe", short: "Mřížka", Icon: GridList },
  kompakt: { label: "Kompaktní — rychlé skenování", short: "Kompakt", Icon: QueueList },
};

/**
 * Why this control is more than three bare icons (2026-08-20).
 *
 * Lucia could not find it on Windows. Three things conspired, and all three are
 * fixed here rather than guessing which one it was:
 *
 * 1. **It could be squeezed away.** The toolbars it lives in are `flex-wrap`
 *    rows, and a flex child shrinks by default. At the ~1100px CSS width a
 *    1920px Windows screen has at 150% scale, the row ran out of space and this
 *    box — the only one without an intrinsic minimum — was the one that gave.
 *    `shrink-0` means it now pushes the row to wrap instead of collapsing.
 * 2. **It did not read as a control.** Muted grey glyphs on a muted background,
 *    with the current mode marked only by a faintly different fill. The active
 *    button now sits on a raised card and the group carries a „Zobrazení" label
 *    wherever there is room for one.
 * 3. **It was mouse-only in practice.** The mode was announced through `title`,
 *    which never reaches a screen reader and only appears after a hover the
 *    length of a coffee. Each button now has a real accessible name and
 *    `aria-pressed`, and the group is a labelled radio-style toolbar.
 */
export const ViewSwitcher = ({
  value,
  onChange,
  modes = ["radky", "mrizka", "kompakt"],
  showLabel = true,
  className = "",
}: {
  value: ViewMode;
  onChange: (next: ViewMode) => void;
  modes?: ViewMode[];
  /** Off for rows that are already tight — the icons keep their own names. */
  showLabel?: boolean;
  /** Placement only, e.g. `ml-auto` to push the control to the end of its row. */
  className?: string;
}) => (
  <div
    role="group"
    aria-label="Způsob zobrazení"
    className={`border-ui-border-base bg-ui-bg-subtle flex shrink-0 items-center gap-0.5 rounded-lg border p-1 ${className}`}
  >
    {showLabel && (
      <span className="text-ui-fg-muted txt-xsmall hidden select-none pl-1 pr-1 sm:inline">
        Zobrazení
      </span>
    )}
    {modes.map((mode) => {
      const { label, short, Icon } = meta[mode];
      const isActive = value === mode;
      return (
        <button
          key={mode}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={isActive}
          onClick={() => onChange(mode)}
          className={
            isActive
              ? "bg-ui-bg-base text-ui-fg-base shadow-elevation-card-rest flex items-center gap-1 rounded-md px-1.5 py-1"
              : "text-ui-fg-subtle hover:bg-ui-bg-base-hover hover:text-ui-fg-base flex items-center gap-1 rounded-md px-1.5 py-1"
          }
        >
          <Icon />
          {/* The name of the mode you are in, spelled out — the icons alone
              never said which of the three „mřížka" was. Only the active one
              carries it, so the control stays the width of three buttons. */}
          {isActive && showLabel && (
            <span className="txt-xsmall hidden select-none pr-0.5 md:inline">
              {short}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

/** The shared responsive grid wrapper — 2 columns on a phone, up to 4 wide. */
export const gridClassName =
  "grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 2xl:grid-cols-4";
