import {
  Badge,
  Button,
  Container,
  Heading,
  Skeleton,
  Text,
  Toaster,
} from "@medusajs/ui";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { EmptyState } from "../../../components/empty-state";
import { ProductionOrderActions } from "../../../components/production-order-actions";
import { WorkTabs } from "../../../components/work-tabs";
import { formatAmount, formatDate } from "../../../lib/format";
import { sdk } from "../../../lib/sdk";

type ProductionOrder = {
  id: string;
  order_id: string;
  display_id: number | string | null;
  customer_name: string | null;
  stage: string;
  currency_code: string;
  agreed_total: number;
  paid_total: number;
  outstanding: number;
  deposit_percentage: number;
  has_open_balance_request: boolean;
  estimated_completion_at: string | null;
  customer_note: string | null;
};

type ProductionResponse = {
  production_orders: ProductionOrder[];
  summary: Record<string, number>;
};

/**
 * Stage sections, stacked (§7.2). Production volume is handmade-scale, so one
 * page showing the whole picture beats seven near-empty ones.
 */
const stages: Array<{ key: string; label: string; description: string }> = [
  {
    key: "specification_pending",
    label: "Nové zadání",
    description: "Zákazník popsal, co chce. Přečtěte si to a potvrďte cenu.",
  },
  {
    key: "confirmed",
    label: "Potvrzeno",
    description: "Cena je domluvená, výroba ještě nezačala.",
  },
  {
    key: "in_production",
    label: "Ve výrobě",
    description: "Právě se na tom pracuje.",
  },
  {
    key: "awaiting_balance",
    label: "Čeká na doplatek",
    description: "Hotovo, ale zákazník ještě nedoplatil.",
  },
  {
    key: "ready_to_ship",
    label: "Připraveno k odeslání",
    description: "Zaplaceno a hotovo — odešlete v Denní práci.",
  },
];

/** How much of the agreed price has arrived, as a bar she can read at a glance. */
const PaymentBar = ({ order }: { order: ProductionOrder }) => {
  const ratio =
    order.agreed_total > 0
      ? Math.min(1, order.paid_total / order.agreed_total)
      : 0;
  const fullyPaid = order.outstanding <= 0.01;

  return (
    <div className="flex flex-col gap-y-1">
      <Text size="small">
        <span className="font-medium">
          {formatAmount(order.paid_total, order.currency_code)}
        </span>{" "}
        <span className="text-ui-fg-subtle">
          z {formatAmount(order.agreed_total, order.currency_code)}
        </span>
      </Text>
      <div className="bg-ui-bg-subtle h-1.5 w-full overflow-hidden rounded-full">
        <div
          className={fullyPaid ? "bg-ui-tag-green-icon h-full" : "bg-ui-tag-orange-icon h-full"}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
      {!fullyPaid && (
        <Text size="xsmall" className="text-ui-fg-error">
          chybí {formatAmount(order.outstanding, order.currency_code)}
        </Text>
      )}
    </div>
  );
};

const ZakazkyInner = () => {
  const { data, isLoading, isError } = useQuery<ProductionResponse>({
    queryKey: ["production-orders"],
    queryFn: () =>
      sdk.client.fetch("/admin/made-to-order/orders", { query: { limit: 200 } }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const all = data?.production_orders ?? [];
  const active = all.filter(
    (order) => !["completed", "cancelled"].includes(order.stage)
  );

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="p-0">
        <WorkTabs active="zakazky" />

        <header className="px-6 pb-5 pt-6">
          <Heading>Zakázky</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
            Zakázky od zadání přes výrobu až po doplatek — vždy s jedním dalším
            krokem.
          </Text>
        </header>
      </Container>

      {isLoading && (
        <Container className="p-6">
          <Skeleton className="h-28 rounded-lg" />
        </Container>
      )}

      {isError && (
        <Container className="p-0">
          <EmptyState
            title="Zakázky se nepodařilo načíst"
            description="Zkuste stránku obnovit."
          />
        </Container>
      )}

      {!isLoading && !isError && active.length === 0 && (
        <Container className="p-0">
          <EmptyState
            title="Žádná zakázka"
            description="Zakázka vznikne, když si zákazník objedná produkt označený „Na zakázku“."
            action={
              <Button size="small" variant="secondary" asChild>
                <Link to="/zakazkova-vyroba">Produkty na zakázku</Link>
              </Button>
            }
          />
        </Container>
      )}

      {!isLoading &&
        !isError &&
        active.length > 0 &&
        stages.map((stage) => {
          const rows = all.filter((order) => order.stage === stage.key);
          if (!rows.length) {
            return null;
          }

          return (
            <Container key={stage.key} className="divide-y p-0">
              <header className="px-6 pb-4 pt-5">
                <div className="flex items-center gap-x-2">
                  <Heading level="h2">{stage.label}</Heading>
                  <Badge size="2xsmall">{rows.length}</Badge>
                </div>
                <Text size="small" className="text-ui-fg-subtle mt-1">
                  {stage.description}
                </Text>
              </header>

              <div className="divide-y">
                {rows.map((order) => (
                  <article
                    key={order.id}
                    className="grid gap-4 px-6 py-5 lg:grid-cols-[140px_minmax(0,1fr)_190px_minmax(320px,auto)] lg:items-start"
                  >
                    <div>
                      <Text size="small" weight="plus">
                        #{order.display_id ?? "—"}
                      </Text>
                      {order.estimated_completion_at && (
                        <Text size="xsmall" className="text-ui-fg-muted mt-1">
                          termín {formatDate(order.estimated_completion_at)}
                        </Text>
                      )}
                    </div>

                    <div className="min-w-0">
                      <Text size="small" weight="plus" className="truncate">
                        {order.customer_name ?? "Zákazník"}
                      </Text>
                      {order.customer_note && (
                        <Text
                          size="small"
                          className="text-ui-fg-subtle mt-1 line-clamp-2"
                        >
                          {order.customer_note}
                        </Text>
                      )}
                    </div>

                    <PaymentBar order={order} />

                    <div className="flex flex-col items-start gap-2 lg:items-end">
                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        {order.has_open_balance_request && (
                          <Badge size="2xsmall" color="orange">
                            Odkaz odeslán
                          </Badge>
                        )}
                        <Button size="small" variant="transparent" asChild>
                          <Link to={`/orders/${order.order_id}`}>
                            Otevřít objednávku
                          </Link>
                        </Button>
                      </div>
                      <ProductionOrderActions order={order} />
                    </div>
                  </article>
                ))}
              </div>
            </Container>
          );
        })}
      <Toaster />
    </div>
  );
};

const queryClient = new QueryClient();

/**
 * Zakázky — the commissions queue, as a tab of Přehled.
 *
 * Shows how much of each agreed price has actually arrived, because a
 * commission is the one order type where „paid" is a spectrum: a deposit up
 * front, a balance on completion. Judging the next step without seeing where a
 * piece sits on that spectrum is guesswork.
 *
 * The per-stage **actions** (confirm specification, start production, request
 * the balance) arrive with P6-1; this is the read-only half.
 */
const ZakazkyPage = () => (
  <QueryClientProvider client={queryClient}>
    <ZakazkyInner />
  </QueryClientProvider>
);

export default ZakazkyPage;
