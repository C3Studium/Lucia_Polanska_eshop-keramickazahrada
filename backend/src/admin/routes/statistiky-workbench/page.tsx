import { defineRouteConfig } from "@medusajs/admin-sdk";
import { SquaresPlus } from "@medusajs/icons";
import { Container, Heading, Skeleton, Text } from "@medusajs/ui";
import {
  QueryClient, QueryClientProvider, useQuery,
} from "@tanstack/react-query";
import { useState } from "react";
import { SubTabs } from "../../components/work-tabs";
import { ExpertToggle, RawData } from "../../lib/expert-mode";
import { formatCzk, productionStageLabels, stageLabels } from "../../lib/workbench";
import { sdk } from "../../lib/sdk";

/**
 * Statistiky+ — every measurement in one room (Matěj, 2026-08-06).
 *
 * Souhrn answers „jak se obchodu daří" in one screen; the section tabs
 * mirror the + pages (Objednávky · Produkty · Zákazníci · Sklad · Slevy)
 * and re-render the same endpoints those pages read — one source per
 * number, so this room can never disagree with the workbenches. Expert mode
 * attaches the raw payload under every tab.
 */

const useStats = (key: string, path: string, enabled: boolean) =>
  useQuery<any>({
    queryKey: ["statistiky-plus", key],
    queryFn: () => sdk.client.fetch(path),
    enabled,
    refetchOnWindowFocus: true,
    retry: 1,
  });

const Block = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="border-ui-border-base rounded-lg border p-4">
    <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">{title}</Text>
    <div className="mt-2">{children}</div>
  </div>
);

const Bars = ({ data, label }: { data: { key: string; value: number; hint?: string }[]; label: (v: number) => string }) => {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-1.5 overflow-x-auto pb-1" aria-hidden="true">
      {data.map((d) => (
        <div key={d.key} className="flex flex-col items-center gap-1">
          <div className="bg-ui-fg-interactive w-7 rounded-sm"
            style={{ height: `${8 + (d.value / max) * 56}px`, opacity: d.value ? 1 : 0.25 }}
            title={`${d.key}: ${label(d.value)}${d.hint ? ` · ${d.hint}` : ""}`} />
          <Text size="xsmall" className="text-ui-fg-muted">{d.key.slice(5)}</Text>
        </div>
      ))}
    </div>
  );
};

const Fail = ({ error }: { error: unknown }) => (
  <Text size="small" className="text-ui-fg-error">
    Nepodařilo se načíst: {error instanceof Error ? error.message : "neznámá chyba"}
  </Text>
);
const Loading = () => <Skeleton className="h-24 rounded-lg" />;

const tabs = [
  { key: "souhrn", label: "Souhrn" },
  { key: "objednavky", label: "Objednávky" },
  { key: "produkty", label: "Produkty" },
  { key: "zakaznici", label: "Zákazníci" },
  { key: "sklad", label: "Sklad" },
  { key: "slevy", label: "Slevy" },
];

