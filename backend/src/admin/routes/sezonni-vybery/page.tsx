import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Calendar } from "@medusajs/icons";
import {
  Badge,
  Container,
  Heading,
  Select,
  Skeleton,
  Tabs,
  Text,
  Toaster,
  toast,
} from "@medusajs/ui";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { EmptyState } from "../../components/empty-state";
import { formatDate } from "../../lib/format";
import { sdk } from "../../lib/sdk";

type SeasonalItem = {
  id: string;
  product_id: string;
  product?: { id: string; title?: string | null; thumbnail?: string | null } | null;
  /** Set when the product is a bundle — a sale on it discounts its contents too. */
  bundle?: { id: string; title: string } | null;
};

type SeasonalSelection = {
  id: string;
  title: string;
  handle: string;
  publication_status: "draft" | "published" | "archived";
  starts_at?: string | null;
  ends_at?: string | null;
  linked_price_list_id?: string | null;
  /** What happens to the products when the sale finishes. */
  on_end?: "keep_selling" | "hide_products";
  items?: SeasonalItem[];
};

type SeasonalSelectionsResponse = {
  seasonal_selections: SeasonalSelection[];
  count: number;
};

type GroupKey = "planned" | "active" | "archived";

const groups: Array<{ key: GroupKey; label: string; empty: string }> = [
  {
    key: "planned",
    label: "Naplánované",
    empty: "Zatím žádná naplánovaná akce",
  },
  { key: "active", label: "Aktivní", empty: "Právě neběží žádná akce" },
  { key: "archived", label: "Archivované", empty: "Archiv je zatím prázdný" },
];

/**
 * Which section a selection belongs to — status first, then the dates.
 *
 * A published selection whose `ends_at` has passed is over, whatever the status
 * column still says; the auto-archive job (P9-4) will catch up with it. Showing
 * it under „Aktivní" until then would be wrong.
 */
const groupOf = (selection: SeasonalSelection, now: number): GroupKey => {
  if (selection.publication_status === "archived") {
    return "archived";
  }

  if (selection.publication_status === "draft") {
    return "planned";
  }

  const endsAt = selection.ends_at ? new Date(selection.ends_at).getTime() : null;
  if (endsAt !== null && endsAt < now) {
    return "archived";
  }

  const startsAt = selection.starts_at
    ? new Date(selection.starts_at).getTime()
    : null;
  if (startsAt !== null && startsAt > now) {
    return "planned";
  }

  return "active";
};

const period = (selection: SeasonalSelection): string => {
  if (!selection.starts_at && !selection.ends_at) {
    return "Bez termínu";
  }
  return `${formatDate(selection.starts_at)} – ${formatDate(selection.ends_at)}`;
};

/**
 * What happens to the products when this sale ends.
 *
 * A Vánoční kolekce ends and the pieces go back to full price — they are still
 * good stock. A **výprodej** ends because the pieces are gone, and leaving them
 * published means listings nobody can buy. Those want opposite behaviour, so
 * she says which this is rather than the system guessing.
 */
const OnEndControl = ({ selection }: { selection: SeasonalSelection }) => {
  const queryClient = useQueryClient();
  const value = selection.on_end ?? "keep_selling";

  const save = useMutation({
    mutationFn: (onEnd: string) =>
      sdk.client.fetch(
        `/admin/merchant-catalog/seasonal-selections/${selection.id}`,
        { method: "PATCH", body: { on_end: onEnd } }
      ),
    onSuccess: async () => {
      toast.success("Uloženo");
      await queryClient.invalidateQueries({ queryKey: ["seasonal-selections"] });
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Nepodařilo se uložit"
      ),
  });

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Text size="small" className="text-ui-fg-subtle">
        Až akce skončí:
      </Text>
      <Select
        size="small"
        value={value}
        onValueChange={(next) => save.mutate(next)}
      >
        <Select.Trigger className="w-64">
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="keep_selling">
            Vrátit na běžnou cenu a prodávat dál
          </Select.Item>
          <Select.Item value="hide_products">
            Schovat produkty z e-shopu (výprodej)
          </Select.Item>
        </Select.Content>
      </Select>
    </div>
  );
};

const queryClient = new QueryClient();

