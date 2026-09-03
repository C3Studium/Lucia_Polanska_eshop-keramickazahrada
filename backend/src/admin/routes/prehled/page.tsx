import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ArrowPath, House } from "@medusajs/icons";
import {
  Badge,
  Input,
  toast,
  Button,
  Container,
  Heading,
  Skeleton,
  Text,
  clx,
} from "@medusajs/ui";
import {
  QueryClient,
  useMutation,
  useQueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  OrderRow,
  type MerchantOrder,
} from "../../components/merchant-order-queue";
import { WorkTabs } from "../../components/work-tabs";
import { StorefrontBridgeButton } from "../../components/storefront-bridge-button";
import { formatAmount, formatDate } from "../../lib/format";
import { sdk } from "../../lib/sdk";

type EndingSoon = {
  type: "price_list" | "seasonal_selection";
  title: string;
  ends_at: string;
};

type OperationsSummary = {
  generated_at: string;
  attention: {
    payment_problems: number;
    failed_emails: number;
    carrier_failures: number;
    overdue_production: number;
    window_days: number;
  };
  today: {
    new_orders: number;
    working: number;
    shipping: number;
    shipping_oldest_days: number | null;
    awaiting_balance: {
      count: number;
      outstanding_amount: number;
      currency_code: string;
      oldest_request_days: number | null;
    };
    in_production: { count: number; nearest_deadline: string | null };
  };
  shop: {
    low_stock: number;
    sold_out: number;
    low_stock_threshold: number;
    pending_reviews: number;
    ending_soon: EndingSoon[];
    active_sales: number;
    active_selections: number;
    discount_codes: number;
    automatic_discounts: number;
  };
  next_up: MerchantOrder[];
};

type Tone = "default" | "warning" | "critical";

type Tile = {
  key: string;
  label: string;
  value: string;
  /** Shown under the value: an empty-state sentence or a warning. */
  hint?: string;
  tone?: Tone;
  to: string;
  cta: string;
};

const toneClass: Record<Tone, string> = {
  default: "",
  warning: "text-ui-fg-subtle",
  critical: "text-ui-fg-error",
};

const TileCard = ({ tile }: { tile: Tile }) => (
  <Link
    to={tile.to}
    className="bg-ui-bg-base hover:bg-ui-bg-base-hover transition-fg flex min-h-[8.5rem] flex-col px-6 py-6 outline-none focus-visible:shadow-borders-focus"
  >
    <Text size="small" className="text-ui-fg-subtle">
      {tile.label}
    </Text>
    <Heading
      level="h2"
      className={clx("mt-2 text-2xl leading-tight", toneClass[tile.tone ?? "default"])}
    >
      {tile.value}
    </Heading>
    {tile.hint && (
      <Text
        size="small"
        className={clx(
          "mt-1.5",
          tile.tone === "critical" ? "text-ui-fg-error" : "text-ui-fg-subtle"
        )}
      >
        {tile.hint}
      </Text>
    )}
    {/* Pushed to the bottom so every card's action sits on the same line,
        however much text is above it. */}
    <Text size="small" className="text-ui-fg-interactive mt-auto pt-3">
      {tile.cta}
    </Text>
  </Link>
);

const Zone = ({
  title,
  description,
  tiles,
}: {
  title: string;
  description?: string;
  tiles: Tile[];
}) => {
  if (!tiles.length) {
    return null;
  }
  return (
    <section className="pt-2">
      <header className="flex flex-col gap-y-1 px-6 pb-4 pt-6">
        <Heading level="h2">{title}</Heading>
        {description && (
          <Text size="small" className="text-ui-fg-subtle max-w-2xl">
            {description}
          </Text>
        )}
      </header>
      <div className="grid gap-px bg-ui-border-base sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <TileCard key={tile.key} tile={tile} />
        ))}
      </div>
    </section>
  );
};

/**
 * Tiles that only exist when something is wrong (§4 zone 1). An empty
 * „Vyžaduje pozornost" section is not reassurance, it is clutter — so the whole
 * zone disappears rather than showing four zeroes.
 */
