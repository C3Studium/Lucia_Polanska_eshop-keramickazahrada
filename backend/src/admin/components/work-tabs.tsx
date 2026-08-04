import { Text, clx } from "@medusajs/ui";
import { Link, useLocation } from "react-router-dom";

/**
 * The tab bar across the whole Přehled section.
 *
 * Everything the merchant does in a day now lives under one sidebar item:
 * the dashboard, the order queues, the commissions and the sent e-mails. She
 * has one job — „what do I do now?" — and making her pick a *section* before
 * she can pick a *task* was a decision that earned nothing.
 *
 * The dashboard stays first on purpose. Its value is the glance, and a glance
 * that has to compete with a workspace stops being one; keeping it as the
 * landing tab means she still opens straight onto the answer, with the work one
 * click away rather than one section away.
 *
 * These are real routes rather than local state, so every tab is addressable,
 * bookmarkable and survives a refresh — the same reason the queues were
 * separate routes to begin with.
 */
export type WorkTabKey =
  | "prehled"
  | "prace"
  | "zakazky"
  | "platby"
  | "slevy"
  | "statistiky"
  | "emaily";

/**
 * Ordered by how often she needs them, not by how interesting they are: the
 * day's work first, the money next, the insight last. Statistiky sits at the
 * far end deliberately — it is for thinking about the shop, not running it.
 */
const tabs: Array<{ key: WorkTabKey; label: string; to: string }> = [
  { key: "prehled", label: "Přehled", to: "/prehled" },
  { key: "prace", label: "Denní práce", to: "/prehled/prace" },
  { key: "zakazky", label: "Zakázky", to: "/prehled/zakazky" },
  { key: "platby", label: "Platby", to: "/prehled/platby" },
  { key: "slevy", label: "Slevy a akce", to: "/prehled/slevy" },
  { key: "emaily", label: "Odeslané e-maily", to: "/prehled/emaily" },
  { key: "statistiky", label: "Statistiky", to: "/prehled/statistiky" },
];

export const WorkTabs = ({ active }: { active: WorkTabKey }) => {
  const location = useLocation();

  return (
    <nav
      aria-label="Sekce práce"
      className="border-ui-border-base flex flex-wrap items-center gap-x-1 gap-y-1 border-b px-6 pb-3 pt-4"
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;

        return (
          <Link
            key={tab.key}
            to={tab.to}
            state={{ from: location.pathname }}
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
    </nav>
  );
};
