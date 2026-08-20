import { defineRouteConfig } from "@medusajs/admin-sdk";
import { DocumentText } from "@medusajs/icons";
import {
  Badge,
  Button,
  Checkbox,
  Container,
  Heading,
  Input,
  Select,
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
import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../components/empty-state";
import { CopyId, ExpertToggle, RawData, useExpertMode } from "../../lib/expert-mode";
import { ProductionDiary } from "../../components/production-diary";
import { SubTabs } from "../../components/work-tabs";
import {
  formatCzk,
  stageColors,
  stageLabels,
} from "../../lib/workbench";
import { formatDateTime } from "../../lib/format";
import { sdk } from "../../lib/sdk";

/**
 * Objednávky — the advanced order worklist (admin-advanced-plan.md).
 *
 * Přehled → Denní práce is the standard speed: the orders inside the
 * merchant workflow, one stage at a time, with one next action each. This
 * page is the escalation: *every* order, with the three systems that each
 * hold a third of the truth joined into one row — Medusa's order (money
 * asked), payments (money received, captured-minus-refunded, the same
 * quantity the ship gate checks), and the production module (stage, balance
 * owed).
 *
 * It links out rather than duplicating actions: the native order detail for
 * edits and refunds, Denní práce for the stage workflow. Two places that can
 * move an order is one too many.
 */

type WorkbenchOrder = {
  raw?: unknown;
  id: string;
  display_id: number | string;
  created_at: string;
  email: string | null;
  customer_name: string | null;
  currency_code: string;
  total: number;
  captured: number;
  refunded: number;
  paid: number;
  items_count: number;
  stage: string | null;
  stage_changed_at: string | null;
  made_to_order: boolean;
  production_stage: string | null;
  outstanding: number;
  is_personal_pickup: boolean;
  shipped: boolean;
  delivered: boolean;
  /** Packed, waiting for her to physically hand it to the carrier. */
  awaiting_handover: boolean;
};

type WorkbenchOrdersResponse = {
  counts?: Record<string, number>;
  orders: WorkbenchOrder[];
  count: number;
};

const filterTabs = [
  { key: "vse", label: "Vše" },
  { key: "received", label: "Nové" },
  { key: "working", label: "Připravujeme" },
  { key: "shipping", label: "K odeslání" },
  /* Zabalené balíky, které čekají na fyzické předání — to, co dělá u přepážky
     s telefonem v ruce. Velká tlačítka, hromadné potvrzení. */
  { key: "naposta", label: "Na poštu" },
  { key: "payment_problem", label: "Problém s platbou" },
  { key: "dluzi", label: "Čeká na doplatek" },
  { key: "statistiky", label: "Statistiky" },
];

/** Objednávky+ → Statistiky: 12 months, AOV, providers, lead time, refunds. */
const OrderStats = () => {
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["workbench-order-statistics"],
    queryFn: () => sdk.client.fetch("/admin/workbench/orders/statistics"),
    refetchOnWindowFocus: true,
    retry: 1,
  });
  if (error) {
    return (
      <div className="px-6 py-5">
        <Text size="small" className="text-ui-fg-error">
          Statistiky se nepodařilo načíst:{" "}
          {error instanceof Error ? error.message : "neznámá chyba"}
        </Text>
      </div>
    );
  }
  if (isLoading || !data) {
    return (
      <div className="px-6 py-5">
        <Skeleton className="h-24 rounded-lg" />
      </div>
    );
  }
  const maxRevenue = Math.max(1, ...data.months.map((m: any) => m.revenue));
  return (
    <div className="flex flex-col gap-y-5 px-6 py-5">
      <div>
        <Text size="small" weight="plus">
          Posledních 12 měsíců: {data.orders_365d} objednávek ·{" "}
          {formatCzk(data.revenue_365d)}
        </Text>
        <Text size="xsmall" className="text-ui-fg-subtle mt-1">
          Průměrná objednávka {formatCzk(data.average_order ?? 0)}
          {data.pickup_share !== null
            ? ` · osobní odběr ${data.pickup_share} %`
            : ""}
          {data.lead_time_days_median !== null
            ? ` · od přijetí k odeslání obvykle ${data.lead_time_days_median} dní (z ${data.lead_times_measured} měřených)`
            : ""}
          {data.refunded_365d > 0
            ? ` · vráceno ${formatCzk(data.refunded_365d)}`
            : ""}
        </Text>
      </div>
      <div className="flex items-end gap-1.5" aria-hidden="true">
        {data.months.map((entry: any) => (
          <div key={entry.month} className="flex flex-col items-center gap-1">
            <div
              className="bg-ui-fg-interactive w-6 rounded-sm"
              style={{
                height: `${8 + (entry.revenue / maxRevenue) * 56}px`,
                opacity: entry.revenue ? 1 : 0.25,
              }}
              title={`${entry.month}: ${entry.orders} obj., ${entry.revenue}`}
            />
            <Text size="xsmall" className="text-ui-fg-muted">
              {entry.orders}
            </Text>
          </div>
        ))}
      </div>
      <div>
        <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
          Jak zákazníci platí
        </Text>
        {data.payment_providers.map((provider: any) => (
          <Text key={provider.provider} size="small" className="mt-1">
            {provider.count}× {provider.provider}
          </Text>
        ))}
      </div>
    </div>
  );
};