const Inner = () => {
  const [active, setActive] = useState("souhrn");
  const all = active === "souhrn";

  const orders = useStats("orders", "/admin/workbench/orders/statistics", all || active === "objednavky");
  const products = useStats("products", "/admin/workbench/products/statistics", all || active === "produkty");
  const customers = useStats("customers", "/admin/workbench/customers/statistics", all || active === "zakaznici");
  const inventory = useStats("inventory", "/admin/workbench/inventory/statistics", all || active === "sklad");
  const discounts = useStats("discounts", "/admin/workbench/discounts", all || active === "slevy");

  const months = (orders.data?.months ?? []).map((m: any) => ({
    key: m.month, value: m.revenue, hint: `${m.orders} obj.`,
  }));

  return (
    <Container className="divide-y p-0">
      <header className="flex flex-wrap items-start justify-between gap-3 px-6 pb-4 pt-6">
        <div>
          <Heading>Statistiky — celý obchod</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
            Stejná čísla jako na pracovních stránkách, pohromadě a v grafech.
          </Text>
        </div>
        <ExpertToggle />
      </header>

      <SubTabs tabs={tabs} active={active} onSelect={setActive} />

      {/* ══ SOUHRN ══ */}
      {active === "souhrn" && (
        <div className="grid gap-4 px-6 py-5 lg:grid-cols-2">
          <Block title="Tržby — 12 měsíců">
            {orders.error ? <Fail error={orders.error} /> : !orders.data ? <Loading /> : (
              <>
                <Text size="small" weight="plus">
                  {formatCzk(orders.data.revenue_365d)} · {orders.data.orders_365d} objednávek ·
                  průměrně {formatCzk(orders.data.average_order ?? 0)}
                </Text>
                <div className="mt-3"><Bars data={months} label={formatCzk} /></div>
              </>
            )}
          </Block>
          <Block title="Dnes v obchodě">
            {products.error ? <Fail error={products.error} /> : !products.data ? <Loading /> : (
              <Text size="small">
                {products.data.kinds.bezne + products.data.kinds.zakazka + products.data.kinds.balicek + products.data.kinds.poskozene} produktů
                ({products.data.kinds.zakazka} zakázek · {products.data.kinds.balicek} balíčků · {products.data.kinds.poskozene} poškozených)
                <br />
                <span className="text-ui-fg-subtle">
                  Sklad: {products.data.stock.out} vyprodáno · {products.data.stock.low} dochází · {products.data.stock.ok} v pořádku
                  {inventory.data ? ` · hodnota ${formatCzk(inventory.data.stock_value_czk)}` : ""}
                </span>
              </Text>
            )}
          </Block>
          <Block title="Zakázky teď">
            {products.error ? <Fail error={products.error} /> : !products.data ? <Loading /> : (
              <Text size="small">
                {products.data.zakazky.total} celkem
                {Object.entries(products.data.zakazky.by_stage as Record<string, number>).map(([k, v]) => ` · ${productionStageLabels[k] ?? k}: ${v}`).join("")}
                <br />
                <span className="text-ui-fg-subtle">
                  zálohy {formatCzk(products.data.zakazky.deposits_paid)} · čeká na doplacení {formatCzk(products.data.zakazky.outstanding_total)}
                </span>
              </Text>
            )}
          </Block>
          <Block title="Zákazníci">
            {customers.error ? <Fail error={customers.error} /> : !customers.data ? <Loading /> : (
              <Text size="small">
                {customers.data.buyers_total} nakupujících · {customers.data.repeat_buyers} se vrací
                {customers.data.repeat_rate !== null ? ` (${customers.data.repeat_rate} %)` : ""}
                <br />
                <span className="text-ui-fg-subtle">
                  newsletter {customers.data.newsletter_subscribers} lidí · poptávka skladu: {inventory.data?.demand?.waiting_customers ?? "…"} čeká
                </span>
              </Text>
            )}
          </Block>
          <Block title="Nejprodávanější — 30 dní">
            {!products.data ? <Loading /> : products.data.top_sellers_30d.length === 0 ? (
              <Text size="small" className="text-ui-fg-subtle">Zatím nic.</Text>
            ) : products.data.top_sellers_30d.slice(0, 5).map((s: any) => (
              <Text key={s.product_id} size="small" className="mt-1">
                {s.qty}× {s.title} <span className="text-ui-fg-subtle">{formatCzk(s.revenue)}</span>
              </Text>
            ))}
          </Block>
          <Block title="Slevy, které vydělaly">
            {discounts.error ? <Fail error={discounts.error} /> : !discounts.data ? <Loading /> : (
              (() => {
                const rows = [
                  ...(discounts.data.promotions ?? []).filter((p: any) => (p.revenue ?? 0) > 0)
                    .map((p: any) => ({ id: p.id, name: p.code ?? "Automatická", revenue: p.revenue })),
                  ...(discounts.data.seasonal_selections ?? []).filter((s: any) => s.revenue > 0)
                    .map((s: any) => ({ id: s.id, name: s.title, revenue: s.revenue })),
                ].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
                return rows.length === 0 ? (
                  <Text size="small" className="text-ui-fg-subtle">Žádná akce zatím nic nepřinesla.</Text>
                ) : rows.map((r) => (
                  <Text key={r.id} size="small" className="mt-1">
                    {r.name} <span className="text-ui-fg-subtle">{formatCzk(r.revenue)}</span>
                  </Text>
                ));
              })()
            )}
          </Block>
          <div className="lg:col-span-2">
            <RawData data={{ orders: orders.data, products: products.data, customers: customers.data, inventory: inventory.data, discounts: discounts.data }} />
          </div>
        </div>
      )}

      {/* ══ OBJEDNÁVKY ══ */}
      {active === "objednavky" && (
        <div className="flex flex-col gap-4 px-6 py-5">
          {orders.error ? <Fail error={orders.error} /> : !orders.data ? <Loading /> : (
            <>
              <Block title="Tržby a objednávky po měsících">
                <Bars data={months} label={formatCzk} />
              </Block>
              <div className="grid gap-4 lg:grid-cols-2">
                <Block title="Klíčová čísla">
                  <Text size="small">
                    Průměrná objednávka {formatCzk(orders.data.average_order ?? 0)}
                    {orders.data.pickup_share !== null ? ` · osobní odběr ${orders.data.pickup_share} %` : ""}
                    {orders.data.lead_time_days_median !== null ? ` · od přijetí k odeslání ~${orders.data.lead_time_days_median} dní` : ""}
                    {orders.data.refunded_365d > 0 ? ` · vráceno ${formatCzk(orders.data.refunded_365d)}` : ""}
                  </Text>
                </Block>
                <Block title="Jak zákazníci platí">
                  {orders.data.payment_providers.map((p: any) => (
                    <Text key={p.provider} size="small" className="mt-1">{p.count}× {p.provider}</Text>
                  ))}
                </Block>
              </div>
              <RawData data={orders.data} />
            </>
          )}
        </div>
      )}

      {/* ══ PRODUKTY ══ */}
      {active === "produkty" && (
        <div className="flex flex-col gap-4 px-6 py-5">
          {products.error ? <Fail error={products.error} /> : !products.data ? <Loading /> : (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <Block title="Nejprodávanější — 30 dní">
                  <Bars
                    data={products.data.top_sellers_30d.slice(0, 8).map((s: any) => ({ key: `xxxx-${s.title.slice(0, 6)}`, value: s.qty, hint: formatCzk(s.revenue) }))}
                    label={(v) => `${v}×`}
                  />
                  {products.data.top_sellers_30d.slice(0, 8).map((s: any) => (
                    <Text key={s.product_id} size="xsmall" className="text-ui-fg-subtle mt-1">
                      {s.qty}× {s.title} · {formatCzk(s.revenue)}
                    </Text>
                  ))}
                </Block>
                <Block title="Nejvíc v oblíbených">
                  {products.data.wishlist_top.map((w: any) => (
                    <Text key={w.product_id} size="small" className="mt-1">{w.count}× {w.title}</Text>
                  ))}
                </Block>
                <Block title="Zakázky">
                  <Text size="small">
                    {products.data.zakazky.total} celkem
                    {Object.entries(products.data.zakazky.by_stage as Record<string, number>).map(([k, v]) => ` · ${productionStageLabels[k] ?? k}: ${v}`).join("")}
                    <br />
                    <span className="text-ui-fg-subtle">
                      zálohy {formatCzk(products.data.zakazky.deposits_paid)} · doplatky {formatCzk(products.data.zakazky.outstanding_total)}
                    </span>
                  </Text>
                </Block>
                <Block title="Balíčky a poškozené">
                  {products.data.bundles.length === 0 ? (
                    <Text size="small" className="text-ui-fg-subtle">Žádný balíček se neprodal.</Text>
                  ) : products.data.bundles.map((b: any) => (
                    <Text key={b.id} size="small" className="mt-1">{b.qty}× {b.title} · {formatCzk(b.revenue)}</Text>
                  ))}
                  <Text size="xsmall" className="text-ui-fg-subtle mt-2">
                    Výprodej poškozených: {products.data.clearance.total}
                    {products.data.clearance.sold_out_awaiting_removal > 0 ? ` (${products.data.clearance.sold_out_awaiting_removal} zmizí samo)` : ""}
                  </Text>
                </Block>
              </div>
              <RawData data={products.data} />
            </>
          )}
        </div>
      )}

      {/* ══ ZÁKAZNÍCI ══ */}
      {active === "zakaznici" && (
        <div className="flex flex-col gap-4 px-6 py-5">
          {customers.error ? <Fail error={customers.error} /> : !customers.data ? <Loading /> : (
            <>
              <Block title="Registrace po měsících (jen skutečné účty)">
                <Bars data={customers.data.registrations_by_month.map((r: any) => ({ key: r.month, value: r.count }))} label={(v) => `${v}`} />
              </Block>
              <div className="grid gap-4 lg:grid-cols-2">
                <Block title="Věrnost">
                  <Text size="small">
                    {customers.data.buyers_total} nakupujících · {customers.data.repeat_buyers} opakovaně
                    {customers.data.repeat_rate !== null ? ` (${customers.data.repeat_rate} %)` : ""}
                    <br />
                    <span className="text-ui-fg-subtle">newsletter: {customers.data.newsletter_subscribers}</span>
                  </Text>
                </Block>
                <Block title="Nejvěrnější">
                  {customers.data.top_customers.slice(0, 6).map((c: any) => (
                    <Text key={c.email} size="small" className="mt-1">
                      {c.name || c.email} · {formatCzk(c.total)} · {c.orders}×
                    </Text>
                  ))}
                </Block>
              </div>
              <RawData data={customers.data} />
            </>
          )}
        </div>
      )}

      {/* ══ SKLAD ══ */}
      {active === "sklad" && (
        <div className="flex flex-col gap-4 px-6 py-5">
          {inventory.error ? <Fail error={inventory.error} /> : !inventory.data ? <Loading /> : (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <Block title="Na policích">
                  <Text size="small">
                    {inventory.data.pieces_in_stock} kusů · hodnota {formatCzk(inventory.data.stock_value_czk)}
                    {inventory.data.unpriced_variants > 0 ? ` · ${inventory.data.unpriced_variants} bez ceny` : ""}
                    <br />
                    <span className="text-ui-fg-subtle">
                      {inventory.data.variants.out} vyprodáno · {inventory.data.variants.low} dochází · {inventory.data.variants.ok} v pořádku
                    </span>
                  </Text>
                </Block>
                <Block title="Poptávka">
                  <Text size="small">
                    {inventory.data.demand.waiting_customers} zákazníků čeká na naskladnění
                    <br />
                    <span className="text-ui-fg-subtle">{inventory.data.demand.wishlist_saves} uložení v oblíbených</span>
                  </Text>
                </Block>
              </div>
              <RawData data={inventory.data} />
            </>
          )}
        </div>
      )}

      {/* ══ SLEVY ══ */}
      {active === "slevy" && (
        <div className="flex flex-col gap-4 px-6 py-5">
          {discounts.error ? <Fail error={discounts.error} /> : !discounts.data ? <Loading /> : (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <Block title="Kódy podle přínosu">
                  {(discounts.data.promotions ?? []).filter((p: any) => (p.used_count ?? 0) > 0)
                    .sort((a: any, b: any) => (b.revenue ?? 0) - (a.revenue ?? 0))
                    .map((p: any) => (
                      <Text key={p.id} size="small" className="mt-1">
                        {p.code ?? "Automatická"} · přineslo {formatCzk(p.revenue ?? 0)} · sleva {formatCzk(p.discount_given ?? 0)} · {p.used_count}×
                      </Text>
                    ))}
                </Block>
                <Block title="Sezónní akce">
                  {(discounts.data.seasonal_selections ?? []).map((s: any) => (
                    <Text key={s.id} size="small" className="mt-1">
                      {s.title}{s.status === "published" ? " (běží)" : ""} · {formatCzk(s.revenue)} · {s.orders} obj.
                    </Text>
                  ))}
                </Block>
              </div>
              <Text size="xsmall" className="text-ui-fg-muted">
                Počítáno z posledních {discounts.data.orders_scanned} objednávek.
              </Text>
              <RawData data={discounts.data} />
            </>
          )}
        </div>
      )}
    </Container>
  );
};

const queryClient = new QueryClient();
const Page = () => (
  <QueryClientProvider client={queryClient}><Inner /></QueryClientProvider>
);
export const config = defineRouteConfig({
  label: "Statistiky+",
  icon: SquaresPlus,
  rank: 90,
});
export default Page;
