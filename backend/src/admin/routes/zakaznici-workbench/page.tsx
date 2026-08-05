import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Users } from "@medusajs/icons";
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Skeleton,
  Text,
  Textarea,
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
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../components/empty-state";
import { CopyId, ExpertToggle, RawData, useExpertMode } from "../../lib/expert-mode";
import { SubTabs } from "../../components/work-tabs";
import { formatCzk } from "../../lib/workbench";
import { formatDate } from "../../lib/format";
import { sdk } from "../../lib/sdk";

/**
 * Zákazníci — the advanced customer workbench (admin-advanced-plan.md).
 *
 * The native list is a phone book; this answers „who is this person to the
 * shop?" — orders, lifetime value, unpaid balances, newsletter, wishlist,
 * reviews — one row per customer, joined from the five modules that each
 * hold a piece. The filters are the questions she actually asks: who owes a
 * doplatek, who keeps coming back, who reads the newsletter.
 *
 * `lifetime_value` is money asked (order totals); the captured-vs-total
 * story lives on the orders workbench, where shipping decisions are made.
 */

type WorkbenchCustomer = {
  id: string;
  email: string;
  name: string | null;
  registered_at: string;
  orders_count: number;
  lifetime_value: number;
  last_order_at: string | null;
  outstanding: number;
  wishlist_size: number;
  reviews_written: number;
  newsletter: boolean;
};

type WorkbenchCustomersResponse = {
  customers: WorkbenchCustomer[];
  count: number;
};

/**
 * Everything the shop has sent this customer, plus a private note.
 *
 * The note goes to the native customer record's metadata — the one canonical
 * place — so it survives this page and shows nowhere a customer could see
 * it. Failures in the e-mail list are shown deliberately: a send that failed
 * is the answer to „proč mi nic nepřišlo?".
 */
