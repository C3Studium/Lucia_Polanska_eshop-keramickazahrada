import { Text, clx } from "@medusajs/ui";
import { Link } from "react-router-dom";

/**
 * The tab bar across the whole Přehled section.
 *
 * Everything the merchant does now lives behind one sidebar item. She has one
 * job — „what do I do now?" — and making her pick a *section* before she can
 * pick a task earned nothing.
 *
 * ## Why the bar is grouped
 *
 * Ten flat tabs is a navigation problem of its own: it wraps, and nothing tells
 * you which ones belong together, so every visit is a scan of ten words. The
 * groups below are the three questions she actually has — *what needs doing
 * today*, *what am I selling*, *how did it go* — and the separators make that
 * visible without adding a click.
 *
 * The dashboard stays first and alone. Its value is the glance, and a glance
 * that has to compete with a workspace stops being one.
 *
 * These are real routes, not local state, so every tab is addressable,
 * bookmarkable and survives a refresh.
 */
export type WorkTabKey =
  | "prehled"
  | "prace"
  | "zakazky"
  | "platby"
  | "produkty"
  | "zasoby"
  | "slevy"
  | "recenze"
  | "emaily"
  | "statistiky";

type Tab = { key: WorkTabKey; label: string; to: string };

/**
 * Group boundaries render as separators rather than captions — a bar with three
 * headings in it is louder than the tabs themselves.
 */
const groups: Tab[][] = [
  [{ key: "prehled", label: "Přehled", to: "/prehled" }],
  [
    { key: "prace", label: "Denní práce", to: "/prehled/prace" },
    { key: "zakazky", label: "Zakázky", to: "/prehled/zakazky" },
    { key: "platby", label: "Platby", to: "/prehled/platby" },
  ],
  [
    { key: "produkty", label: "Produkty", to: "/prehled/produkty" },
    { key: "zasoby", label: "Zásoby", to: "/prehled/zasoby" },
    { key: "slevy", label: "Slevy a akce", to: "/prehled/slevy" },
    { key: "recenze", label: "Recenze", to: "/prehled/recenze" },
  ],
  [
    { key: "emaily", label: "Odeslané e-maily", to: "/prehled/emaily" },
    { key: "statistiky", label: "Statistiky", to: "/prehled/statistiky" },
  ],
];

export const WorkTabs = ({ active }: { active: WorkTabKey }) => (
  <nav
    aria-label="Sekce"
    className="border-ui-border-base flex flex-wrap items-center gap-x-1 gap-y-1 border-b px-6 pb-3 pt-4"
  >
    {groups.map((group, index) => (
      <div key={index} className="flex flex-wrap items-center gap-x-1 gap-y-1">
        {index > 0 && (
          <span
            aria-hidden="true"
            className="bg-ui-border-base mx-2 hidden h-4 w-px sm:block"
          />
        )}
        {group.map((tab) => {
          const isActive = tab.key === active;

          return (
            <Link
              key={tab.key}
              to={tab.to}
              aria-current={isActive ? "page" : undefined}
              className={clx(
                "transition-fg rounded-md px-3 py-1.5 outline-none focus-visible:shadow-borders-focus",
                isActive
                  ? "bg-ui-bg-base-pressed text-ui-fg-base"
                  : "text-ui-fg-subtle hover:bg-ui-bg-base-hover hover:text-ui-fg-base"
              )}
            >
              <Text size="small" weight={isActive ? "plus" : "regular"}>
                {tab.label}
              </Text>
            </Link>
          );
        })}
      </div>
    ))}
  </nav>
);

/**
 * The secondary bar used inside a tab — Denní práce's stages, Recenze's
 * statuses, Zásoby's stock levels.
 *
 * Shared so every section's sub-navigation looks and behaves identically. That
 * sameness is what makes a tabbed admin feel like one product rather than
 * several stapled together.
 */
export type SubTab = {
  key: string;
  label: string;
  /** Rendered as a count. Omit where a number would be noise. */
  count?: number;
};

export const SubTabs = ({
  tabs,
  active,
  onSelect,
}: {
  tabs: SubTab[];
  active: string;
  onSelect: (key: string) => void;
}) => (
  <div className="flex flex-wrap items-center gap-2 px-6 py-4">
    {tabs.map((tab) => {
      const isActive = tab.key === active;

      return (
        <button
          key={tab.key}
          type="button"
          onClick={() => onSelect(tab.key)}
          aria-current={isActive ? "page" : undefined}
          className={clx(
            "transition-fg flex items-center gap-x-2 rounded-lg border px-3 py-2 outline-none focus-visible:shadow-borders-focus",
            isActive
              ? "border-ui-border-interactive bg-ui-bg-base-pressed"
              : "border-ui-border-base bg-ui-bg-base hover:bg-ui-bg-base-hover"
          )}
        >
          <Text size="small" weight={isActive ? "plus" : "regular"}>
            {tab.label}
          </Text>
          {typeof tab.count === "number" && tab.count > 0 && (
            <Text size="xsmall" className="text-ui-fg-muted">
              {tab.count}
            </Text>
          )}
        </button>
      );
    })}
  </div>
);
