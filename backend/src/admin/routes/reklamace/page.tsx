import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ArrowUturnLeft } from "@medusajs/icons";
import {
  Badge,
  Button,
  Checkbox,
  Container,
  Heading,
  Input,
  Select,
  Skeleton,
  Table,
  Text,
  Toaster,
} from "@medusajs/ui";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { EmptyState } from "../../components/empty-state";
import { DamageBadge } from "../../components/return-line-items";
import { SubTabs } from "../../components/work-tabs";
import { formatDateTime } from "../../lib/format";
import { adminQueryClient } from "../../lib/query-client";
import {
  asNumber,
  deadlineInfo,
  formatLineItems,
  isDamageCause,
  isFinalStatus,
  isReturnKind,
  isReturnStatus,
  KIND_META,
  lineItemsQuantity,
  lineItemsTotal,
  reklamaceLink,
  RESOLUTION_LABEL,
  STATUS_META,
  type ReturnKind,
  type ReturnRequestCounts,
  type ReturnRequestListResponse,
  type ReturnStatus,
} from "../../lib/return-requests";
import { sdk } from "../../lib/sdk";
import { formatCzk } from "../../lib/workbench";

/**
 * Reklamace a zrušení — jeden modul pro reklamace, vrácení zboží a odstoupení
 * od smlouvy (docs/reklamace-a-zruseni.md, §8, §12).
 *
 * Tohle je seznam: taby podle stavu s počty, filtr druhu, hledání, stránkování.
 * Klik na řádek (nebo „Detail") otevře stránku žádosti `/reklamace/:id`
 * (`routes/reklamace/[id]/page.tsx`), kde jsou akce, položky, platby i
 * zakázka. Drawer tu už není. Staré hluboké odkazy `?status=&id=` se
 * přesměrují na stránku.
 */

const STATUS_TABS: { key: ReturnStatus; label: string }[] = [
  { key: "pending", label: "Nové" },
  { key: "approved", label: "Schválené – čeká na zboží" },
  { key: "received", label: "Zboží přijato" },
  { key: "resolved", label: "Vyřízené" },
  { key: "rejected", label: "Zamítnuté" },
  { key: "cancelled", label: "Stornované" },
];

const KIND_FILTERS: { value: "all" | ReturnKind; label: string }[] = [
  { value: "all", label: "Vše" },
  { value: "reklamace", label: "Reklamace" },
  { value: "vraceni", label: "Vrácení" },
  { value: "odstoupeni", label: "Odstoupení" },
];

const PAGE_SIZE = 25;