/**
 * The legal batch moves. `cancelled` is deliberately not offered in bulk —
 * cancelling is a decision about one order, not a firing-day sweep.
 */
const batchTargets = [
  { value: "working", label: "Připravujeme" },
  { value: "shipping", label: "K odeslání" },
  { value: "shipped", label: "Odesláno" },
] as const;

type OrderDetail = {
  customer: {
    id: string | null;
    email: string | null;
    previous_orders: number;
    history: {
      id: string;
      display_id: number | string;
      created_at: string;
      total: number;
      stage: string | null;
    }[];
  };
  shipping: {
    name: string | null;
    address: string | null;
    method: string | null;
  };
  items: {
    id: string;
    title: string;
    variant_title: string | null;
    thumbnail: string | null;
    quantity: number;
    unit_price: number;
    total: number;
    specification: string | null;
  }[];
  ledger: {
    id: string;
    provider_id: string;
    amount: number;
    created_at: string;
    captured_at: string | null;
    refunded: number;
  }[];
  timeline: {
    from: string | null;
    to: string;
    at: string;
    by: string | null;
    note: string | null;
    reconciled: boolean;
  }[];
  emails: { template: string; status: string; created_at: string }[];
  internal_note: string | null;
};

/**
 * Podací lístek — one click per parcel. A mixed order offers the split:
 * stock items ship now, the zakázka ships when the kiln says so. Without ČP
 * credentials the route answers with the honest reason; the buttons exist
 * today so the day the account arrives nothing changes but the outcome.
 */
type LabelResult = {
  available: boolean;
  reason?: string;
  labels: { url: string; tracking_number?: string | null }[];
  destination?: {
    type: "balikovna";
    zip: string | null;
    name: string | null;
    address: string | null;
    address_line: string | null;
  } | null;
  warnings?: string[];
};