const attentionTiles = (summary: OperationsSummary): Tile[] => {
  const tiles: Tile[] = [];
  const { attention } = summary;

  if (attention.payment_problems > 0) {
    tiles.push({
      key: "payment-problems",
      label: "Problémy s platbou",
      value: String(attention.payment_problems),
      tone: "critical",
      hint: "Platba nedorazila nebo se nezdařila.",
      to: "/prehled/prace?krok=problem-s-platbou",
      cta: "Vyřešit",
    });
  }

  if (attention.failed_emails > 0) {
    tiles.push({
      key: "failed-emails",
      label: "Nezdařené e-maily",
      value: String(attention.failed_emails),
      tone: "critical",
      hint: `Za posledních ${attention.window_days} dní se nepodařilo odeslat.`,
      to: "/prehled/emaily",
      cta: "Zobrazit a poslat znovu",
    });
  }

  if (attention.carrier_failures > 0) {
    tiles.push({
      key: "carrier-failures",
      label: "Zásilky se nepodařilo vytvořit",
      value: String(attention.carrier_failures),
      tone: "critical",
      hint: "Zkuste vytvoření zásilky znovu.",
      to: "/prehled/prace?krok=k-odeslani",
      cta: "Zkusit znovu",
    });
  }

  if (attention.overdue_production > 0) {
    tiles.push({
      key: "overdue-production",
      label: "Zpožděné zakázky",
      value: String(attention.overdue_production),
      tone: "critical",
      hint: "Slíbený termín už uplynul.",
      to: "/prehled/zakazky",
      cta: "Zobrazit zakázky",
    });
  }

  return tiles;
};

const workTiles = (summary: OperationsSummary): Tile[] => {
  const { today } = summary;
  const tiles: Tile[] = [
    {
      key: "new-orders",
      label: "Nové objednávky",
      value: String(today.new_orders),
      hint: today.new_orders === 0 ? "Žádné nové — máte klid ☕" : undefined,
      to: "/prehled/prace?krok=nove",
      cta: today.new_orders === 0 ? "Otevřít frontu" : "Začít",
    },
    {
      key: "working",
      label: "Připravujeme",
      value: String(today.working),
      hint: today.working === 0 ? "Nic rozpracovaného" : undefined,
      to: "/prehled/prace?krok=pripravujeme",
      cta: "Otevřít",
    },
    {
      key: "shipping",
      label: "K odeslání",
      value: String(today.shipping),
      hint:
        today.shipping === 0
          ? "Vše odesláno"
          : today.shipping_oldest_days !== null &&
              today.shipping_oldest_days > 3
            ? `Nejstarší čeká ${today.shipping_oldest_days} dní.`
            : undefined,
      tone:
        today.shipping > 0 &&
        today.shipping_oldest_days !== null &&
        today.shipping_oldest_days > 3
          ? "critical"
          : "default",
      to: "/prehled/prace?krok=k-odeslani",
      cta: "Otevřít",
    },
  ];

  // Hidden at zero: she has no reason to think about money nobody owes.
  if (today.awaiting_balance.count > 0) {
    const overdue =
      today.awaiting_balance.oldest_request_days !== null &&
      today.awaiting_balance.oldest_request_days > 7;

    tiles.push({
      key: "awaiting-balance",
      label: "Čeká na doplatek",
      value: formatAmount(
        today.awaiting_balance.outstanding_amount,
        today.awaiting_balance.currency_code
      ),
      hint: overdue
        ? `Nejstarší žádost je ${today.awaiting_balance.oldest_request_days} dní stará.`
        : `${today.awaiting_balance.count} zakázk${
            today.awaiting_balance.count === 1 ? "a" : "y"
          } čeká na zaplacení.`,
      tone: overdue ? "critical" : "default",
      to: "/prehled/zakazky",
      cta: "Zobrazit",
    });
  }

  const deadlineDays =
    today.in_production.nearest_deadline !== null
      ? Math.ceil(
          (new Date(today.in_production.nearest_deadline).getTime() -
            Date.now()) /
            (24 * 60 * 60 * 1000)
        )
      : null;

  tiles.push({
    key: "in-production",
    label: "Ve výrobě",
    value: String(today.in_production.count),
    hint:
      today.in_production.count === 0
        ? "Žádná zakázka ve výrobě"
        : today.in_production.nearest_deadline
          ? `Nejbližší termín ${formatDate(today.in_production.nearest_deadline)}`
          : undefined,
    tone:
      deadlineDays !== null && deadlineDays <= 3 && today.in_production.count > 0
        ? "critical"
        : "default",
    to: "/prehled/zakazky",
    cta: "Zobrazit",
  });

  return tiles;
};