const ReklamaceInner = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [active, setActive] = useState<ReturnStatus>(() => {
    const fromUrl = searchParams.get("status");
    return isReturnStatus(fromUrl) ? fromUrl : "pending";
  });
  const [kind, setKind] = useState<"all" | ReturnKind>("all");
  // „Jen poškozené přepravou" — pošle se serveru (až ho bude umět) a pro
  // jistotu se přefiltruje i načtená stránka.
  const [damagedOnly, setDamagedOnly] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);

  // Hluboký odkaz: `?status=` přepne tab; `?id=` (starý tvar z widgetu /
  // Přehledu / e-mailů) přesměruje na stránku žádosti.
  useEffect(() => {
    const status = searchParams.get("status");
    const id = searchParams.get("id");
    if (id) {
      navigate(reklamaceLink({ id }), { replace: true });
      return;
    }
    if (isReturnStatus(status)) {
      setActive(status);
      setOffset(0);
    }
  }, [searchParams, navigate]);

  /* Vstup se mění hned; dotaz odejde 350 ms po poslední klávese. */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setOffset(0);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const countsQuery = useQuery<ReturnRequestCounts>({
    queryKey: ["return-requests", "counts"],
    queryFn: () => sdk.client.fetch("/admin/return-requests/counts"),
    refetchOnWindowFocus: true,
  });

  const listQuery = useQuery<ReturnRequestListResponse>({
    queryKey: ["return-requests", "list", active, kind, search, damagedOnly, offset],
    queryFn: () =>
      sdk.client.fetch("/admin/return-requests", {
        query: {
          status: active,
          ...(kind !== "all" ? { kind } : {}),
          ...(damagedOnly ? { damage_cause: "carrier" } : {}),
          ...(search ? { q: search } : {}),
          limit: PAGE_SIZE,
          offset,
        },
      }),
    refetchOnWindowFocus: true,
  });

  const rows = (listQuery.data?.return_requests ?? []).filter(
    (row) => !damagedOnly || isDamageCause(row.damage_cause)
  );
  const total = listQuery.data?.count ?? 0;
  const counts = countsQuery.data;

  const selectTab = (key: string) => {
    if (isReturnStatus(key)) {
      setActive(key);
      setOffset(0);
    }
  };

  const openDetail = (id: string) => navigate(reklamaceLink({ id }));

  return (
    <Container className="divide-y p-0">
      <Toaster />
      <header className="flex flex-wrap items-start justify-between gap-3 px-6 pb-4 pt-6">
        <div>
          <Heading>Reklamace a zrušení</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
            Reklamace, vrácení zboží a odstoupení od smlouvy na jednom místě.
            Každá žádost jde cestou rozhodnutí → zboží zpět → vrácení peněz →
            potvrzení o vyřízení. Peníze se nikdy nevrací samy — jen na stránce
            žádosti, tlačítkem.
          </Text>
          {counts && counts.overdue > 0 && (
            <div className="mt-3">
              <Badge size="2xsmall" color="red">
                Po lhůtě: {counts.overdue}
              </Badge>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            size="small"
            value={kind}
            onValueChange={(value) => {
              setKind(isReturnKind(value) ? value : "all");
              setOffset(0);
            }}
          >
            <Select.Trigger className="w-44">
              <Select.Value placeholder="Druh" />
            </Select.Trigger>
            <Select.Content>
              {KIND_FILTERS.map((filter) => (
                <Select.Item key={filter.value} value={filter.value}>
                  {filter.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Input
            size="small"
            type="search"
            placeholder="Hledat číslo objednávky, e-mail, jméno…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="w-72"
          />
          <label className="flex items-center gap-x-2">
            <Checkbox
              checked={damagedOnly}
              onCheckedChange={(checked) => {
                setDamagedOnly(checked === true);
                setOffset(0);
              }}
            />
            <Text size="small">Jen poškozené přepravou</Text>
          </label>
        </div>
      </header>

      <SubTabs
        tabs={STATUS_TABS.map((tab) => ({
          key: tab.key,
          label: tab.label,
          count: counts?.[tab.key],
        }))}
        active={active}
        onSelect={selectTab}
      />

      {listQuery.isLoading && (
        <div className="flex flex-col gap-y-3 px-6 py-5">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      )}

      {listQuery.isError && (
        <div className="flex min-h-48 flex-col items-center justify-center gap-y-3 px-6 text-center">
          <Heading level="h2">Žádosti se nepodařilo načíst</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {listQuery.error instanceof Error ? listQuery.error.message : ""}
          </Text>
          <Button size="small" variant="secondary" onClick={() => listQuery.refetch()}>
            Zkusit znovu
          </Button>
        </div>
      )}

      {!listQuery.isLoading && !listQuery.isError && rows.length === 0 && (
        <EmptyState
          title={
            search || kind !== "all" || damagedOnly
              ? "Nic neodpovídá filtru"
              : active === "pending"
                ? "Žádné nové žádosti"
                : `V tomto stavu nic není`
          }
          description={
            search || kind !== "all" || damagedOnly
              ? "Zkuste jiný druh nebo jiné hledání."
              : active === "pending"
                ? "Jakmile zákazník uplatní reklamaci, vrácení nebo odstoupení přes e-shop, objeví se tady a dostanete upozornění e-mailem."
                : "Žádosti se sem přesunou, až budou v tomto stavu."
          }
        />
      )}

      {!listQuery.isLoading && !listQuery.isError && rows.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Objednávka</Table.HeaderCell>
                <Table.HeaderCell>Zákazník</Table.HeaderCell>
                <Table.HeaderCell>Druh</Table.HeaderCell>
                <Table.HeaderCell>Stav</Table.HeaderCell>
                <Table.HeaderCell>Lhůta</Table.HeaderCell>
                <Table.HeaderCell>Zbývá vrátit</Table.HeaderCell>
                <Table.HeaderCell>Přijato</Table.HeaderCell>
                <Table.HeaderCell />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map((request) => {
                const deadline = isFinalStatus(request.status)
                  ? null
                  : deadlineInfo(request.resolve_by);
                const remaining = asNumber(request.remaining);
                const refunded = asNumber(request.refunded_total);
                return (
                  <Table.Row
                    key={request.id}
                    className="cursor-pointer"
                    onClick={(event) => {
                      // Klik na řádek otevře stránku žádosti; odkazy a tlačítka
                      // v řádku si svou akci nechají.
                      if ((event.target as HTMLElement).closest("a, button")) {
                        return;
                      }
                      openDetail(request.id);
                    }}
                  >
                    <Table.Cell>
                      <Button size="small" variant="transparent" asChild>
                        <Link to={`/orders/${request.order_id}`}>
                          #{request.order_display_id}
                        </Link>
                      </Button>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small">{request.customer_name ?? "—"}</Text>
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        {request.email}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      {request.kind && (
                        <Badge size="2xsmall" color={KIND_META[request.kind].color}>
                          {KIND_META[request.kind].label}
                        </Badge>
                      )}
                      {isDamageCause(request.damage_cause) && (
                        <div className="mt-1">
                          <DamageBadge cause={request.damage_cause} />
                        </div>
                      )}
                      {request.line_items && request.line_items.length > 0 && (
                        <Text
                          size="xsmall"
                          className="text-ui-fg-subtle mt-1"
                          title={formatLineItems(request.line_items)}
                        >
                          {lineItemsQuantity(request.line_items)} ks ·{" "}
                          {formatCzk(lineItemsTotal(request.line_items))}
                        </Text>
                      )}
                      {request.kind === "reklamace" && request.requested_resolution && (
                        <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                          žádá: {RESOLUTION_LABEL[request.requested_resolution]}
                        </Text>
                      )}
                      {request.resolution && request.status !== "pending" && (
                        <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                          rozhodnuto: {RESOLUTION_LABEL[request.resolution]}
                        </Text>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <Badge size="2xsmall" color={STATUS_META[request.status].color}>
                        {STATUS_META[request.status].label}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      {deadline ? (
                        <Badge size="2xsmall" color={deadline.color}>
                          {deadline.label}
                        </Badge>
                      ) : (
                        <Text size="xsmall" className="text-ui-fg-muted">
                          —
                        </Text>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <Text
                        size="small"
                        weight={remaining > 0 && !isFinalStatus(request.status) ? "plus" : "regular"}
                        className={remaining > 0 && !isFinalStatus(request.status) ? "" : "text-ui-fg-subtle"}
                      >
                        {formatCzk(remaining)}
                      </Text>
                      {refunded > 0 && (
                        <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                          vráceno {formatCzk(refunded)}
                        </Text>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small" className="text-ui-fg-subtle whitespace-nowrap">
                        {formatDateTime(request.created_at)}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex justify-end">
                        <Button size="small" variant="secondary" asChild>
                          <Link to={reklamaceLink(request)}>Detail</Link>
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        </div>
      )}

      {!listQuery.isLoading && !listQuery.isError && total > PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <Text size="small" className="text-ui-fg-subtle">
            Zobrazeno {offset + 1}–{Math.min(offset + rows.length, total)} z {total}
          </Text>
          <div className="flex gap-2">
            <Button
              size="small"
              variant="secondary"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              Předchozí
            </Button>
            <Button
              size="small"
              variant="secondary"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Další
            </Button>
          </div>
        </div>
      )}
    </Container>
  );
};

const ReklamacePage = () => (
  <QueryClientProvider client={adminQueryClient}>
    <ReklamaceInner />
  </QueryClientProvider>
);

export const config = defineRouteConfig({
  label: "Reklamace a zrušení",
  icon: ArrowUturnLeft,
  rank: 15,
});

export default ReklamacePage;
