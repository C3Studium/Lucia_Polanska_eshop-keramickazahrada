import { defineRouteConfig } from "@medusajs/admin-sdk";
import { CubeSolid } from "@medusajs/icons";
import {
  Badge,
  Container,
  Heading,
  Skeleton,
  Text,
} from "@medusajs/ui";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../components/empty-state";
import { SubTabs } from "../../components/work-tabs";
import { formatCount } from "../../lib/workbench";
import { sdk } from "../../lib/sdk";

/**
 * Sklad — the advanced inventory workbench (admin-advanced-plan.md).
 *
 * Přehled → Zásoby answers „what needs restocking?" and lets her add stock.
 * This page adds the question that orders a restocking day: **what do people
 * want?** Every row carries the two demand numbers no stock list had —
 * customers waiting on a restock e-mail, and wishlist saves — and sorts by
 * them, so the kiln queue starts with what sells itself.
 *
 * Adding stock stays in Přehled → Zásoby (the additive field); thresholds
 * stay on the inventory item. This page decides *what*; those decide *how*.
 */

type DemandRow = {
  variant_id: string;
  variant_title: string | null;
  product_id: string | null;
  product_title: string | null;
  sku: string | null;
  stocked: number;
  reserved: number;
  available: number;
  threshold: number;
  waiting_customers: number;
  wishlist_count: number;
};

type WorkbenchInventoryResponse = {
  out: DemandRow[];
  low: DemandRow[];
  ok: DemandRow[];
  default_threshold: number;
  waiting_total: number;
};

const tabs = [
  { key: "out", label: "Vyprodáno" },
  { key: "low", label: "Dochází" },
  { key: "ok", label: "Naskladněné" },
];

const SkladInner = () => {
  const [active, setActive] = useState<"out" | "low" | "ok">("out");

  const { data, isLoading, isError } = useQuery<WorkbenchInventoryResponse>({
    queryKey: ["workbench-inventory"],
    queryFn: () => sdk.client.fetch("/admin/workbench/inventory"),
    refetchOnWindowFocus: true,
  });

  const rows = data?.[active] ?? [];

  return (
    <Container className="divide-y p-0">
      <header className="flex flex-wrap items-start justify-between gap-3 px-6 pb-4 pt-6">
        <div>
          <div className="flex flex-wrap items-center gap-x-2">
            <Heading>Sklad — co vyrábět dřív</Heading>
            {data && data.waiting_total > 0 && (
              <Badge size="2xsmall" color="orange">
                {formatCount(
                  data.waiting_total,
                  "zákazník čeká",
                  "zákazníci čekají",
                  "zákazníků čeká"
                )}
              </Badge>
            )}
          </div>
          <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
            Seřazeno podle zájmu: nejdřív to, na co zákazníci čekají, pak co
            mají v oblíbených. Doplnit kusy jde v Přehledu → Zásoby.
          </Text>
        </div>
      </header>

      <SubTabs
        tabs={tabs.map((tab) => ({
          ...tab,
          count:
            tab.key === "out"
              ? data?.out.length
              : tab.key === "low"
                ? data?.low.length
                : data?.ok.length,
        }))}
        active={active}
        onSelect={(key) => setActive(key as typeof active)}
      />

      {isLoading && (
        <div className="flex flex-col gap-y-3 px-6 py-5">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      )}

      {isError && (
        <EmptyState
          title="Sklad se nepodařilo načíst"
          description="Zkuste stránku obnovit."
        />
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <EmptyState
          title={
            active === "out"
              ? "Nic není vyprodané"
              : active === "low"
                ? "Nic nedochází"
                : "Zatím nic naskladněného"
          }
          description="Jakmile se to změní, uvidíte to tady."
        />
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <div className="divide-y">
          {rows.map((row) => (
            <article
              key={row.variant_id}
              className="grid gap-3 px-6 py-4 lg:grid-cols-[minmax(0,1.4fr)_170px_220px_auto] lg:items-center"
            >
              <div className="min-w-0">
                <Text size="small" weight="plus" className="truncate">
                  {row.product_title || "—"}
                </Text>
                <Text size="xsmall" className="text-ui-fg-subtle mt-1 truncate">
                  {[row.variant_title, row.sku].filter(Boolean).join(" · ") ||
                    "bez varianty"}
                </Text>
              </div>

              <div>
                <Text size="small">
                  {row.available} skladem
                  {row.reserved > 0 ? ` · ${row.reserved} rezervováno` : ""}
                </Text>
                <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                  hlásí se při {row.threshold} a méně
                </Text>
              </div>

              <div>
                {row.waiting_customers > 0 ? (
                  <Badge size="2xsmall" color="orange">
                    {formatCount(
                      row.waiting_customers,
                      "zákazník čeká",
                      "zákazníci čekají",
                      "zákazníků čeká"
                    )}
                  </Badge>
                ) : (
                  <Text size="xsmall" className="text-ui-fg-muted">
                    nikdo nečeká
                  </Text>
                )}
                {row.wishlist_count > 0 && (
                  <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                    {row.wishlist_count}× v oblíbených
                  </Text>
                )}
              </div>

              <div className="flex justify-start lg:justify-end">
                <Link
                  to={`/prehled/zasoby?zalozka=${active === "out" ? "vyprodano" : active === "low" ? "dochazi" : "naskladnene"}`}
                  className="text-ui-fg-interactive txt-small hover:underline"
                >
                  Doplnit kusy
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </Container>
  );
};

const queryClient = new QueryClient();

const SkladWorkbenchPage = () => (
  <QueryClientProvider client={queryClient}>
    <SkladInner />
  </QueryClientProvider>
);

export const config = defineRouteConfig({
  label: "Sklad+",
  icon: CubeSolid,
});

export default SkladWorkbenchPage;