const LabelButtons = ({ orderId, madeToOrder }: { orderId: string; madeToOrder: boolean }) => {
  /* Poslední odpověď zůstává vidět pod tlačítky — toast zmizí, tohle ne.
     Přesně kvůli testování Balíkovny: ať je vidět, kam by zásilka jela,
     co chybí a proč štítek (ještě) není. */
  const [last, setLast] = useState<LabelResult | null>(null);

  const request = useMutation({
    mutationFn: (parcel: "all" | "stock" | "zakazka") =>
      sdk.client.fetch(
        `/admin/merchant-orders/${orderId}/label${parcel === "all" ? "" : `?parcel=${parcel}`}`
      ) as Promise<LabelResult>,
    onSuccess: (result) => {
      setLast(result);
      for (const warning of result.warnings ?? []) {
        toast.warning(warning);
      }
      if (!result.available || !result.labels?.length) {
        toast.info(result.reason ?? "Lístek zatím není k dispozici.");
        return;
      }
      toast.success("Štítek je připravený — otevírám PDF.");
      /* Only the FIRST window.open survives on a phone — browsers block every
         popup after the one tied to the tap. The rest render as links below. */
      if (result.labels[0]) {
        window.open(result.labels[0].url, "_blank", "noreferrer");
      }
      if (result.labels.length > 1) {
        toast.info("Další štítky otevřete z odkazů pod tlačítky.");
      }
    },
    onError: (error) => {
      setLast(null);
      toast.error(error instanceof Error ? error.message : "Lístek se nepodařilo vytvořit.");
    },
  });

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          size="small"
          variant="secondary"
          isLoading={request.isPending}
          onClick={() => request.mutate("all")}
        >
          Podací lístek
        </Button>
        {madeToOrder && (
          <>
            <Button size="small" variant="secondary" onClick={() => request.mutate("stock")}>
              Jen skladové zboží
            </Button>
            <Button size="small" variant="secondary" onClick={() => request.mutate("zakazka")}>
              Jen zakázku
            </Button>
          </>
        )}
      </div>
      {last && (
        <div className="flex flex-col gap-1">
          {last.destination?.type === "balikovna" && (
            <Text size="xsmall" className="text-ui-fg-subtle">
              {last.destination.address_line
                ? `Adresa na štítku: ${last.destination.address_line}`
                : "Do Balíkovny — výdejní místo zatím chybí."}
              {last.destination.address ? ` · ${last.destination.address}` : ""}
            </Text>
          )}
          {(last.warnings ?? []).map((warning) => (
            <Text key={warning} size="xsmall" className="text-ui-tag-orange-text">
              ⚠ {warning}
            </Text>
          ))}
          {last.available ? (
            <>
              <Text size="xsmall" className="text-ui-tag-green-text">
                Štítek od dopravce je k dispozici.
              </Text>
              {(last.labels ?? []).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {(last.labels ?? []).map((label, index) => (
                    <a
                      key={label.url}
                      href={label.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-ui-fg-interactive text-xs underline"
                    >
                      Štítek {index + 1}
                      {label.tracking_number ? ` · ${label.tracking_number}` : ""}
                    </a>
                  ))}
                </div>
              )}
            </>
          ) : (
            last.reason && (
              <Text size="xsmall" className="text-ui-fg-muted">
                {last.reason}
              </Text>
            )
          )}
        </div>
      )}
    </div>
  );
};

/** Row expansion: the ledger, the timeline, the e-mails — the phone-call view. */
const OrderExpansion = ({ orderId, madeToOrder }: { orderId: string; madeToOrder: boolean }) => {
  const { data, isLoading } = useQuery<OrderDetail>({
    queryKey: ["workbench-order", orderId],
    queryFn: () => sdk.client.fetch(`/admin/workbench/orders/${orderId}`),
  });

  if (isLoading) {
    return (
      <div className="px-6 pb-4">
        <Skeleton className="h-16 rounded-lg" />
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="bg-ui-bg-subtle px-6 py-4">
      {/* Level 2a — what was ordered and where it goes */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div>
          <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
            Položky
          </Text>
          {data.items.map((item) => (
            <div key={item.id} className="mt-1.5 flex items-start gap-2">
              {item.thumbnail ? (
                <img
                  src={item.thumbnail}
                  alt=""
                  className="mt-0.5 h-7 w-7 rounded object-cover"
                />
              ) : (
                <div className="bg-ui-bg-component mt-0.5 h-7 w-7 rounded" />
              )}
              <div className="min-w-0">
                <Text size="xsmall">
                  {item.quantity}× {item.title}
                  {item.variant_title ? ` — ${item.variant_title}` : ""}{" "}
                  <span className="text-ui-fg-muted">
                    {formatCzk(item.total)}
                  </span>
                </Text>
                {item.specification && (
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    Zadání: {item.specification}
                  </Text>
                )}
              </div>
            </div>
          ))}
        </div>

        <div>
          <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
            Zákazník
          </Text>
          <Text size="xsmall" className="mt-1.5">
            {data.customer.previous_orders === 0
              ? "První objednávka u vás."
              : data.customer.previous_orders === 1
                ? "Už u vás jednou nakoupili."
                : `Nakoupili u vás už ${data.customer.previous_orders}×.`}
          </Text>
          {data.customer.history.map((previous) => (
            <Text key={previous.id} size="xsmall" className="text-ui-fg-subtle mt-1">
              #{previous.display_id} · {formatCzk(previous.total)} ·{" "}
              {formatDateTime(previous.created_at)}
              {previous.stage
                ? ` · ${stageLabels[previous.stage] ?? previous.stage}`
                : ""}
            </Text>
          ))}
          {data.shipping.address && (
            <Text size="xsmall" className="text-ui-fg-subtle mt-2">
              Doručení: {data.shipping.name} — {data.shipping.address}
              {data.shipping.method ? ` (${data.shipping.method})` : ""}
            </Text>
          )}
        </div>
      </div>

      {/* Level 2b — money, movement, mail */}
      <div className="border-ui-border-base mt-4 grid gap-4 border-t pt-4 lg:grid-cols-3">
      <div>
        <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
          Platby
        </Text>
        {data.ledger.length === 0 && (
          <Text size="xsmall" className="text-ui-fg-subtle mt-1">
            Zatím žádná platba.
          </Text>
        )}
        {data.ledger.map((payment) => (
          <Text key={payment.id} size="xsmall" className="mt-1">
            {formatCzk(payment.amount)} ·{" "}
            {payment.captured_at
              ? "přijato"
              : "přislíbeno"}
            {payment.refunded > 0
              ? ` · vráceno ${formatCzk(payment.refunded)}`
              : ""}{" "}
            <span className="text-ui-fg-muted">
              {formatDateTime(payment.captured_at ?? payment.created_at)}
            </span>
          </Text>
        ))}
      </div>

      <div>
        <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
          Průběh
        </Text>
        {data.timeline.length === 0 && (
          <Text size="xsmall" className="text-ui-fg-subtle mt-1">
            Zatím beze změn stavu.
          </Text>
        )}
        {data.timeline.map((entry, index) => (
          <Text key={index} size="xsmall" className="mt-1">
            {stageLabels[entry.to] ?? entry.to}
            {entry.reconciled ? " (automaticky)" : ""}{" "}
            <span className="text-ui-fg-muted">{formatDateTime(entry.at)}</span>
            {entry.note ? ` — ${entry.note}` : ""}
          </Text>
        ))}
        {data.internal_note && (
          <Text size="xsmall" className="text-ui-fg-subtle mt-2">
            Poznámka: {data.internal_note}
          </Text>
        )}
      </div>

      <div>
        <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
          E-maily zákazníkovi
        </Text>
        {data.emails.length === 0 && (
          <Text size="xsmall" className="text-ui-fg-subtle mt-1">
            Nic neodešlo.
          </Text>
        )}
        {data.emails.slice(0, 6).map((email, index) => (
          <Text key={index} size="xsmall" className="mt-1">
            {email.template}
            {email.status === "failure" ? " · NEDORUČENO" : ""}{" "}
            <span className="text-ui-fg-muted">
              {formatDateTime(email.created_at)}
            </span>
          </Text>
        ))}
      </div>
      </div>
      <LabelButtons orderId={orderId} madeToOrder={madeToOrder} />
      <RawData data={data} />
    </div>
  );
};

/* ------------------------------------------------------- tisk lístků ---- */

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ]!
  );