const SezonniVyberyInner = () => {
  const [group, setGroup] = useState<GroupKey>("active");

  // The whole list is small (a handful of seasons a year), so it is fetched
  // once and grouped here — the grouping depends on dates, which the server
  // filter by `publication_status` alone cannot express.
  const { data, isLoading, isError } = useQuery<SeasonalSelectionsResponse>({
    queryKey: ["seasonal-selections"],
    queryFn: () =>
      sdk.client.fetch("/admin/merchant-catalog/seasonal-selections", {
        query: { limit: 100 },
      }),
  });

  const now = Date.now();
  const selections = data?.seasonal_selections ?? [];
  const visible = selections.filter(
    (selection) => groupOf(selection, now) === group
  );
  const activeGroup = groups.find((entry) => entry.key === group) ?? groups[0];

  return (
    <Container className="divide-y p-0">
      <header className="px-6 py-5">
        <Heading>Sezónní akce</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
          Vánoční nebo jarní kolekce na úvodní stránce. Volitelně se slevou po
          dobu akce.
        </Text>
      </header>

      <Tabs value={group} onValueChange={(value) => setGroup(value as GroupKey)}>
        <Tabs.List className="px-6 py-4">
          {groups.map((entry) => (
            <Tabs.Trigger key={entry.key} value={entry.key}>
              {entry.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs>

      {isLoading && (
        <div className="flex flex-col gap-y-3 px-6 py-5">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
      )}

      {isError && (
        <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
          <Heading level="h2">Akce se nepodařilo načíst</Heading>
          <Text size="small" className="text-ui-fg-error mt-1">
            Obnovte stránku a zkuste to znovu.
          </Text>
        </div>
      )}

      {!isLoading && !isError && visible.length === 0 && (
        <EmptyState
          title={selections.length === 0 ? "Zatím žádná akce" : activeGroup.empty}
          description="Vytvořte např. „Vánoční kolekci“ — vyberete produkty, termín a volitelně slevu."
        />
      )}

      {!isLoading && !isError && visible.length > 0 && (
        <div className="divide-y">
          {visible.map((selection) => {
            const items = selection.items ?? [];
            const bundles = items.filter((item) => item.bundle);

            return (
              <article
                key={selection.id}
                className="flex flex-col gap-y-3 px-6 py-5"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Heading level="h3">{selection.title}</Heading>
                    {selection.linked_price_list_id && (
                      <Badge size="2xsmall" color="orange">
                        Se slevou
                      </Badge>
                    )}
                  </div>
                  <Text size="small" className="text-ui-fg-subtle mt-1">
                    {period(selection)} · {items.length} produktů
                    {bundles.length > 0 ? ` · ${bundles.length} balíčků` : ""}
                  </Text>
                </div>

                {items.length > 0 && (
                  <ul className="flex flex-col gap-y-1">
                    {items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center gap-x-2"
                      >
                        {item.product?.thumbnail ? (
                          <img
                            src={item.product.thumbnail}
                            alt=""
                            className="h-6 w-6 shrink-0 rounded object-cover"
                          />
                        ) : (
                          <div className="bg-ui-bg-subtle h-6 w-6 shrink-0 rounded" />
                        )}
                        <Text size="small" className="min-w-0 truncate">
                          {item.product?.title ?? "Produkt"}
                        </Text>
                        {item.bundle && (
                          <Badge size="2xsmall" color="purple">
                            Balíček
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {bundles.length > 0 && selection.linked_price_list_id && (
                  <Text size="small" className="text-ui-fg-subtle">
                    Sleva na balíček zlevní i produkty, které jsou v něm.
                  </Text>
                )}

                <OnEndControl selection={selection} />
              </article>
            );
          })}
        </div>
      )}

      <Toaster />
    </Container>
  );
};

/**
 * Sezónní výběry (§13, §22).
 *
 * P1-3 puts the section in place with a truthful read-only overview over the
 * API that already exists; **P9-3 adds the five-step wizard**, the sale
 * linkage and the overlap check, and P9-4 the auto-archive job. There is no
 * „+ Nový výběr" button yet on purpose — a button that opens nothing is worse
 * than no button.
 */
const SezonniVyberyPage = () => (
  <QueryClientProvider client={queryClient}>
    <SezonniVyberyInner />
  </QueryClientProvider>
);

export const config = defineRouteConfig({
  label: "Sezónní akce",
  icon: Calendar,
  rank: 40,
});

export default SezonniVyberyPage;