const CustomerDrawer = ({
  customer,
  trigger,
}: {
  customer: WorkbenchCustomer;
  trigger: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();

  const { data: emails, isLoading: emailsLoading } = useQuery<{
    emails: { template: string; status: string; created_at: string }[];
  }>({
    queryKey: ["workbench-customer-emails", customer.id],
    queryFn: () =>
      sdk.client.fetch(`/admin/workbench/customers/${customer.id}/emails`),
    enabled: open,
  });

  const { data: detail } = useQuery<{ customer: { metadata?: Record<string, unknown> | null } }>({
    queryKey: ["workbench-customer-detail", customer.id],
    queryFn: () => sdk.client.fetch(`/admin/customers/${customer.id}`),
    enabled: open,
  });

  const { data: full } = useQuery<{
    orders: {
      id: string;
      display_id: number | string;
      created_at: string;
      total: number;
      stage: string | null;
      made_to_order: boolean;
      outstanding: number;
    }[];
  }>({
    queryKey: ["workbench-customer-full", customer.id],
    queryFn: () =>
      sdk.client.fetch(`/admin/workbench/customers/${customer.id}`),
    enabled: open,
  });

  useEffect(() => {
    if (open && detail) {
      const stored = detail.customer?.metadata?.poznamka;
      setNote(typeof stored === "string" ? stored : "");
    }
  }, [open, detail]);

  const saveNote = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/customers/${customer.id}`, {
        method: "POST",
        body: {
          metadata: {
            ...((detail?.customer?.metadata as Record<string, unknown>) ?? {}),
            poznamka: note.trim() || null,
          },
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["workbench-customer-detail", customer.id],
      });
      toast.success("Poznámka uložena.");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Poznámku se nepodařilo uložit"
      ),
  });

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>{customer.name || customer.email}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-5 overflow-y-auto">
          <div>
            <Text size="small" weight="plus">
              Poznámka (vidíte jen vy)
            </Text>
            <Textarea
              rows={3}
              className="mt-2"
              placeholder="Např.: Preferuje osobní odběr, alergie na chrom…"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <Button
              size="small"
              variant="secondary"
              className="mt-2"
              isLoading={saveNote.isPending}
              onClick={() => saveNote.mutate()}
            >
              Uložit poznámku
            </Button>
          </div>

          <div>
            <Text size="small" weight="plus">
              Objednávky
            </Text>
            {(full?.orders ?? []).length === 0 && (
              <Text size="xsmall" className="text-ui-fg-subtle mt-2">
                Zatím žádná objednávka.
              </Text>
            )}
            {(full?.orders ?? []).map((order) => (
              <Text key={order.id} size="xsmall" className="mt-1.5">
                <Link
                  to={`/orders/${order.id}`}
                  className="text-ui-fg-interactive hover:underline"
                >
                  #{order.display_id}
                </Link>{" "}
                · {formatCzk(order.total)} · {formatDate(order.created_at)}
                {order.made_to_order ? " · zakázka" : ""}
                {order.outstanding > 0
                  ? ` · dluží ${formatCzk(order.outstanding)}`
                  : ""}
              </Text>
            ))}
          </div>

          <div>
            <Text size="small" weight="plus">
              Odeslané e-maily
            </Text>
            {emailsLoading && (
              <Skeleton className="mt-2 h-10 rounded-lg" />
            )}
            {!emailsLoading && (emails?.emails.length ?? 0) === 0 && (
              <Text size="xsmall" className="text-ui-fg-subtle mt-2">
                Tomuto zákazníkovi zatím nic neodešlo.
              </Text>
            )}
            {(emails?.emails ?? []).map((email, index) => (
              <Text key={index} size="xsmall" className="mt-1.5">
                {email.template}
                {email.status === "failure" ? " · NEDORUČENO" : ""}{" "}
                <span className="text-ui-fg-muted">
                  {formatDate(email.created_at)}
                </span>
              </Text>
            ))}
          </div>

          <RawData data={{ customer, detail, orders: full?.orders }} />
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  );
};

const filterTabs = [
  { key: "vse", label: "Vše" },
  { key: "dluzi", label: "Čeká na doplatek" },
  { key: "vraci", label: "Vrací se" },
  { key: "newsletter", label: "Newsletter" },
  { key: "statistiky", label: "Statistiky" },
];

/** Zákazníci+ → Statistiky: repeat rate, top customers, registrations. */
const CustomerStats = () => {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["workbench-customer-statistics"],
    queryFn: () => sdk.client.fetch("/admin/workbench/customers/statistics"),
    refetchOnWindowFocus: true,
  });
  if (isLoading || !data) {
    return (
      <div className="px-6 py-5">
        <Skeleton className="h-24 rounded-lg" />
      </div>
    );
  }
  const maxRegistrations = Math.max(
    1,
    ...data.registrations_by_month.map((entry: any) => entry.count)
  );
  return (
    <div className="flex flex-col gap-y-5 px-6 py-5">
      <div>
        <Text size="small" weight="plus">
          {data.buyers_total} nakupujících · {data.repeat_buyers} se vrací
          {data.repeat_rate !== null ? ` (${data.repeat_rate} %)` : ""}
        </Text>
        <Text size="xsmall" className="text-ui-fg-subtle mt-1">
          {data.customers_total} registrovaných · newsletter odebírá{" "}
          {data.newsletter_subscribers} lidí ({data.customers_on_newsletter} z
          registrovaných)
        </Text>
      </div>

      <div>
        <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
          Registrace po měsících
        </Text>
        <div className="mt-2 flex items-end gap-1.5" aria-hidden="true">
          {data.registrations_by_month.map((entry: any) => (
            <div key={entry.month} className="flex flex-col items-center gap-1">
              <div
                className="bg-ui-fg-interactive w-6 rounded-sm"
                style={{
                  height: `${8 + (entry.count / maxRegistrations) * 44}px`,
                  opacity: entry.count ? 1 : 0.25,
                }}
                title={`${entry.month}: ${entry.count}`}
              />
              <Text size="xsmall" className="text-ui-fg-muted">
                {entry.count}
              </Text>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
          Nejvěrnější zákazníci
        </Text>
        {data.top_customers.map((customer: any) => (
          <Text key={customer.email} size="small" className="mt-1">
            {customer.name || customer.email} — {formatCzk(customer.total)} ·{" "}
            {customer.orders}{" "}
            {customer.orders === 1 ? "objednávka" : "objednávek"}
          </Text>
        ))}
      </div>
    </div>
  );
};

const ZakazniciInner = () => {
  const [active, setActive] = useState("vse");
  const [search, setSearch] = useState("");
  const expert = useExpertMode();

  const params = new URLSearchParams();
  if (active === "dluzi") params.set("owing", "true");
  if (active === "vraci") params.set("repeat", "true");
  if (active === "newsletter") params.set("newsletter", "true");
  if (search.trim()) params.set("q", search.trim());

  const { data, isLoading, isError } = useQuery<WorkbenchCustomersResponse>({
    queryKey: ["workbench-customers", active, search],
    enabled: active !== "statistiky",
    queryFn: () =>
      sdk.client.fetch(`/admin/workbench/customers?${params.toString()}`),
    refetchOnWindowFocus: true,
  });

  const rows = data?.customers ?? [];

  return (
    <Container className="divide-y p-0">
      <Toaster />
      <header className="flex flex-wrap items-start justify-between gap-3 px-6 pb-4 pt-6">
        <div>
          <Heading>Zákazníci — kdo je kdo</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
            Nákupy, doplatky, oblíbené i newsletter u každého zákazníka.
            Seřazeno podle toho, kolik u vás kdo utratil.
          </Text>
        </div>
        <div className="flex items-center gap-4">
        <ExpertToggle />
        <Input
          size="small"
          type="search"
          placeholder="Hledat jméno nebo e-mail…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-64"
        />
        </div>
      </header>

      <SubTabs tabs={filterTabs} active={active} onSelect={setActive} />

      {active === "statistiky" && <CustomerStats />}

      {isLoading && (
        <div className="flex flex-col gap-y-3 px-6 py-5">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      )}

      {isError && (
        <EmptyState
          title="Zákazníky se nepodařilo načíst"
          description="Zkuste stránku obnovit."
        />
      )}

      {active !== "statistiky" && !isLoading && !isError && rows.length === 0 && (
        <EmptyState
          title="Nikdo tu není"
          description="Žádný zákazník neodpovídá zvolenému filtru."
        />
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <div className="divide-y">
          {rows.map((customer) => (
            <article
              key={customer.id}
              className="grid gap-3 px-6 py-4 lg:grid-cols-[minmax(0,1.3fr)_190px_190px_minmax(0,1fr)_auto] lg:items-center"
            >
              <div className="min-w-0">
                <Text size="small" weight="plus" className="truncate">
                  {customer.name || customer.email}
                </Text>
                <Text size="xsmall" className="text-ui-fg-subtle mt-1 truncate">
                  {customer.name ? customer.email : ""}
                  {customer.newsletter ? " · odebírá newsletter" : ""}
                </Text>
                {expert && <CopyId value={customer.id} />}
              </div>

              <div>
                <Text size="small" weight="plus">
                  {formatCzk(customer.lifetime_value)}
                </Text>
                <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                  {customer.orders_count === 0
                    ? "zatím bez objednávky"
                    : customer.orders_count === 1
                      ? "1 objednávka"
                      : customer.orders_count <= 4
                        ? `${customer.orders_count} objednávky`
                        : `${customer.orders_count} objednávek`}
                </Text>
              </div>

              <div>
                {customer.outstanding > 0 ? (
                  <Badge size="2xsmall" color="red">
                    dluží {formatCzk(customer.outstanding)}
                  </Badge>
                ) : (
                  <Text size="xsmall" className="text-ui-fg-muted">
                    nic nedluží
                  </Text>
                )}
                {customer.last_order_at && (
                  <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                    naposledy {formatDate(customer.last_order_at)}
                  </Text>
                )}
              </div>

              <div className="min-w-0">
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {[
                    customer.wishlist_size > 0
                      ? `${customer.wishlist_size} v oblíbených`
                      : null,
                    customer.reviews_written > 0
                      ? `${customer.reviews_written}× hodnotil(a)`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </Text>
              </div>

              <div className="flex justify-start gap-2 lg:justify-end">
                <CustomerDrawer
                  customer={customer}
                  trigger={
                    <button
                      type="button"
                      className="text-ui-fg-interactive txt-small hover:underline"
                    >
                      Karta
                    </button>
                  }
                />
                <Link
                  to={`/customers/${customer.id}`}
                  className="text-ui-fg-interactive txt-small hover:underline"
                >
                  Detail
                </Link>
                <a
                  href={`mailto:${customer.email}`}
                  className="text-ui-fg-interactive txt-small hover:underline"
                >
                  Napsat
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </Container>
  );
};

const queryClient = new QueryClient();

const ZakazniciWorkbenchPage = () => (
  <QueryClientProvider client={queryClient}>
    <ZakazniciInner />
  </QueryClientProvider>
);

export const config = defineRouteConfig({
  label: "Zákazníci+",
  icon: Users,
});

export default ZakazniciWorkbenchPage;
