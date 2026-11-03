import { Container, Heading, Text, clx } from "@medusajs/ui";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import type { ComponentType, ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useExpertMode } from "../lib/expert-mode";
import { adminQueryClient } from "../lib/query-client";
import { sdk } from "../lib/sdk";

/**
 * Záložky pro položky menu, které sdružují víc stránek (3. 11. 2026).
 *
 * Menu mělo dvacet položek a nastavení, právní věci i odkazy na web se
 * v něm míchaly s denní prací. Teď je každá taková skupina jedna položka
 * a stránky v ní jsou záložky nahoře.
 *
 * ## Proč skutečné adresy, ne stav na stránce
 *
 * Stejně jako záložky Přehledu (`work-tabs.tsx`): každá záložka má svou
 * adresu, takže jde poslat odkazem, přežije obnovení stránky a položka
 * v menu svítí, protože adresa záložky začíná adresou položky.
 *
 * ## Staré adresy
 *
 * Na `/doprava-platba`, `/pravni-udaje` atd. vedou odkazy z Přehledu,
 * e-mailů a záložek v prohlížeči. Ty stránky dál existují, jen přesměrují
 * na svou záložku (i s `?…` a `#…`) — viz `movedTo`.
 */

export type SectionKey = "nastaveni" | "pravni" | "web";

type Tab = { key: string; label: string; to: string };

const SECTIONS: Record<SectionKey, { title: string; tabs: Tab[] }> = {
  nastaveni: {
    title: "Nastavení obchodu",
    tabs: [
      { key: "dovolena", label: "Dovolená a oznámení", to: "/nastaveni-obchodu" },
      { key: "doprava", label: "Doprava a platba", to: "/nastaveni-obchodu/doprava" },
      { key: "baleni", label: "Balení", to: "/nastaveni-obchodu/baleni" },
      { key: "emaily", label: "E-maily obchodu", to: "/nastaveni-obchodu/emaily" },
      {
        key: "zkusebni",
        label: "Zkušební režim",
        to: "/nastaveni-obchodu/zkusebni-rezim",
      },
    ],
  },
  pravni: {
    title: "Právní věci",
    tabs: [
      { key: "udaje", label: "Právní údaje", to: "/pravni" },
      { key: "dokumenty", label: "Dokumenty ke stažení", to: "/pravni/dokumenty" },
    ],
  },
  web: {
    title: "Web",
    tabs: [
      { key: "obsah", label: "Obsah webu", to: "/web" },
      { key: "navstevnost", label: "Návštěvnost", to: "/web/navstevnost" },
    ],
  },
};

/**
 * Zkušební režim zapíná a vypíná Matěj, ne Lucie — proto je jeho záložka
 * jen v expertním režimu. Výjimka: když obchod právě jede nanečisto, záložka
 * je vidět vždycky, ať se dá dohledat, proč se nevystavují faktury.
 */
const useTestModeVisible = (enabled: boolean): boolean => {
  const expert = useExpertMode();
  const { data } = useQuery<{ test_mode_enabled: boolean; comgate_test: boolean }>({
    queryKey: ["test-mode"],
    queryFn: () => sdk.client.fetch("/admin/workbench/test-mode"),
    enabled: enabled && !expert,
    retry: false,
  });
  return expert || Boolean(data?.test_mode_enabled || data?.comgate_test);
};

const SectionTabs = ({ section, active }: { section: SectionKey; active: string }) => {
  const { title, tabs } = SECTIONS[section];
  const testModeVisible = useTestModeVisible(section === "nastaveni");
  const visible = tabs.filter(
    (tab) => tab.key !== "zkusebni" || testModeVisible || tab.key === active
  );

  return (
    <Container className="p-0">
      <div className="px-6 pt-5">
        <Heading>{title}</Heading>
      </div>
      <nav
        aria-label={title}
        className="flex flex-wrap items-center gap-x-1 gap-y-1 px-6 pb-3 pt-3"
      >
        {visible.map((tab) => {
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
      </nav>
    </Container>
  );
};

/** Záložky nahoře, pod nimi obsah vybrané záložky (původní stránka). */
export const SectionPage = ({
  section,
  active,
  children,
}: {
  section: SectionKey;
  active: string;
  children: ReactNode;
}) => (
  <QueryClientProvider client={adminQueryClient}>
    <div className="flex flex-col gap-y-3">
      <SectionTabs section={section} active={active} />
      {children}
    </div>
  </QueryClientProvider>
);

/**
 * Stará adresa stránky → její záložka. Nahrazuje záznam v historii, takže
 * „Zpět" nevede znovu na přesměrování.
 */
export const movedTo = (pathname: string): ComponentType => {
  const Moved = () => {
    const { search, hash } = useLocation();
    return <Navigate to={{ pathname, search, hash }} replace />;
  };
  return Moved;
};
