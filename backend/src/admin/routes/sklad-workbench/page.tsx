import { defineRouteConfig } from "@medusajs/admin-sdk";
import { CubeSolid } from "@medusajs/icons";
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Skeleton,
  Text,
  Toaster,
  toast,
} from "@medusajs/ui";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../components/empty-state";
import { CopyId, ExpertToggle, useExpertMode } from "../../lib/expert-mode";
import { SubTabs } from "../../components/work-tabs";
import { formatCount } from "../../lib/workbench";
import { sdk } from "../../lib/sdk";
import { ViewSwitcher, useViewMode } from "../../lib/view-mode";

/**
 * Sklad — the advanced inventory workbench (admin-advanced-plan.md).
 *
 * Přehled → Zásoby answers „what needs restocking?" and lets her add stock.
 * This page adds the question that orders a restocking day: **what do people
 * want?** Every row carries the two demand numbers no stock list had —
 * customers waiting on a restock e-mail, and wishlist saves — and sorts by
 * them, so the kiln queue starts with what sells itself.
 *
 * Both writes live here too: the additive restock field (same contract as
 * Přehled → Zásoby — she types what came out of the kiln, the absolute total
 * is our arithmetic) and the alert threshold, edited inline where its effect
 * is seen but stored on the inventory item, the one place
 * `inventory-alerts.ts` reads.
 */

type DemandRow = {
  variant_id: string;
  variant_title: string | null;
  product_id: string | null;
  product_title: string | null;
  sku: string | null;
  inventory_item_id: string | null;
  location_id: string | null;
  stocked: number;
  reserved: number;
  available: number;
  threshold: number;
  has_custom_threshold: boolean;
  waiting_customers: number;
  wishlist_count: number;
};

/**
 * Additive restock, same contract as Přehled → Zásoby: she types how many
 * came out of the kiln, the absolute total is our arithmetic. The native API
 * takes an absolute number, which is exactly the number she should never
 * have to compute.
 */
const AddStock = ({ row }: { row: DemandRow }) => {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");

  const add = useMutation({
    mutationFn: (added: number) =>
      sdk.client.fetch(`/admin/workbench/inventory/add-stock`, {
        method: "POST",
        body: { inventory_item_id: row.inventory_item_id, quantity: added },
      }),
    onSuccess: async (_result, added) => {
      setAmount("");
      await queryClient.invalidateQueries({
        queryKey: ["workbench-inventory"],
      });
      toast.success(
        `Přidáno ${added} ks — ${row.product_title ?? "produkt"}${
          row.waiting_customers > 0
            ? `. Čekajícím zákazníkům odejde e-mail při ranní kontrole.`
            : ""
        }`
      );
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Zásoby se nepodařilo upravit"
      ),
  });

  if (!row.inventory_item_id) {
    return (
      <Text size="xsmall" className="text-ui-fg-muted">
        Upravit lze ve skladu
      </Text>
    );
  }

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const added = Number(amount);
        if (Number.isInteger(added) && added > 0) {
          add.mutate(added);
        }
      }}
    >
      <Input
        size="small"
        type="number"
        min={1}
        placeholder="+ ks"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        className="w-20"
      />
      <Button
        size="small"
        variant="secondary"
        type="submit"
        isLoading={add.isPending}
        disabled={!amount}
      >
        Přidat
      </Button>
    </form>
  );
};

/**
 * The per-variant alert threshold, edited where its effect is seen. Stored
 * on the inventory item's metadata — the single place `inventory-alerts.ts`
 * reads — so this page, the tiles and the morning job keep one definition
 * of „dochází".
 */
const ThresholdEditor = ({ row }: { row: DemandRow }) => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(row.threshold));

  const save = useMutation({
    mutationFn: (threshold: number) =>
      sdk.client.fetch(`/admin/inventory-items/${row.inventory_item_id}`, {
        method: "POST",
        body: { metadata: { low_stock_threshold: threshold } },
      }),
    onSuccess: async () => {
      setEditing(false);
      await queryClient.invalidateQueries({
        queryKey: ["workbench-inventory"],
      });
      toast.success("Hranice upozornění uložena.");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Hranici se nepodařilo uložit"
      ),
  });

  if (!row.inventory_item_id) {
    return null;
  }

  if (!editing) {
    return (
      <button
        type="button"
        className="text-ui-fg-subtle txt-xsmall hover:text-ui-fg-base text-left"
        onClick={() => {
          setValue(String(row.threshold));
          setEditing(true);
        }}
      >
        hlásí se při {row.threshold} a méně
        {row.has_custom_threshold ? " (vlastní)" : ""} ✎
      </button>
    );
  }

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const threshold = Number(value);
        if (Number.isInteger(threshold) && threshold >= 0) {
          save.mutate(threshold);
        }
      }}
    >
      <Input
        size="small"
        type="number"
        min={0}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="w-20"
        autoFocus
      />
      <Button size="small" variant="secondary" type="submit" isLoading={save.isPending}>
        Uložit
      </Button>
      <Button
        size="small"
        variant="transparent"
        type="button"
        onClick={() => setEditing(false)}
      >
        Zrušit
      </Button>
    </form>
  );
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
  { key: "statistiky", label: "Statistiky" },
];

