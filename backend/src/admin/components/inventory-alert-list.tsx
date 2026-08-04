import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Label,
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
import { EmptyState, pieces } from "./empty-state";
import { sdk } from "../lib/sdk";

/**
 * Nízký stav and Vyprodáno (§10, §22, P7-1).
 *
 * One component for both, because they are the same list with a different
 * threshold — and because the two pages disagreeing about what a row means
 * would be worse than either being slightly wrong.
 *
 * Rows come from `/admin/inventory-alerts`, which shares its rules with the
 * Přehled tiles. Until this existed the tile counted low stock correctly while
 * the page always said „Zásoby jsou v pořádku" — a contradiction that teaches
 * someone not to trust the dashboard.
 */

export type InventoryAlertRow = {
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
};

type AlertsResponse = {
  type: "low" | "out";
  items: InventoryAlertRow[];
  low_count: number;
  out_count: number;
  default_threshold: number;
};

/** The shop-wide threshold, editable inline — §22's „Hranice: {n} — Změnit". */
const ThresholdControl = ({ current }: { current: number }) => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(current));

  const save = useMutation({
    mutationFn: (threshold: number) =>
      sdk.client.fetch("/admin/merchant-settings", {
        method: "POST",
        body: { low_stock_default_threshold: threshold },
      }),
    onSuccess: async () => {
      toast.success("Hranice upozornění byla uložena");
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["inventory-alerts"] });
      await queryClient.invalidateQueries({ queryKey: ["merchant-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["operations-summary"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Hranici se nepodařilo uložit"
      );
    },
  });

  if (!editing) {
    return (
      <div className="flex items-center gap-x-2">
        <Text size="small" className="text-ui-fg-subtle">
          Upozorníme vás, když zbude {pieces(current)} nebo méně.
        </Text>
        <Button size="small" variant="transparent" onClick={() => setEditing(true)}>
          Změnit
        </Button>
      </div>
    );
  }

  const parsed = Number(value);
  const isValid = Number.isFinite(parsed) && parsed >= 0 && parsed <= 10_000;

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (isValid) {
          save.mutate(Math.floor(parsed));
        }
      }}
    >
      <div className="flex flex-col gap-y-1">
        <Label size="xsmall" htmlFor="threshold">
          Upozornit, když zbude méně než
        </Label>
        <Input
          id="threshold"
          type="number"
          min={0}
          max={10000}
          className="w-28"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </div>
      <Button size="small" type="submit" isLoading={save.isPending} disabled={!isValid}>
        Uložit
      </Button>
      <Button
        size="small"
        variant="secondary"
        type="button"
        onClick={() => {
          setValue(String(current));
          setEditing(false);
        }}
      >
        Zrušit
      </Button>
    </form>
  );
};

const AlertRow = ({ row, type }: { row: InventoryAlertRow; type: "low" | "out" }) => (
  <article className="grid gap-3 px-6 py-4 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,90px)_auto] lg:items-center">
    <div className="min-w-0">
      <Text size="small" weight="plus" className="truncate">
        {row.product_title ?? "Produkt"}
      </Text>
      <Text size="small" className="text-ui-fg-subtle truncate">
        {row.variant_title ?? "Varianta"}
        {row.sku ? ` · ${row.sku}` : ""}
      </Text>
    </div>

    <div>
      <Text size="xsmall" className="text-ui-fg-muted">
        Dostupné
      </Text>
      <Text
        size="small"
        weight="plus"
        className={type === "out" ? "text-ui-fg-error" : undefined}
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

    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
      {row.has_custom_threshold && type === "low" && (
        <Badge size="2xsmall">vlastní hranice {row.threshold}</Badge>
      )}
      {row.inventory_item_id && (
        <Button size="small" variant="secondary" asChild>
          <Link to={`/inventory/${row.inventory_item_id}`}>Upravit zásoby</Link>
        </Button>
      )}
    </div>
  </article>
);

const AlertListInner = ({
  type,
  title,
  description,
  emptyTitle,
  emptyDescription,
}: {
  type: "low" | "out";
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
}) => {
  const { data, isLoading, isError, refetch } = useQuery<AlertsResponse>({
    queryKey: ["inventory-alerts", type],
    queryFn: () =>
      sdk.client.fetch("/admin/inventory-alerts", { query: { type } }),
    refetchOnWindowFocus: true,
  });

  const items = data?.items ?? [];

  return (
    <Container className="divide-y p-0">
      <header className="px-6 pb-4 pt-6">
        <div className="flex flex-wrap items-center gap-x-2">
          <Heading>{title}</Heading>
          {items.length > 0 && (
            <Badge size="2xsmall" color={type === "out" ? "red" : "orange"}>
              {items.length}
            </Badge>
          )}
        </div>
        <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
          {description}
        </Text>
        {type === "low" && data && (
          <div className="mt-3">
            <ThresholdControl current={data.default_threshold} />
          </div>
        )}
      </header>

      {isLoading && (
        <div className="flex flex-col gap-y-3 px-6 py-5">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      )}

      {isError && (
        <div className="flex min-h-48 flex-col items-center justify-center gap-y-3 px-6 py-10 text-center">
          <Heading level="h2">Zásoby se nepodařilo načíst</Heading>
          <Button size="small" variant="secondary" onClick={() => refetch()}>
            Zkusit znovu
          </Button>
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      )}

      {!isLoading && !isError && items.length > 0 && (
        <div className="divide-y">
          {items.map((row) => (
            <AlertRow key={row.variant_id} row={row} type={type} />
          ))}
        </div>
      )}

      <Toaster />
    </Container>
  );
};

const queryClient = new QueryClient();

export const InventoryAlertList = (
  props: Parameters<typeof AlertListInner>[0]
) => (
  <QueryClientProvider client={queryClient}>
    <AlertListInner {...props} />
  </QueryClientProvider>
);
