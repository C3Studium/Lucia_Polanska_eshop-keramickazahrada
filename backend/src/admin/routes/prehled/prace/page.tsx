import { Badge, Container, Heading, Text, clx } from "@medusajs/ui";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  BackfillBanner,
  MerchantOrderQueue,
  fetchQueue,
  stageMeta,
  stageRoutes,
  type MerchantOrdersResponse,
  type MerchantOrderStage,
} from "../../../components/merchant-order-queue";
import { WorkTabs } from "../../../components/work-tabs";

/**
 * Denní práce, now a tab of Přehled rather than its own sidebar section.
 *
 * The five stages stay separate instead of collapsing into one list: they map
 * to physically different activities — the pack table, the post-office run —
 * and merging them would put work she cannot act on yet in front of work she
 * can.
 *
 * The stage lives in the query string rather than in component state, so a
 * queue stays addressable and refresh-safe (`/prehled/prace?krok=k-odeslani`),
 * which is what the separate routes bought before and what the Přehled tiles
 * link to.
 */
const DEFAULT_SLUG = stageRoutes[0].slug;

const StageTabs = ({
  activeSlug,
  onSelect,
  counts,
}: {
  activeSlug: string;
  onSelect: (slug: string) => void;
  counts?: Partial<Record<MerchantOrderStage, number>>;
}) => (
  <div className="flex flex-wrap items-center gap-2 px-6 py-4">
    {stageRoutes.map((entry) => {
      const isActive = entry.slug === activeSlug;
      const count = counts?.[entry.stage] ?? 0;

      return (
        <button
          key={entry.slug}
          type="button"
          onClick={() => onSelect(entry.slug)}
          aria-current={isActive ? "page" : undefined}
          className={clx(
            "transition-fg flex items-center gap-x-2 rounded-lg border px-3 py-2 outline-none focus-visible:shadow-borders-focus",
            isActive
              ? "border-ui-border-interactive bg-ui-bg-base-pressed"
              : "border-ui-border-base bg-ui-bg-base hover:bg-ui-bg-base-hover"
          )}
        >
          <Text size="small" weight={isActive ? "plus" : "regular"}>
            {stageMeta[entry.stage].label}
          </Text>
          {count > 0 && (
            <Badge size="2xsmall" color={stageMeta[entry.stage].color}>
              {count}
            </Badge>
          )}
        </button>
      );
    })}
  </div>
);

const PraceInner = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const requested = searchParams.get("krok");
  const active =
    stageRoutes.find((entry) => entry.slug === requested) ?? stageRoutes[0];

  // Any queue response carries the same `summary` map, so one request gives
  // every tab its count.
  const summaryQuery = useQuery<MerchantOrdersResponse>({
    queryKey: ["merchant-orders", "summary"],
    queryFn: () => fetchQueue("received"),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const select = (slug: string) => {
    setSearchParams(slug === DEFAULT_SLUG ? {} : { krok: slug }, {
      replace: true,
    });
  };

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="p-0">
        <WorkTabs active="prace" />

        <header className="px-6 pb-1 pt-5">
          <Heading>Denní práce</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
            Jedna objednávka, jeden zřetelný další krok. Technické detaily
            zůstávají v detailu objednávky.
          </Text>
        </header>

        <StageTabs
          activeSlug={active.slug}
          onSelect={select}
          counts={summaryQuery.data?.summary}
        />

        <BackfillBanner />
      </Container>

      <MerchantOrderQueue
        key={active.stage}
        stage={active.stage}
        description={active.description}
      />
    </div>
  );
};

const queryClient = new QueryClient();

const PracePage = () => (
  <QueryClientProvider client={queryClient}>
    <PraceInner />
  </QueryClientProvider>
);

export default PracePage;
