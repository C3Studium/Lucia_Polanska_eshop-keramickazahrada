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

const meta: Record<ViewMode, { label: string; Icon: typeof ListBullet }> = {
  radky: { label: "Řádky — plné ovládání", Icon: ListBullet },
  mrizka: { label: "Mřížka — fotky vedle sebe", Icon: GridList },
  kompakt: { label: "Kompaktní — rychlé skenování", Icon: QueueList },
};

export const ViewSwitcher = ({
  value,
  onChange,
  modes = ["radky", "mrizka", "kompakt"],
}: {
  value: ViewMode;
  onChange: (next: ViewMode) => void;
  modes?: ViewMode[];
}) => (
  <div className="border-ui-border-base flex items-center gap-0.5 rounded-lg border p-0.5">
    {modes.map((mode) => {
      const { label, Icon } = meta[mode];
      return (
        <button
          key={mode}
          type="button"
          title={label}
          onClick={() => onChange(mode)}
          className={
            value === mode
              ? "bg-ui-bg-base-pressed text-ui-fg-base rounded-md p-1"
              : "text-ui-fg-muted hover:text-ui-fg-base rounded-md p-1"
          }
        >
          <Icon />
        </button>
      );
    })}
  </div>
);

/** The shared responsive grid wrapper — 2 columns on a phone, up to 4 wide. */
export const gridClassName =
  "grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 2xl:grid-cols-4";
