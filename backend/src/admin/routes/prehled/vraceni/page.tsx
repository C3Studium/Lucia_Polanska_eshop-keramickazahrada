import {
  Badge,
  Button,
  Container,
  Heading,
  Skeleton,
  Text,
} from "@medusajs/ui";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { EmptyState } from "../../../components/empty-state";
import { WorkTabs } from "../../../components/work-tabs";
import { formatDateTime } from "../../../lib/format";
import { adminQueryClient } from "../../../lib/query-client";
import {
  asNumber,
  deadlineInfo,
  KIND_META,
  reklamaceLink,
  STATUS_META,
  type ReturnRequestCounts,
  type ReturnRequestListResponse,
  type ReturnStatus,
} from "../../../lib/return-requests";
import { sdk } from "../../../lib/sdk";
import { formatCzk } from "../../../lib/workbench";

/**
 * Přehled → Reklamace: krátký souhrn + odkaz do modulu „Reklamace a zrušení".
 *
 * Dřív tu byla celá fronta s tlačítky Schválit / Vrátit peníze / Zamítnout.
 * Ta obcházela pravidla nového modulu (peníze až po zboží, refundace jen ve
 * správném stavu), proto se odsud nic nerozhoduje — jen se ukáže, co čeká, a
 * jedním klikem se otevře správný tab a detail v modulu.
 */

const TILES: { status: ReturnStatus; label: string; hint: string }[] = [
  { status: "pending", label: "Nové", hint: "čekají na rozhodnutí" },
  { status: "approved", label: "Čeká na zboží", hint: "schválené, zboží na cestě" },
  { status: "received", label: "Zboží přijato", hint: "vrátit peníze / vyřídit" },
];

const VraceniInner = () => {
  const countsQuery = useQuery<ReturnRequestCounts>({
    queryKey: ["return-requests", "counts"],
    queryFn: () => sdk.client.fetch("/admin/return-requests/counts"),
  });

  const openQuery = useQuery<ReturnRequestListResponse>({
    queryKey: ["return-requests", "prehled-open"],
    queryFn: () =>
      sdk.client.fetch("/admin/return-requests", {
        query: { status: "open", limit: 10 },
      }),
  });

  const counts = countsQuery.data;
  const open = openQuery.data?.return_requests ?? [];
  const openTotal = openQuery.data?.count ?? open.length;

  return (
    <Container className="divide-y p-0">
      <WorkTabs active="vraceni" />

      <header className="flex flex-wrap items-start justify-between gap-3 px-6 pb-4 pt-6">
        <div>
          <Heading>Reklamace a vrácení</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
            Reklamace, vrácení zboží a odstoupení od smlouvy se vyřizují v
            modulu Reklamace a zrušení — tady je jen přehled, co čeká. Peníze se
            nikdy nevrací samy.
          </Text>
        </div>
        <Button size="base" asChild>
          <Link to="/reklamace">Otevřít Reklamace a zrušení</Link>
        </Button>
      </header>

      <section className="grid gap-3 px-6 py-5 sm:grid-cols-2 lg:grid-cols-4">
        {TILES.map((tile) => (
          <Link
            key={tile.status}
            to={`/reklamace?status=${tile.status}`}
            className="border-ui-border-base hover:bg-ui-bg-base-hover focus-visible:shadow-borders-focus flex flex-col gap-y-1 rounded-lg border p-4 outline-none transition-colors"
          >
            <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
              {tile.label}
            </Text>
            {countsQuery.isLoading ? (
              <Skeleton className="h-7 w-10 rounded" />
            ) : (
              <Heading level="h2">{counts?.[tile.status] ?? 0}</Heading>
            )}
            <Text size="xsmall" className="text-ui-fg-subtle">
              {tile.hint}
            </Text>
          </Link>
        ))}
        <Link
          to="/reklamace?status=pending"
          className="border-ui-border-base hover:bg-ui-bg-base-hover focus-visible:shadow-borders-focus flex flex-col gap-y-1 rounded-lg border p-4 outline-none transition-colors"
        >
          <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
            Po lhůtě
          </Text>
          {countsQuery.isLoading ? (
            <Skeleton className="h-7 w-10 rounded" />
          ) : (
            <Heading
              level="h2"
              className={(counts?.overdue ?? 0) > 0 ? "text-ui-fg-error" : ""}
            >
              {counts?.overdue ?? 0}
            </Heading>
          )}
          <Text size="xsmall" className="text-ui-fg-subtle">
            zákonná lhůta uplynula
          </Text>
        </Link>
      </section>

      <section className="px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Heading level="h2">Otevřené žádosti</Heading>
          {openTotal > open.length && (
            <Text size="xsmall" className="text-ui-fg-subtle">
              Zobrazeno {open.length} z {openTotal} — vše v modulu.
            </Text>
          )}
        </div>

        {openQuery.isLoading && (
          <div className="mt-3 flex flex-col gap-y-2">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
        )}

        {openQuery.isError && (
          <Text size="small" className="text-ui-fg-error mt-3">
            Žádosti se nepodařilo načíst:{" "}
            {openQuery.error instanceof Error ? openQuery.error.message : "neznámá chyba"}
          </Text>
        )}

        {!openQuery.isLoading && !openQuery.isError && open.length === 0 && (
          <EmptyState
            title="Nic nečeká"
            description="Jakmile zákazník uplatní reklamaci, vrácení nebo odstoupení přes e-shop, objeví se tady a dostanete upozornění e-mailem."
          />
        )}

        {!openQuery.isLoading && !openQuery.isError && open.length > 0 && (
          <div className="mt-3 divide-y">
            {open.map((request) => {
              const deadline = deadlineInfo(request.resolve_by);
              const remaining = asNumber(request.remaining);
              return (
                <article
                  key={request.id}
                  className="grid gap-2 py-3 lg:grid-cols-[90px_minmax(0,1fr)_auto_150px_auto] lg:items-center"
                >
                  <Text size="small" weight="plus">
                    #{request.order_display_id}
                  </Text>
                  <div className="min-w-0">
                    <Text size="small" className="truncate">
                      {request.customer_name || request.email}
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-subtle truncate">
                      {request.reason}
                    </Text>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {request.kind && (
                      <Badge size="2xsmall" color={KIND_META[request.kind].color}>
                        {KIND_META[request.kind].label}
                      </Badge>
                    )}
                    <Badge size="2xsmall" color={STATUS_META[request.status].color}>
                      {STATUS_META[request.status].label}
                    </Badge>
                    {deadline && (
                      <Badge size="2xsmall" color={deadline.color}>
                        {deadline.label}
                      </Badge>
                    )}
                    {remaining > 0 && (
                      <Badge size="2xsmall" color="grey">
                        zbývá {formatCzk(remaining)}
                      </Badge>
                    )}
                  </div>
                  <Text size="xsmall" className="text-ui-fg-muted lg:text-right">
                    {formatDateTime(request.created_at)}
                  </Text>
                  <div className="flex lg:justify-end">
                    <Button size="small" variant="secondary" asChild>
                      <Link to={reklamaceLink(request)}>Vyřídit</Link>
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </Container>
  );
};

const queryClient = adminQueryClient;

const VraceniPage = () => (
  <QueryClientProvider client={queryClient}>
    <VraceniInner />
  </QueryClientProvider>
);

export default VraceniPage;
