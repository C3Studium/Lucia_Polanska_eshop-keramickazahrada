import { Badge, Button, Container, Heading, Skeleton, Text } from "@medusajs/ui";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { EmptyState } from "../../../components/empty-state";
import { WorkTabs } from "../../../components/work-tabs";
import { formatDate } from "../../../lib/format";
import { sdk } from "../../../lib/sdk";

type DiscountRow = {
  id: string;
  kind: "selection" | "price_list" | "code" | "automatic";
  title: string;
  detail: string | null;
  status: "running" | "scheduled" | "ended";
  starts_at: string | null;
  ends_at: string | null;
  ends_in_days: number | null;
  edit_path: string;
};

type DiscountsResponse = { discounts: DiscountRow[]; running: number };

/** §13's four instruments, named the way she would name them. */
const kindMeta: Record<
  DiscountRow["kind"],
  { label: string; color: "orange" | "blue" | "green" | "purple" }
> = {
  selection: { label: "Sezónní akce", color: "orange" },
  price_list: { label: "Akční ceník", color: "blue" },
  code: { label: "Slevový kód", color: "green" },
  automatic: { label: "Automatická sleva", color: "purple" },
};

const statusMeta: Record<
  DiscountRow["status"],
  { label: string; color: "green" | "grey" | "orange" }
> = {
  running: { label: "Běží", color: "green" },
  scheduled: { label: "Naplánováno", color: "orange" },
  ended: { label: "Skončilo", color: "grey" },
};

const period = (row: DiscountRow): string | null => {
  if (!row.starts_at && !row.ends_at) {
    return null;
  }
  return `${formatDate(row.starts_at)} – ${formatDate(row.ends_at)}`;
};

const SlevyInner = () => {
  const { data, isLoading, isError } = useQuery<DiscountsResponse>({
    queryKey: ["operations-discounts"],
    queryFn: () => sdk.client.fetch("/admin/operations/discounts"),
    refetchOnWindowFocus: true,
  });

  const rows = data?.discounts ?? [];

  return (
    <Container className="divide-y p-0">
      <WorkTabs active="slevy" />

      <header className="px-6 pb-4 pt-6">
        <div className="flex flex-wrap items-center gap-x-2">
          <Heading>Slevy a akce</Heading>
          {data?.running ? (
            <Badge size="2xsmall" color="green">
              {data.running} běží
            </Badge>
          ) : null}
        </div>
        <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
          Všechno, co právě dělá nákup levnějším — na jednom místě. Upravovat se
          každá sleva chodí tam, kde vznikla, aby cenu měnilo vždy jen jedno
          místo.
        </Text>
      </header>

      {isLoading && (
        <div className="flex flex-col gap-y-3 px-6 py-5">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      )}

      {isError && (
        <EmptyState
          title="Slevy se nepodařilo načíst"
          description="Zkuste stránku obnovit."
        />
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <EmptyState
          title="Nic není zlevněné"
          description="Sezónní akci vytvoříte v Sezónních akcích, slevový kód v Propagaci."
          action={
            <Button size="small" variant="secondary" asChild>
              <Link to="/sezonni-vybery">Sezónní akce</Link>
            </Button>
          }
        />
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <div className="divide-y">
          {rows.map((row) => (
            <article
              key={`${row.kind}:${row.id}`}
              className="grid gap-3 px-6 py-4 lg:grid-cols-[minmax(0,1.2fr)_170px_190px_auto] lg:items-center"
            >
              <div className="min-w-0">
                <Text size="small" weight="plus" className="truncate">
                  {row.title}
                </Text>
                {row.detail && (
                  <Text size="small" className="text-ui-fg-subtle mt-1">
                    {row.detail}
                  </Text>
                )}
              </div>

              <div>
                <Badge size="2xsmall" color={kindMeta[row.kind].color}>
                  {kindMeta[row.kind].label}
                </Badge>
              </div>

              <div>
                <Badge size="2xsmall" color={statusMeta[row.status].color}>
                  {statusMeta[row.status].label}
                </Badge>
                {period(row) && (
                  <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                    {period(row)}
                  </Text>
                )}
                {row.status === "running" &&
                  row.ends_in_days !== null &&
                  row.ends_in_days <= 7 && (
                    <Text size="xsmall" className="text-ui-fg-error mt-1">
                      {row.ends_in_days <= 0
                        ? "končí dnes"
                        : `končí za ${row.ends_in_days} dní`}
                    </Text>
                  )}
              </div>

              <div className="flex justify-start lg:justify-end">
                <Button size="small" variant="secondary" asChild>
                  <Link to={row.edit_path}>Upravit</Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </Container>
  );
};

const queryClient = new QueryClient();

/**
 * Slevy a akce — the answer to „what is discounted right now?".
 *
 * §13 describes four instruments that each live on their own page. That is fine
 * while creating one, and useless when the question spans all four — which is
 * the question anyone actually asks. This view answers it; editing still
 * happens where each instrument was created, so exactly one place can change a
 * price.
 */
const SlevyPage = () => (
  <QueryClientProvider client={queryClient}>
    <SlevyInner />
  </QueryClientProvider>
);

export default SlevyPage;