type PrintableOrder = {
  display_id: number | string;
  created_at: string;
  email: string | null;
  currency_code: string;
  total: number;
  shipping_address: {
    first_name: string | null;
    last_name: string | null;
    company: string | null;
    address_1: string | null;
    address_2: string | null;
    postal_code: string | null;
    city: string | null;
    country_code: string | null;
    phone: string | null;
  } | null;
  items: {
    quantity: number;
    title: string | null;
    product_title: string | null;
    variant_title: string | null;
  }[];
  shipping_methods: { name: string | null }[];
  payment_collections: {
    payments: { provider_id: string | null }[] | null;
  }[] | null;
};

/**
 * One A4 sheet per order: the address block sized to work as a podací lístek
 * (she copies or cuts it for ČP), the item list underneath as the balicí
 * list for the box. Dobírka orders get the COD amount in a heavy box because
 * that number must land on the post form — forgetting it means the parcel
 * travels for free.
 */
const buildPrintDocument = (orders: PrintableOrder[]) => {
  const sheets = orders
    .map((order) => {
      const addr = order.shipping_address;
      const money = new Intl.NumberFormat("cs-CZ", {
        style: "currency",
        currency: order.currency_code?.toUpperCase() || "CZK",
        maximumFractionDigits: 2,
      });
      const isDobirka = (order.payment_collections ?? []).some((collection) =>
        (collection.payments ?? []).some((payment) =>
          (payment.provider_id ?? "").startsWith("pp_dobirka")
        )
      );
      const itemRows = order.items
        .map((item) => {
          const name = item.product_title || item.title || "";
          const variant =
            item.variant_title && item.variant_title !== "Default variant"
              ? ` — ${item.variant_title}`
              : "";
          return `<tr><td>${escapeHtml(name)}${escapeHtml(variant)}</td><td class="qty">${item.quantity}&nbsp;ks</td></tr>`;
        })
        .join("");
      const addressLines = addr
        ? [
            `${addr.first_name ?? ""} ${addr.last_name ?? ""}`.trim(),
            addr.company,
            addr.address_1,
            addr.address_2,
            `${addr.postal_code ?? ""} ${addr.city ?? ""}`.trim(),
            (addr.country_code ?? "").toUpperCase() === "CZ"
              ? null
              : (addr.country_code ?? "").toUpperCase(),
          ]
            .filter(Boolean)
            .map((line) => `<div>${escapeHtml(line)}</div>`)
            .join("")
        : "<div>Bez doručovací adresy (osobní odběr?)</div>";
      return `
  <section class="sheet">
    <header>
      <div>
        <div class="shop">Keramická zahrada · Lucie Polanská</div>
        <div class="doc">Balicí list</div>
      </div>
      <div class="order-no">
        <div>Objednávka č. ${escapeHtml(order.display_id)}</div>
        <div class="muted">${escapeHtml(
          new Date(order.created_at).toLocaleDateString("cs-CZ")
        )}</div>
      </div>
    </header>
    <div class="address">
      <div class="label">Adresát</div>
      ${addressLines}
      ${addr?.phone ? `<div class="muted">Tel.: ${escapeHtml(addr.phone)}</div>` : ""}
    </div>
    ${
      isDobirka
        ? `<div class="cod">DOBÍRKA — vybrat ${escapeHtml(money.format(order.total))}</div>`
        : ""
    }
    <div class="meta">
      ${order.shipping_methods?.[0]?.name ? `Doprava: ${escapeHtml(order.shipping_methods[0].name)} · ` : ""}${escapeHtml(order.email ?? "")}
    </div>
    <table>
      <thead><tr><th>Položka</th><th class="qty">Množství</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <footer>Děkujeme za objednávku. Křehké — keramika!</footer>
  </section>`;
    })
    .join("");
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8">
<title>Balicí listy</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { font: 13px/1.5 -apple-system, "Segoe UI", sans-serif; color: #111; }
  @page { size: A4; margin: 14mm; }
  .sheet { page-break-after: always; padding: 8px 0; }
  .sheet:last-child { page-break-after: auto; }
  header { display: flex; justify-content: space-between; align-items: flex-start;
           border-bottom: 2px solid #111; padding-bottom: 8px; }
  .shop { font-weight: 700; }
  .doc { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #555; }
  .order-no { text-align: right; font-weight: 700; }
  .muted { color: #555; font-weight: 400; font-size: 12px; }
  .address { border: 1.5px solid #111; padding: 12px 16px; margin: 16px 0 0;
             font-size: 16px; line-height: 1.45; max-width: 420px; }
  .address .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em;
                    color: #555; margin-bottom: 4px; }
  .cod { border: 3px double #111; display: inline-block; padding: 8px 14px;
         margin-top: 12px; font-size: 15px; font-weight: 700; }
  .meta { margin: 14px 0 6px; color: #555; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th, td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #ccc; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #555; }
  .qty { text-align: right; white-space: nowrap; width: 90px; }
  footer { margin-top: 18px; font-size: 11px; color: #555; }
</style></head><body>${sheets}</body></html>`;
};

const OrdersInner = () => {
  const [active, setActive] = useState("vse");
  /* The input updates instantly; the QUERY fires 350 ms after she stops
     typing — one request per thought, not one per keystroke. */
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [pageLimit, setPageLimit] = useState(50);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPageLimit(50);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  const expert = useExpertMode();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [batchStage, setBatchStage] = useState<string>("");
  const queryClient = useQueryClient();

  const batchMove = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/workbench/orders/batch-stage`, {
        method: "POST",
        body: { order_ids: [...selected], stage: batchStage },
      }) as Promise<{
        moved: number;
        failed: number;
        results: { order_id: string; ok: boolean; error: string | null }[];
      }>,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["workbench-orders"] });
      setSelected(new Set());
      if (result.failed === 0) {
        toast.success(`Přesunuto ${result.moved} objednávek.`);
      } else {
        // The failures ARE the feature: name each one rather than a count.
        for (const failure of result.results.filter((r) => !r.ok)) {
          toast.error(`Objednávka se nepřesunula: ${failure.error}`);
        }
        if (result.moved > 0) {
          toast.success(`${result.moved} se přesunulo, ${result.failed} ne.`);
        }
      }
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Přesun se nepodařil."
      ),
  });

  const params = new URLSearchParams();
  if (active === "dluzi") {
    params.set("owing", "true");
  } else if (active === "naposta") {
    // „Na poštu" is the handover subset of the shipping stage.
    params.set("stage", "shipping");
  } else if (active !== "vse") {
    params.set("stage", active);
  }
  if (search) {
    params.set("q", search);
  }
  params.set("limit", String(pageLimit));
  if (expert) {
    params.set("expert", "1");
  }

  const { data, isLoading, isError } = useQuery<WorkbenchOrdersResponse>({
    queryKey: ["workbench-orders", active, search, expert, pageLimit],
    enabled: active !== "statistiky",
    queryFn: () =>
      sdk.client.fetch(`/admin/workbench/orders?${params.toString()}`),
    refetchOnWindowFocus: true,
  });

  const allRows = data?.orders ?? [];
  const rows =
    active === "naposta"
      ? allRows.filter((order) => order.awaiting_handover)
      : allRows;

  /* Hromadné předání celé tašky u přepážky — jeden klik místo N. Sequential
     on purpose: each confirm sends the customer's shipment e-mail. */
  const bulkHandover = useMutation({
    mutationFn: async () => {
      const results: { id: string | number; ok: boolean; error?: string }[] = [];
      for (const order of rows) {
        try {
          await sdk.client.fetch(`/admin/merchant-orders/${order.id}`, {
            method: "PATCH",
            body: { stage: "handover_confirmed" },
          });
          results.push({ id: order.display_id, ok: true });
        } catch (error) {
          results.push({
            id: order.display_id,
            ok: false,
            error: error instanceof Error ? error.message : "neznámá chyba",
          });
        }
      }
      return results;
    },
    onSuccess: async (results) => {
      await queryClient.invalidateQueries({ queryKey: ["workbench-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["merchant-orders"] });
      const failed = results.filter((result) => !result.ok);
      const okCount = results.length - failed.length;
      if (okCount > 0) {
        toast.success(
          `Předáno dopravci: ${okCount} ${okCount === 1 ? "zásilka" : okCount <= 4 ? "zásilky" : "zásilek"}. Zákazníkům odešel e-mail.`
        );
      }
      for (const failure of failed) {
        toast.error(`#${failure.id} se nepodařilo předat: ${failure.error}`);
      }
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Předání se nepodařilo."),
  });

  /* Tisk balicích/podacích lístků: fetch the full detail of each chosen
     order (the worklist rows deliberately don't carry addresses), render one
     printable HTML document, one sheet per order, and hand it to the
     browser's print dialog in a new window — no PDF library, no server. */
  const printSheets = useMutation({
    mutationFn: async (orderIds: string[]) => {
      const fields = [
        "display_id",
        "created_at",
        "email",
        "currency_code",
        "total",
        "*shipping_address",
        "items.quantity",
        "items.title",
        "items.product_title",
        "items.variant_title",
        "shipping_methods.name",
        "payment_collections.payments.provider_id",
      ].join(",");
      const detailed: PrintableOrder[] = [];
      for (const id of orderIds) {
        const { order } = await sdk.client.fetch<{ order: PrintableOrder }>(
          `/admin/orders/${id}?fields=${encodeURIComponent(fields)}`
        );
        detailed.push(order);
      }
      return detailed;
    },
    onSuccess: (detailed) => {
      const win = window.open("", "_blank");
      if (!win) {
        toast.error(
          "Prohlížeč zablokoval nové okno — povolte vyskakovací okna a zkuste to znovu."
        );
        return;
      }
      win.document.write(buildPrintDocument(detailed));
      win.document.close();
      win.focus();
      // Let the new window lay out before opening the print dialog.
      win.setTimeout(() => win.print(), 300);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Tisk se nepodařilo připravit."
      ),
  });

  const rowHandover = useMutation({
    mutationFn: (orderId: string) =>
      sdk.client.fetch(`/admin/merchant-orders/${orderId}`, {
        method: "PATCH",
        body: { stage: "handover_confirmed" },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workbench-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["merchant-orders"] });
      toast.success("Zásilka předána dopravci — zákazník dostal e-mail.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Předání se nepodařilo."),
  });

  return (
    <Container className="divide-y p-0">
      <Toaster />
      <header className="flex flex-wrap items-start justify-between gap-3 px-6 pb-4 pt-6">
        <div>
          <Heading>Objednávky — pracovní přehled</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
            Každá objednávka s penězi, stavem výroby i dopravou vedle sebe.
            Běžný den zvládnete v Přehledu → Denní práce; sem se chodí, když
            je potřeba vidět všechno najednou.
          </Text>
        </div>
        <div className="flex items-center gap-4">
        <ExpertToggle />
        <Input
          size="small"
          type="search"
          placeholder="Hledat e-mail nebo číslo objednávky…"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className="w-64"
        />
        </div>
      </header>

      <SubTabs
        tabs={filterTabs.map((tab) => ({
          ...tab,
          count:
            tab.key === "statistiky" ? undefined : data?.counts?.[tab.key],
        }))}
        active={active}
        onSelect={setActive}
      />

      {active === "statistiky" && <OrderStats />}

      {active !== "statistiky" && isLoading && (
        <div className="flex flex-col gap-y-3 px-6 py-5">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      )}

      {active !== "statistiky" && isError && (
        <EmptyState
          title="Objednávky se nepodařilo načíst"
          description="Zkuste stránku obnovit."
        />
      )}

      {active !== "statistiky" && !isLoading && !isError && rows.length === 0 && (
        <EmptyState
          title={active === "naposta" ? "Nic nečeká na předání" : "Nic tu není"}
          description={
            active === "naposta"
              ? "Všechny zabalené zásilky už jsou u dopravce."
              : "Žádná objednávka neodpovídá zvolenému filtru."
          }
        />
      )}

      {/* „Na poštu": jedna taška, jedno tlačítko. */}
      {active === "naposta" && !isLoading && rows.length > 0 && (
        <div className="bg-ui-bg-subtle flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <Text size="small" weight="plus">
            {rows.length === 1
              ? "1 zásilka čeká na předání dopravci."
              : `${rows.length} ${rows.length <= 4 ? "zásilky čekají" : "zásilek čeká"} na předání dopravci.`}
          </Text>
          <div className="flex items-center gap-2">
            <Button
              size="base"
              variant="secondary"
              isLoading={printSheets.isPending}
              onClick={() => printSheets.mutate(rows.map((order) => order.id))}
            >
              Vytisknout lístky
            </Button>
            <Button
              size="base"
              isLoading={bulkHandover.isPending}
              onClick={() => bulkHandover.mutate()}
            >
              Předala jsem dopravci vše ({rows.length})
            </Button>
          </div>
        </div>
      )}

      {selected.size > 0 && (
        <div className="bg-ui-bg-subtle flex flex-wrap items-center gap-3 px-6 py-3">
          <Text size="small" weight="plus">
            Vybráno: {selected.size}
          </Text>
          <Select
            size="small"
            value={batchStage}
            onValueChange={setBatchStage}
          >
            <Select.Trigger className="w-56">
              <Select.Value placeholder="Přesunout do stavu…" />
            </Select.Trigger>
            <Select.Content>
              {batchTargets.map((target) => (
                <Select.Item key={target.value} value={target.value}>
                  {target.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Button
            size="small"
            disabled={!batchStage}
            isLoading={batchMove.isPending}
            onClick={() => batchMove.mutate()}
          >
            Přesunout
          </Button>
          <Button
            size="small"
            variant="secondary"
            isLoading={printSheets.isPending}
            onClick={() => printSheets.mutate([...selected])}
          >
            Vytisknout lístky ({selected.size})
          </Button>
          <Button
            size="small"
            variant="transparent"
            onClick={() => setSelected(new Set())}
          >
            Zrušit výběr
          </Button>
        </div>
      )}

      {active !== "statistiky" && !isLoading && !isError && rows.length > 0 && (
        <div className="divide-y">
          {rows.map((order) => {
            const unpaid = order.total - order.paid > 0.009;

            return (
              <Fragment key={order.id}>
              <article
                className="grid gap-3 px-6 py-4 lg:grid-cols-[110px_minmax(0,1.3fr)_170px_190px_minmax(0,1fr)_auto] lg:items-center"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selected.has(order.id)}
                    onCheckedChange={(checked) => {
                      const next = new Set(selected);
                      if (checked) {
                        next.add(order.id);
                      } else {
                        next.delete(order.id);
                      }
                      setSelected(next);
                    }}
                  />
                  <div>
                    <Text size="small" weight="plus">
                      #{order.display_id}
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                      {formatDateTime(order.created_at)}
                    </Text>
                    {expert && <CopyId value={order.id} />}
                  </div>
                </div>

                <div className="min-w-0">
                  <Text size="small" className="truncate">
                    {order.customer_name || order.email || "—"}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                    {order.items_count}{" "}
                    {order.items_count === 1
                      ? "položka"
                      : order.items_count <= 4
                        ? "položky"
                        : "položek"}
                    {order.made_to_order ? " · zakázka" : ""}
                    {order.is_personal_pickup ? " · osobní odběr" : ""}
                  </Text>
                </div>

                <div>
                  {order.stage ? (
                    <Badge
                      size="2xsmall"
                      color={stageColors[order.stage] ?? "grey"}
                    >
                      {stageLabels[order.stage] ?? order.stage}
                    </Badge>
                  ) : (
                    <Text size="xsmall" className="text-ui-fg-muted">
                      mimo dílnu
                    </Text>
                  )}
                  {order.shipped && !order.delivered && (
                    <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                      na cestě
                    </Text>
                  )}
                  {order.delivered && (
                    <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                      doručeno
                    </Text>
                  )}
                  {active === "naposta" && (
                    <div className="mt-2">
                      <Button
                        size="small"
                        isLoading={
                          rowHandover.isPending &&
                          rowHandover.variables === order.id
                        }
                        onClick={() => rowHandover.mutate(order.id)}
                      >
                        Předala jsem dopravci
                      </Button>
                    </div>
                  )}
                </div>

                <div>
                  <Text size="small" weight="plus">
                    {formatCzk(order.paid)}{" "}
                    <span className="text-ui-fg-muted font-normal">
                      z {formatCzk(order.total)}
                    </span>
                  </Text>
                  {order.outstanding > 0 && (
                    <Text size="xsmall" className="text-ui-fg-error mt-1">
                      doplatek {formatCzk(order.outstanding)}
                    </Text>
                  )}
                  {order.outstanding <= 0 && unpaid && (
                    <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                      {order.is_personal_pickup
                        ? "zaplatí při vyzvednutí"
                        : "nedoplaceno"}
                    </Text>
                  )}
                </div>

                <div className="min-w-0">
                  {order.refunded > 0 && (
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      vráceno {formatCzk(order.refunded)}
                    </Text>
                  )}
                </div>

                <div className="flex justify-start gap-2 lg:justify-end">
                  <button
                    type="button"
                    className="text-ui-fg-interactive txt-small hover:underline"
                    onClick={() =>
                      setExpanded(expanded === order.id ? null : order.id)
                    }
                  >
                    {expanded === order.id ? "Skrýt" : "Rozbalit"}
                  </button>
                  {order.made_to_order && (
                    <ProductionDiary
                      orderId={order.id}
                      label={`#${order.display_id}`}
                      trigger={
                        <button
                          type="button"
                          className="text-ui-fg-interactive txt-small hover:underline"
                        >
                          Deník
                        </button>
                      }
                    />
                  )}
                  <Link
                    to={`/orders/${order.id}`}
                    className="text-ui-fg-interactive txt-small hover:underline"
                  >
                    Detail
                  </Link>
                </div>
              </article>
              {expanded === order.id && (
                <OrderExpansion orderId={order.id} madeToOrder={order.made_to_order} />
              )}
              </Fragment>
            );
          })}
        </div>
      )}

      {/* Stránkování: server teď posílá skutečný počet pro aktivní filtr. */}
      {active !== "statistiky" &&
        active !== "naposta" &&
        !isLoading &&
        (data?.count ?? 0) > allRows.length && (
          <div className="flex items-center justify-center gap-3 px-6 py-4">
            {pageLimit >= 200 ? (
              <Text size="small" className="text-ui-fg-subtle">
                Zobrazeno prvních 200 — zúžte výběr hledáním.
              </Text>
            ) : (
              <Button
                size="small"
                variant="secondary"
                onClick={() => setPageLimit((current) => Math.min(current + 50, 200))}
              >
                Načíst další ({allRows.length} z {data?.count})
              </Button>
            )}
          </div>
        )}
    </Container>
  );
};

const queryClient = new QueryClient();

const OrdersWorkbenchPage = () => (
  <QueryClientProvider client={queryClient}>
    <OrdersInner />
  </QueryClientProvider>
);

export const config = defineRouteConfig({
  label: "Objednávky+",
  icon: DocumentText,
  rank: 10,
});

export default OrdersWorkbenchPage;