const shopTiles = (summary: OperationsSummary): Tile[] => {
  const { shop } = summary;
  const tiles: Tile[] = [
    {
      key: "low-stock",
      label: "Dochází na skladě",
      value: String(shop.low_stock),
      hint:
        shop.low_stock === 0
          ? "Zásoby v pořádku"
          : `Hranice upozornění: ${shop.low_stock_threshold} ks`,
      tone: shop.low_stock > 0 ? "critical" : "default",
      to: "/sklad-nizky-stav",
      cta: "Zobrazit",
    },
  ];

  if (shop.sold_out > 0) {
    tiles.push({
      key: "sold-out",
      label: "Vyprodáno",
      value: String(shop.sold_out),
      hint: "Zákazníci si to nemohou objednat.",
      tone: "critical",
      to: "/sklad-vyprodano",
      cta: "Zobrazit",
    });
  }

  tiles.push({
    key: "reviews",
    label: "Recenze ke schválení",
    value: String(shop.pending_reviews),
    hint: shop.pending_reviews === 0 ? "Žádné nové recenze" : undefined,
    tone: shop.pending_reviews > 5 ? "critical" : "default",
    to: "/reviews",
    cta: "Otevřít",
  });

  // What is currently discounted. Three instruments run independently (§13) and
  // are easy to forget once live, so they get one tile rather than three.
  const discountsRunning =
    shop.active_sales + shop.active_selections + shop.discount_codes +
    shop.automatic_discounts;

  if (discountsRunning > 0) {
    const parts = [
      shop.active_selections > 0 ? `${shop.active_selections} akce` : null,
      shop.active_sales > 0 ? `${shop.active_sales} ceníky` : null,
      shop.discount_codes > 0 ? `${shop.discount_codes} kódů` : null,
      shop.automatic_discounts > 0
        ? `${shop.automatic_discounts} automatických`
        : null,
    ].filter(Boolean);

    tiles.push({
      key: "discounts",
      label: "Běžící slevy",
      value: String(discountsRunning),
      hint: parts.join(" · "),
      to: "/prehled/slevy",
      cta: "Zobrazit",
    });
  }

  if (shop.ending_soon.length) {
    const first = shop.ending_soon[0];
    tiles.push({
      key: "ending-soon",
      label: "Končí brzy",
      value: first.title,
      hint: `Končí ${formatDate(first.ends_at)}${
        shop.ending_soon.length > 1
          ? ` · a další ${shop.ending_soon.length - 1}`
          : ""
      }`,
      to: "/prehled/slevy",
      cta: "Zobrazit",
    });
  }

  return tiles;
};

/**
 * Vitrína + Dovolená — the shop seen from outside, on the dashboard
 * (Matěj, 2026-08-06). The check walks the customer's path server-side;
 * the vacation toggle writes the merchant setting the payment workflow
 * enforces. Display here, law in the backend.
 */
const VitrinaCard = () => {
  const queryClient = useQueryClient();
  const { data } = useQuery<{
    open: boolean;
    vacation: boolean;
    vacation_until: string | null;
    problems: { text: string; path: string | null; severity: "warn" | "bad" }[];
  }>({
    queryKey: ["storefront-check"],
    queryFn: () => sdk.client.fetch("/admin/workbench/storefront-check"),
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
  });

  const { data: settings } = useQuery<{ settings: any }>({
    queryKey: ["merchant-settings"],
    queryFn: () => sdk.client.fetch("/admin/merchant-settings"),
  });

  const vacationOn = Boolean(settings?.settings?.vacation_enabled);

  return (
    <section className="border-ui-border-base border-b px-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {data ? (
            <Badge size="2xsmall" color={data.open && !vacationOn ? "green" : vacationOn ? "orange" : "red"}>
              {vacationOn
                ? "Dovolená"
                : data.open
                  ? "Obchod je otevřený"
                  : "Něco brání nákupu"}
            </Badge>
          ) : (
            <Badge size="2xsmall" color="grey">
              Kontroluji obchod…
            </Badge>
          )}
          {vacationOn && settings?.settings?.vacation_until && (
            <Text size="xsmall" className="text-ui-fg-subtle">
              do {settings.settings.vacation_until}
            </Text>
          )}
        </div>
        <Link
          to="/dovolena-oznameni"
          className="text-ui-fg-interactive txt-small hover:underline"
        >
          Dovolená a oznámení →
        </Link>
      </div>

      {(data?.problems ?? []).map((problem, index) => (
        <Text
          key={index}
          size="xsmall"
          className={
            problem.severity === "bad"
              ? "text-ui-fg-error mt-2"
              : "text-ui-fg-subtle mt-2"
          }
        >
          {problem.severity === "bad" ? "●" : "○"} {problem.text}
          {problem.path && (
            <Link to={problem.path} className="text-ui-fg-interactive ml-1 hover:underline">
              Vyřešit
            </Link>
          )}
        </Text>
      ))}
    </section>
  );
};

