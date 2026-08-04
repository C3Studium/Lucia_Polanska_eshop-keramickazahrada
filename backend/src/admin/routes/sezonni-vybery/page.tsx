import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Calendar } from "@medusajs/icons";
import {
  Badge,
  Container,
  Heading,
  Skeleton,
  Tabs,
  Text,
} from "@medusajs/ui";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { useState } from "react";
import { EmptyState } from "../../components/empty-state";
import { formatDate } from "../../lib/format";
import { sdk } from "../../lib/sdk";

type SeasonalSelection = {
  id: string;
  title: string;
  handle: string;
  publication_status: "draft" | "published" | "archived";
  starts_at?: string | null;
  ends_at?: string | null;
  linked_price_list_id?: string | null;
  items?: Array<{ id: string }>;
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
    empty: "Zatím žádný naplánovaný výběr",
  },
  { key: "active", label: "Aktivní", empty: "Právě neběží žádný výběr" },
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
        <Heading>Sezónní výběry</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-1 max-w-2xl">
          Vánoční nebo jarní kolekce na úvodní stránce. Volitelně se slevou po
          dobu výběru.
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
          <Heading level="h2">Výběry se nepodařilo načíst</Heading>
          <Text size="small" className="text-ui-fg-error mt-1">
            Obnovte stránku a zkuste to znovu.
          </Text>
        </div>
      )}

      {!isLoading && !isError && visible.length === 0 && (
        <EmptyState
          title={selections.length === 0 ? "Zatím žádný výběr" : activeGroup.empty}
          description="Vytvořte např. „Vánoční kolekci“ — vyberete produkty, termín a volitelně slevu."
        />
      )}

      {!isLoading && !isError && visible.length > 0 && (
        <div className="divide-y">
          {visible.map((selection) => (
            <article
              key={selection.id}
              className="flex flex-col gap-y-1 px-6 py-4"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Heading level="h3">{selection.title}</Heading>
                {selection.linked_price_list_id && (
                  <Badge size="2xsmall" color="orange">
                    Se slevou
                  </Badge>
                )}
              </div>
              <Text size="small" className="text-ui-fg-subtle">
                {period(selection)} · {selection.items?.length ?? 0} produktů
              </Text>
            </article>
          ))}
        </div>
      )}
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
  label: "Sezónní výběry",
  icon: Calendar,
  rank: 40,
});

export default SezonniVyberyPage;
