import {
  Badge,
  Button,
  Container,
  Heading,
  Prompt,
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
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "../../../components/empty-state";
import { SubTabs, WorkTabs } from "../../../components/work-tabs";
import { formatDate } from "../../../lib/format";
import { sdk } from "../../../lib/sdk";

/**
 * Recenze, now a tab of Přehled rather than its own sidebar section.
 *
 * Every review is moderated by hand (D5), so this is a work queue like any
 * other and belongs with the rest of the work. Its own sidebar entry made
 * moderation feel like a separate job; it is not, it is ten seconds between
 * packing two orders.
 *
 * Four states, and the moderation actions differ per state — which is the whole
 * reason for the sub-tabs. „Nové k potvrzení" is where the work is, so it is
 * the default; the other three are archives she visits on purpose.
 */

type ReviewStatus =
  | "čeká na schválení"
  | "schváleno"
  | "zamítnuto"
  | "archivováno";

type Review = {
  id: string;
  title?: string | null;
  content: string;
  rating: number;
  status: ReviewStatus;
  created_at: string;
  first_name?: string | null;
  last_name?: string | null;
  customer_id?: string | null;
  product_id: string;
  product?: { title?: string | null; thumbnail?: string | null } | null;
};

const tabs: Array<{
  key: string;
  label: string;
  status: ReviewStatus;
  empty: string;
  emptyWhy: string;
}> = [
  {
    key: "nove",
    label: "Nové k potvrzení",
    status: "čeká na schválení",
    empty: "Žádné recenze nečekají",
    emptyWhy: "Po doručení objednávky zákazníky sami poprosíme o recenzi.",
  },
  {
    key: "povolene",
    label: "Povolené",
    status: "schváleno",
    empty: "Zatím jste žádnou recenzi nepovolili",
    emptyWhy: "Povolené recenze uvidí zákazníci u produktu.",
  },
  {
    key: "nepovolene",
    label: "Nepovolené",
    status: "zamítnuto",
    empty: "Žádnou recenzi jste nezamítli",
    emptyWhy: "Zamítnuté recenze se v e-shopu nikde nezobrazí.",
  },
  {
    key: "archivovane",
    label: "Archivované",
    status: "archivováno",
    empty: "Archiv je prázdný",
    emptyWhy: "Sem si odkládáte recenze, které už nechcete mít před sebou.",
  },
];

const Stars = ({ rating }: { rating: number }) => {
  const rounded = Math.round(Number(rating) || 0);
  return (
    <Text size="small" aria-label={`Hodnocení ${rounded} z 5`}>
      {"★".repeat(rounded)}
      <span className="text-ui-fg-muted">{"★".repeat(Math.max(0, 5 - rounded))}</span>
    </Text>
  );
};

/**
 * The actions available depend on where the review already is. Offering
 * „Povolit" on something already approved is a button that does nothing, and a
 * button that does nothing teaches her to distrust the others.
 */
const actionsFor = (
  status: ReviewStatus
): Array<{ to: ReviewStatus; label: string; variant: "primary" | "secondary"; confirm?: string }> => {
  switch (status) {
    case "čeká na schválení":
      return [
        { to: "schváleno", label: "Povolit", variant: "primary" },
        {
          to: "zamítnuto",
          label: "Nepovolit",
          variant: "secondary",
          confirm: "Recenze se zákazníkovi nikde nezobrazí. Pokračovat?",
        },
      ];
    case "schváleno":
      return [
        {
          to: "zamítnuto",
          label: "Skrýt z e-shopu",
          variant: "secondary",
          confirm: "Recenze zmizí z produktu. Pokračovat?",
        },
        { to: "archivováno", label: "Archivovat", variant: "secondary" },
      ];
    case "zamítnuto":
      return [
        { to: "schváleno", label: "Přece jen povolit", variant: "secondary" },
        { to: "archivováno", label: "Archivovat", variant: "secondary" },
      ];
    case "archivováno":
      return [{ to: "čeká na schválení", label: "Vrátit k posouzení", variant: "secondary" }];
  }
};

const RowActions = ({ review }: { review: Review }) => {
  const queryClient = useQueryClient();

  const move = useMutation({
    mutationFn: (status: ReviewStatus) =>
      sdk.client.fetch("/admin/reviews/status", {
        method: "POST",
        body: { ids: [review.id], status },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reviews"] });
      await queryClient.invalidateQueries({ queryKey: ["operations-summary"] });
      toast.success("Hotovo");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Změnu se nepodařilo uložit"
      ),
  });

  return (
    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
      {actionsFor(review.status).map((action) =>
        action.confirm ? (
          <Prompt key={action.to}>
            <Prompt.Trigger asChild>
              <Button size="small" variant={action.variant}>
                {action.label}
              </Button>
            </Prompt.Trigger>
            <Prompt.Content>
              <Prompt.Header>
                <Prompt.Title>{action.label}?</Prompt.Title>
                <Prompt.Description>{action.confirm}</Prompt.Description>
              </Prompt.Header>
              <Prompt.Footer>
                <Prompt.Cancel>Zpět</Prompt.Cancel>
                <Prompt.Action onClick={() => move.mutate(action.to)}>
                  {action.label}
                </Prompt.Action>
              </Prompt.Footer>
            </Prompt.Content>
          </Prompt>
        ) : (
          <Button
            key={action.to}
            size="small"
            variant={action.variant}
            isLoading={move.isPending}
            onClick={() => move.mutate(action.to)}
          >
            {action.label}
          </Button>
        )
      )}
    </div>
  );
};

const RecenzeInner = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const active =
    tabs.find((tab) => tab.key === searchParams.get("stav")) ?? tabs[0];

  const { data, isLoading, isError } = useQuery<{
    reviews: Review[];
    count: number;
  }>({
    queryKey: ["reviews", active.status],
    queryFn: () =>
      sdk.client.fetch("/admin/reviews", {
        query: { status: active.status, limit: 50, order: "-created_at" },
      }),
    refetchOnWindowFocus: true,
  });

  // One request gives the pending count, which is the only one worth badging —
  // the archives do not need a number to be understood.
  const pending = useQuery<{ count: number }>({
    queryKey: ["reviews", "pending-count"],
    queryFn: () =>
      sdk.client.fetch("/admin/reviews", {
        query: { status: "čeká na schválení", limit: 1 },
      }),
  });

  const reviews = data?.reviews ?? [];

  return (
    <Container className="divide-y p-0">
      <WorkTabs active="recenze" />

      <header className="px-6 pb-2 pt-6">
        <Heading>Recenze</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
          Než se recenze objeví u produktu, musíte ji povolit. Nic se nezveřejní
          samo.
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
            tab.status === "čeká na schválení" ? pending.data?.count : undefined,
        }))}
      />

      {isLoading && (
        <div className="flex flex-col gap-y-3 px-6 py-5">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
      )}

      {isError && (
        <EmptyState
          title="Recenze se nepodařilo načíst"
          description="Zkuste stránku obnovit."
        />
      )}

      {!isLoading && !isError && reviews.length === 0 && (
        <EmptyState title={active.empty} description={active.emptyWhy} />
      )}

      {!isLoading && !isError && reviews.length > 0 && (
        <div className="divide-y">
          {reviews.map((review) => (
            <article
              key={review.id}
              className="grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1.6fr)_180px_minmax(260px,auto)] lg:items-start"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Stars rating={review.rating} />
                  {review.customer_id && (
                    <Badge size="2xsmall" color="green">
                      Ověřený nákup
                    </Badge>
                  )}
                </div>
                {review.title && (
                  <Text size="small" weight="plus" className="mt-2">
                    {review.title}
                  </Text>
                )}
                <Text size="small" className="text-ui-fg-subtle mt-1">
                  {review.content}
                </Text>
                <Text size="xsmall" className="text-ui-fg-muted mt-2">
                  {[review.first_name, review.last_name]
                    .filter(Boolean)
                    .join(" ") || "Zákazník"}{" "}
                  · {formatDate(review.created_at)}
                </Text>
              </div>

              <div className="flex items-center gap-x-2">
                {review.product?.thumbnail && (
                  <img
                    src={review.product.thumbnail}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded object-cover"
                  />
                )}
                <a
                  href={`/app/products/${review.product_id}`}
                  className="text-ui-fg-interactive text-sm"
                >
                  {review.product?.title ?? "Produkt"}
                </a>
              </div>

              <RowActions review={review} />
            </article>
          ))}
        </div>
      )}

      <Toaster />
    </Container>
  );
};

const queryClient = new QueryClient();

const RecenzePage = () => (
  <QueryClientProvider client={queryClient}>
    <RecenzeInner />
  </QueryClientProvider>
);

export default RecenzePage;