const PrehledInner = () => {
  const { data, isLoading, isError, refetch, isFetching } =
    useQuery<OperationsSummary>({
      queryKey: ["operations-summary"],
      queryFn: () => sdk.client.fetch("/admin/operations/summary"),
      // The dashboard is left open on a workbench all day; stale counts here
      // would send her to an empty queue.
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
    });

  if (isLoading) {
    return (
      <Container className="divide-y p-0">
        <WorkTabs active="prehled" />
        <header className="px-6 pb-2 pt-6">
          <Heading>Přehled</Heading>
        </header>
        <div className="grid gap-px bg-ui-border-base sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="bg-ui-bg-base px-6 py-5">
              <Skeleton className="h-16 rounded-lg" />
            </div>
          ))}
        </div>
      </Container>
    );
  }

  if (isError || !data) {
    return (
      <Container className="p-0">
        <WorkTabs active="prehled" />
        <div className="flex min-h-64 flex-col items-center justify-center gap-y-3 px-6 py-10 text-center">
          <Heading level="h2">Přehled se nepodařilo načíst</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Zkuste to prosím znovu.
          </Text>
          <Button size="small" variant="secondary" onClick={() => refetch()}>
            Zkusit znovu
          </Button>
        </div>
      </Container>
    );
  }

  const attention = attentionTiles(data);
  const work = workTiles(data);
  const shop = shopTiles(data);

  const allClear =
    attention.length === 0 &&
    data.today.new_orders === 0 &&
    data.today.working === 0 &&
    data.today.shipping === 0 &&
    data.next_up.length === 0;

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="divide-y p-0">
        <WorkTabs active="prehled" />
      <VitrinaCard />

        <header className="flex flex-wrap items-start justify-between gap-3 px-6 pb-2 pt-6">
          <div>
            <Heading>Přehled</Heading>
            <Text size="small" className="text-ui-fg-subtle mt-2">
              {formatDate(data.generated_at)} — co je dnes potřeba udělat.
            </Text>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* The way onto the live site with the admin bar switched on —
                see components/storefront-bridge-button.tsx. */}
            <StorefrontBridgeButton path="/cz" />
            <Button
              size="small"
              variant="secondary"
              isLoading={isFetching}
              onClick={() => refetch()}
            >
              <ArrowPath />
              Obnovit
            </Button>
          </div>
        </header>

        {/* Three groups in the order the day runs: what is broken, what is
            moving, what the shop needs. Each says what it is for — „Obchod"
            alone told nobody anything. */}
        <Zone
          title="Vyžaduje pozornost"
          description="Něco se nepovedlo a čeká to na vás."
          tiles={attention}
        />
        <Zone
          title="Dnešní práce"
          description="Objednávky a zakázky, které dnes posunete dál."
          tiles={work}
        />
        <Zone
          title="Obchod"
          description="Zásoby, recenze a akce — nic z toho nehoří."
          tiles={shop}
        />
      </Container>

      <Container className="divide-y p-0">
        <header className="px-6 pb-4 pt-6">
          <Heading level="h2">Na řadě</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-2">
            Nejdéle čekající objednávky, u kterých je na tahu někdo z vás.
          </Text>
        </header>

        {data.next_up.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-y-2 px-6 py-10 text-center">
            <Heading level="h2">
              {allClear ? "Dnes nic nehoří. Všechno zvládnuto 🎉" : "Nic nečeká"}
            </Heading>
            <Text size="small" className="text-ui-fg-subtle max-w-md">
              Nové objednávky se tu objeví samy.
            </Text>
          </div>
        ) : (
          <div className="divide-y">
            {/*
              The same card component the queues use, so an order looks and
              behaves identically wherever she meets it.
            */}
            {data.next_up.map((order) => (
              <OrderRow key={order.order_id} order={order} stage={order.stage} />
            ))}
          </div>
        )}
      </Container>
    </div>
  );
};

const queryClient = new QueryClient();

/**
 * Přehled (§4) — the page that answers „co mám udělat teď?".
 *
 * Deliberately not analytics: no charts, no trends, nothing that needs
 * interpretation. Every tile is a count with one destination, and the zones are
 * ordered the way the day is: what is broken, what is in progress, what the
 * shop needs. Counts live here, on page headers and in the bell, because the
 * sidebar cannot carry badges (§2.1).
 */
const PrehledPage = () => (
  <QueryClientProvider client={queryClient}>
    <PrehledInner />
  </QueryClientProvider>
);

export const config = defineRouteConfig({
  label: "Přehled",
  icon: House,
  // Sidebar reads as her workflow: Přehled first, technical pages last.
  rank: 0,
});

export default PrehledPage;
