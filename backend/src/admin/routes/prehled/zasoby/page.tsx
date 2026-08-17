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
import { Link, useSearchParams } from "react-router-dom";
import { EmptyState, pieces } from "../../../components/empty-state";
import { SubTabs, WorkTabs } from "../../../components/work-tabs";
import { sdk } from "../../../lib/sdk";

/**
 * Zásoby — what she has, what is running out, what is gone.
 *
 * ## Why restocking happens here rather than in native Sklad
 *
 * Native inventory is three clicks deep and asks for an absolute number: open
 * the item, open the location level, type what the total should now be. After
 * a firing she is holding six new mugs and thinking „six more", not „the total
 * is now fourteen" — and the arithmetic in between is where mistakes live.
 *
 * So the field here adds. She types 6, confirms, and the row updates. The
 * absolute number still exists on the native page for the times a count is
 * genuinely wrong.
 *
 * The rules behind the three tabs are the shared ones in
 * `lib/inventory-alerts.ts`, so this page, the Přehled tiles and the morning
 * job can never disagree about what „dochází" means.
 */

type StockRow = {
  variant_id: string;
  variant_title: string | null;
  product_id: string | null;
  product_title: string | null;
  sku: string | null;
  inventory_item_id: string | null;
  stocked: number;
  reserved: number;
  available: number;
  threshold: number;
  has_custom_threshold: boolean;
  location_id: string | null;
};

type StockResponse = {
  type: "low" | "out" | "ok";
  items: StockRow[];
  low_count: number;
  out_count: number;
  ok_count: number;
  default_threshold: number;
};

const tabs = [
  {
    key: "dochazi",
    type: "low" as const,
    label: "Dochází",
    empty: "Zásoby jsou v pořádku",
    emptyWhy: "Jakmile něčeho začne ubývat, objeví se to tady.",
  },
  {
    key: "vyprodano",
    type: "out" as const,
    label: "Vyprodáno",
    empty: "Nic není vyprodané",
    emptyWhy: "Jakmile něčeho zbude nula kusů, objeví se to tady.",
  },
  {
    key: "naskladnene",
    type: "ok" as const,
    label: "Naskladněné",
    empty: "Zatím nic naskladněného",
    emptyWhy: "Kusy, kterých máte dost, se objeví tady.",
  },
];

/**
 * „Přidat na sklad" — adds to what is there rather than replacing it.
 *
 * The native API takes an absolute `stocked_quantity`, so the addition happens
 * here: current + entered. That is the only arithmetic, and doing it for her is
 * the entire point of the control.
 */
const AddStock = ({ row }: { row: StockRow }) => {
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
      await queryClient.invalidateQueries({ queryKey: ["stock"] });
      await queryClient.invalidateQueries({ queryKey: ["operations-summary"] });
      toast.success(
        `Přidáno ${pieces(added)} — ${row.product_title ?? "produkt"}`
      );
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Zásoby se nepodařilo upravit"
      ),
  });

  // Without an item and a location there is nothing to update — better to show
  // nothing than a control that fails on click.
  if (!row.inventory_item_id) {
    return (
      <Text size="xsmall" className="text-ui-fg-muted">
        Upravit lze ve skladu
      </Text>
    );
  }

  const parsed = Number(amount);
  const isValid = Number.isFinite(parsed) && parsed > 0;

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (isValid) {
          add.mutate(Math.floor(parsed));
        }
      }}
    >
      <Input
        type="number"
        min={1}
        placeholder="+ ks"
        aria-label={`Přidat kusy — ${row.product_title ?? "produkt"}`}
        className="w-24"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
      />
      <Button
        size="small"
        type="submit"
        isLoading={add.isPending}
        disabled={!isValid}
      >
        Naskladnit
      </Button>
    </form>
  );
};

const ZasobyInner = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = tabs.find((tab) => tab.key === searchParams.get("stav")) ?? tabs[0];

  const { data, isLoading, isError } = useQuery<StockResponse>({
    queryKey: ["stock", active.type],
    queryFn: () =>
      sdk.client.fetch("/admin/inventory-alerts", {
        query: { type: active.type },
      }),
    refetchOnWindowFocus: true,
  });

  const rows = data?.items ?? [];

  return (
    <Container className="divide-y p-0">
      <WorkTabs active="zasoby" />

      <header className="px-6 pb-2 pt-6">
        <Heading>Zásoby</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
          Kolik čeho máte k prodeji. Napište, kolik kusů jste přidali, a my to
          připočteme — počítat celkový stav nemusíte.
        </Text>
      </header>

      <SubTabs
        active={active.key}
        onSelect={(key) =>
          setSearchParams(key === tabs[0].key ? {} : { stav: key }, {
            replace: true,
          })
        }
        tabs={tabs.map((tab) => ({
          key: tab.key,
          label: tab.label,
          count:
            tab.type === "low"
              ? data?.low_count
              : tab.type === "out"
                ? data?.out_count
                : data?.ok_count,
        }))}
      />

      {isLoading && (
        <div className="flex flex-col gap-y-3 px-6 py-5">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      )}

      {isError && (
        <EmptyState
          title="Zásoby se nepodařilo načíst"
          description="Zkuste stránku obnovit."
        />
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <EmptyState title={active.empty} description={active.emptyWhy} />
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <div className="divide-y">
          {rows.map((row) => (
            <article
              key={row.variant_id}
              className="grid gap-3 px-6 py-4 lg:grid-cols-[minmax(0,1.3fr)_repeat(3,80px)_minmax(220px,auto)] lg:items-center"
            >
              <div className="min-w-0">
                {row.product_id ? (
                  <Link
                    to={`/produkt/${row.product_id}`}
                    className="block w-fit max-w-full hover:underline"
                    title="Otevřít detail produktu"
                  >
                    <Text size="small" weight="plus" className="truncate">
                      {row.product_title ?? "Produkt"}
                    </Text>
                  </Link>
                ) : (
                  <Text size="small" weight="plus" className="truncate">
                    {row.product_title ?? "Produkt"}
                  </Text>
                )}
                <Text size="small" className="text-ui-fg-subtle truncate">
                  {row.variant_title ?? "Varianta"}
                  {row.sku ? ` · ${row.sku}` : ""}
                </Text>
                {row.product_id && (
                  <Link
                    to={`/produkt/${row.product_id}`}
                    className="text-ui-fg-interactive text-xs"
                  >
                    Otevřít produkt
                  </Link>
                )}
              </div>

              <div>
                <Text size="xsmall" className="text-ui-fg-muted">
                  Dostupné
                </Text>
                <Text
                  size="small"
                  weight="plus"
                  className={active.type === "out" ? "text-ui-fg-error" : undefined}
                >
                  {row.available}
                </Text>
              </div>

              <div>
                <Text size="xsmall" className="text-ui-fg-muted">
                  Skladem
                </Text>
                <Text size="small">{row.stocked}</Text>
              </div>

              <div>
                <Text size="xsmall" className="text-ui-fg-muted">
                  Rezervováno
                </Text>
                <Text size="small">{row.reserved}</Text>
              </div>

              <div className="flex flex-col items-start gap-1 lg:items-end">
                <AddStock row={row} />
                {row.has_custom_threshold && active.type === "low" && (
                  <Badge size="2xsmall">vlastní hranice {row.threshold}</Badge>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <Toaster />
    </Container>
  );
};

const queryClient = new QueryClient();

const ZasobyPage = () => (
  <QueryClientProvider client={queryClient}>
    <ZasobyInner />
  </QueryClientProvider>
);

export default ZasobyPage;