/** Sklad+ → Statistiky: pieces, value in CZK, demand totals. */
const SkladStats = () => {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["workbench-inventory-statistics"],
    queryFn: () => sdk.client.fetch("/admin/workbench/inventory/statistics"),
    refetchOnWindowFocus: true,
  });
  if (isLoading || !data) {
    return (
      <div className="px-6 py-5">
        <Skeleton className="h-20 rounded-lg" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-y-2 px-6 py-5">
      <Text size="small" weight="plus">
        {data.pieces_in_stock} kusů na skladě · hodnota{" "}
        {new Intl.NumberFormat("cs-CZ", {
          style: "currency",
          currency: "CZK",
          maximumFractionDigits: 0,
        }).format(data.stock_value_czk)}
      </Text>
      <Text size="xsmall" className="text-ui-fg-subtle">
        {data.variants.out} variant vyprodáno · {data.variants.low} dochází ·{" "}
        {data.variants.ok} v pořádku
        {data.unpriced_variants > 0
          ? ` · ${data.unpriced_variants} bez ceny (do hodnoty nepočítáno)`
          : ""}
      </Text>
      <Text size="xsmall" className="text-ui-fg-subtle">
        Poptávka: {data.demand.waiting_customers} zákazníků čeká na
        naskladnění · {data.demand.wishlist_saves} uložení v oblíbených ·
        hlásí se při {data.default_threshold} a méně
      </Text>
    </div>
  );
};

const SkladInner = () => {
  const [active, setActive] = useState<"out" | "low" | "ok" | "statistiky">("out");
  const expert = useExpertMode();
  /* Řádky / kompakt — mřížka tu není: skladová data nenesou fotky. */
  const [view, changeView] = useViewMode("kz-view-sklad");

  const { data, isLoading, isError } = useQuery<WorkbenchInventoryResponse>({
    queryKey: ["workbench-inventory"],
    queryFn: () => sdk.client.fetch("/admin/workbench/inventory"),
    refetchOnWindowFocus: true,
  });

  const rows = active === "statistiky" ? [] : (data?.[active] ?? []);

  return (
    <Container className="divide-y p-0">
      <Toaster />
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
        <div className="flex flex-wrap items-center gap-3">
          <ViewSwitcher
            value={view}
            onChange={changeView}
            modes={["radky", "kompakt"]}
          />
          <ExpertToggle />
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

      {active === "statistiky" && <SkladStats />}

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

      {active !== "statistiky" && !isLoading && !isError && rows.length === 0 && (
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

      {/* Kompaktní — jen kus, stav a naskladnění; ideální na telefonu u pece. */}
      {!isLoading && !isError && rows.length > 0 && view === "kompakt" && (
        <div className="divide-y">
          {rows.map((row) => (
            <div
              key={row.variant_id}
              className="flex flex-wrap items-center gap-2 px-6 py-1.5"
            >
              <div className="min-w-0 flex-1">
                {row.product_id ? (
                  <Link
                    to={`/produkt/${row.product_id}`}
                    className="block w-fit max-w-full hover:underline"
                    title="Otevřít detail produktu"
                  >
                    <Text size="small" className="truncate">
                      {row.product_title || "—"}
                      {row.variant_title ? (
                        <span className="text-ui-fg-muted">
                          {" "}
                          · {row.variant_title}
                        </span>
                      ) : null}
                    </Text>
                  </Link>
                ) : (
                  <Text size="small" className="truncate">
                    {row.product_title || "—"}
                    {row.variant_title ? (
                      <span className="text-ui-fg-muted"> · {row.variant_title}</span>
                    ) : null}
                  </Text>
                )}
              </div>
              <Text size="xsmall" className="text-ui-fg-subtle tabular-nums">
                {row.available} ks
              </Text>
              {row.waiting_customers > 0 && (
                <Badge size="2xsmall" color="orange">
                  {row.waiting_customers} čeká
                </Badge>
              )}
              <AddStock row={row} />
            </div>
          ))}
        </div>
      )}

      {!isLoading && !isError && rows.length > 0 && view !== "kompakt" && (
        <div className="divide-y">
          {rows.map((row) => (
            <article
              key={row.variant_id}
              className="grid gap-3 px-6 py-4 lg:grid-cols-[minmax(0,1.4fr)_170px_220px_auto] lg:items-center"
            >
              <div className="min-w-0">
                {row.product_id ? (
                  <Link
                    to={`/produkt/${row.product_id}`}
                    className="block w-fit max-w-full hover:underline"
                    title="Otevřít detail produktu"
                  >
                    <Text size="small" weight="plus" className="truncate">
                      {row.product_title || "—"}
                    </Text>
                  </Link>
                ) : (
                  <Text size="small" weight="plus" className="truncate">
                    {row.product_title || "—"}
                  </Text>
                )}
                <Text size="xsmall" className="text-ui-fg-subtle mt-1 truncate">
                  {[row.variant_title, row.sku].filter(Boolean).join(" · ") ||
                    "bez varianty"}
                </Text>
                {expert && <CopyId value={row.variant_id} />}
              </div>

              <div>
                <Text size="small">
                  {row.available} skladem
                  {row.reserved > 0 ? ` · ${row.reserved} rezervováno` : ""}
                </Text>
                <div className="mt-1">
                  <ThresholdEditor row={row} />
                </div>
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
                <AddStock row={row} />
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
