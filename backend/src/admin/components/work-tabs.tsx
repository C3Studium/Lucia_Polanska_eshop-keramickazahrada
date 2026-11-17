import { Text, clx } from "@medusajs/ui";

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
  | "vraceni"
  | "emaily"
  | "statistiky";

/**
 * Lišta podzáložek Přehledu (Denní práce, Zakázky, Platby, Produkty…) je od
 * 17. 11. 2026 pryč — přání majitelky: „Přehled je jen přehled". Stejné
 * stránky má levé menu (Objednávky, Zakázky, Produkty, Sklad, Slevy,
 * Reklamace, E-maily, Statistiky), takže lišta byla druhá navigace navíc.
 * Komponenta zůstává, aby stránky, které ji vkládají, nemusely měnit kód;
 * `active` se jen nečte.
 */
export const WorkTabs = (_props: { active: WorkTabKey }) => null;

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
  /* Nízký segmentový přepínač (17. 11. 2026) — stejný jako záložky
     Produkty+ a období na Přehledu. Dřív řada vysokých karet, která na
     každé stránce zabírala skoro sto pixelů. */
  <div className="px-6 py-3">
    <div className="bg-ui-bg-subtle inline-flex max-w-full flex-wrap gap-0.5 rounded-lg p-0.5">
      {tabs.map((tab) => {
        const isActive = tab.key === active;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onSelect(tab.key)}
            aria-current={isActive ? "page" : undefined}
            className={clx(
              "transition-fg flex min-h-[34px] items-center gap-x-1.5 rounded-md px-3 outline-none focus-visible:shadow-borders-focus",
              isActive
                ? "bg-ui-bg-base shadow-elevation-card-rest"
                : "hover:bg-ui-bg-base-hover"
            )}
          >
            <Text
              size="small"
              weight={isActive ? "plus" : "regular"}
              className={isActive ? "text-ui-fg-base" : "text-ui-fg-subtle"}
            >
              {tab.label}
            </Text>
            {typeof tab.count === "number" && tab.count > 0 && (
              <Text size="xsmall" className="text-ui-fg-muted tabular-nums">
                {tab.count}
              </Text>
            )}
          </button>
        );
      })}
    </div>
  </div>
);
