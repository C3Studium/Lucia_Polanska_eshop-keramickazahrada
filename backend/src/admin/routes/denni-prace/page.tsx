import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ListCheckbox } from "@medusajs/icons";
import { Badge, Container, Heading, Skeleton, Text } from "@medusajs/ui";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  fetchQueue,
  stageMeta,
  stageRoutes,
  type MerchantOrdersResponse,
} from "../../components/merchant-order-queue";

const queryClient = new QueryClient();

/**
 * Landing page for the Denní práce section.
 *
 * The sidebar's parent item always links here, so it answers the only question that
 * matters on arrival: where is there work waiting? Each tile is one click into that
 * queue's own route.
 */
const OverviewInner = () => {
  // Any queue returns the same `summary` map, so one request covers every count.
  const summaryQuery = useQuery<MerchantOrdersResponse>({
    queryKey: ["merchant-orders", "summary"],
    queryFn: () => fetchQueue("received"),
  });
  const summary = summaryQuery.data?.summary;

  return (
    <Container className="divide-y p-0">
      <header className="px-6 py-5">
        <Heading>Denní práce</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-1 max-w-2xl">
          Jedna objednávka, jeden zřetelný další krok. Technické detaily zůstávají
          v detailu objednávky.
        </Text>
      </header>

      <div className="grid gap-px bg-ui-border-base sm:grid-cols-2 lg:grid-cols-3">
        {summaryQuery.isLoading &&
          stageRoutes.map((entry) => (
            <div key={entry.slug} className="bg-ui-bg-base px-6 py-5">
              <Skeleton className="h-16 rounded-lg" />
            </div>
          ))}

        {!summaryQuery.isLoading &&
          stageRoutes.map((entry) => {
            const count = summary?.[entry.stage] ?? 0;
            return (
              <Link
                key={entry.slug}
                to={`/denni-prace/${entry.slug}`}
                className="bg-ui-bg-base hover:bg-ui-bg-base-hover transition-fg flex flex-col gap-y-2 px-6 py-5 outline-none focus-visible:shadow-borders-focus"
              >
                <div className="flex items-center justify-between gap-x-2">
                  <Badge color={stageMeta[entry.stage].color}>
                    {stageMeta[entry.stage].label}
                  </Badge>
                  <Heading level="h2">{count}</Heading>
                </div>
                <Text size="small" className="text-ui-fg-subtle">
                  {entry.description}
                </Text>
              </Link>
            );
          })}
      </div>
    </Container>
  );
};

const DenniPraceOverview = () => (
  <QueryClientProvider client={queryClient}>
    <OverviewInner />
  </QueryClientProvider>
);

/**
 * Deliberately **no** `nested` property.
 *
 * `nested` would place this under the core Orders item, but the dashboard refuses to
 * render children of a route that declares `nested`
 * (`@medusajs/dashboard/src/dashboard-app/dashboard-app.tsx`). Denní práce is therefore a
 * top-level extension item, which is what allows the five stage routes below it to appear
 * in the sidebar at all.
 */
export const config = defineRouteConfig({
  label: "Denní práce",
  icon: ListCheckbox,
  rank: 0,
});

export default DenniPraceOverview;
