import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Envelope, ReceiptPercent, User, Users } from "@medusajs/icons";
import {
  Badge,
  Container,
  Drawer,
  Heading,
  Input,
  Skeleton,
  Text,
} from "@medusajs/ui";
import {
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../../components/empty-state";
import { RowOptionsMenu } from "../../components/row-options-menu";
import { CopyId, ExpertToggle, useExpertMode } from "../../lib/expert-mode";
import { SubTabs } from "../../components/work-tabs";
import { formatCzk } from "../../lib/workbench";
import { formatDate } from "../../lib/format";
import { sdk } from "../../lib/sdk";
import { useScrollMemory } from "../../lib/scroll-memory";
import { useUrlState } from "../../lib/url-state";
import {
  CustomerCard,
  isRegularCustomer,
  RegularCustomerBadge,
} from "../../components/customer-card";
import {
  LoyaltySettingsButton,
  useLoyaltySettings,
} from "../../components/loyalty-code-panel";
import { adminQueryClient } from "../../lib/query-client"
import { ceskaChyba } from "../../lib/ceska-chyba";

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
  has_account?: boolean;
  /** true = ověřený e-mail, false = účet čeká na ověření, null = bez účtu. */
  email_verified?: boolean | null;
  records_count?: number;
  record_ids?: string[];
  email: string;
  emails?: string[];
  phone?: string | null;
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
  groups?: { registrovani: number; neregistrovani: number };
};

/**
 * Whether the row should nudge her to say thank you.
 *
 * Three orders or more, with the most recent inside six months — someone who has
 * come back, and recently enough that a thank-you still reads as one rather than
 * as an attempt to win back somebody who quietly left. Only a hint: the button is
 * on every row, and the decision stays hers.
 */
const THANKS_MIN_ORDERS = 3;
const THANKS_WINDOW_DAYS = 180;

const deservesThanks = (customer: {
  orders_count: number;
  last_order_at: string | null;
}) => {
  if (customer.orders_count < THANKS_MIN_ORDERS) return false;
  if (!customer.last_order_at) return false;
  const days =
    (Date.now() - new Date(customer.last_order_at).getTime()) / 86_400_000;
  return days <= THANKS_WINDOW_DAYS;
};

/**
 * Karta zákazníka ve výsuvném panelu — hlavní čísla, poznámka, slevový kód
 * a rozbalovací zbytek (`components/customer-card.tsx`, sdílí ji i widget na
 * nativním detailu zákazníka). Obsah se načte až při otevření.
 *
 * 17. 11. 2026: jeden panel pro celou stránku, ne dva v každém řádku —
 * otevírá ho klik na řádek i „…" › Poslat slevový kód.
 */
const CustomerDrawer = ({
  customer,
  withCode,
  open,
  onOpenChange,
}: {
  customer: WorkbenchCustomer | null;
  /** Otevřít rovnou s formulářem „Poslat slevový kód". */
  withCode: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => (
  <Drawer open={open} onOpenChange={onOpenChange}>
    <Drawer.Content>
      <Drawer.Header>
        <Drawer.Title>{customer ? customer.name || customer.email : ""}</Drawer.Title>
      </Drawer.Header>
      <Drawer.Body className="overflow-y-auto">
        {open && customer && (
          /* `key`: formulář kódu se čte jen při prvním vykreslení karty. */
          <CustomerCard
            key={`${customer.id}-${withCode ? "kod" : "karta"}`}
            customerId={customer.id}
            initialCodeOpen={withCode}
          />
        )}
      </Drawer.Body>
    </Drawer.Content>
  </Drawer>
);

/*
 * Jedna řada záložek (17. 11. 2026). Dřív byly dvě nad sebou — „Uživatelé |
 * Neregistrovaní" a pod tím filtry uživatelů — a nebylo vidět, která řada
 * platí. Teď je to jedna řada; v adrese zůstaly oba klíče (`skupina`,
 * `zalozka`), takže staré odkazy i návrat z detailu fungují dál.
 * Filtry Doplatek / Vrací se / Newsletter umí backend jen u uživatelů.
 */
const tabs = [
  { key: "vse", label: "Uživatelé" },
  { key: "dluzi", label: "Čeká na doplatek" },
  { key: "vraci", label: "Vrací se" },
  { key: "newsletter", label: "Newsletter" },
  { key: "neregistrovani", label: "Neregistrovaní" },
  { key: "statistiky", label: "Statistiky" },
];

/* Jedna mřížka pro hlavičku i řádky, ať sloupce sedí. Pružný je jen Zákazník. */
const CUSTOMER_COLS =
  "lg:grid-cols-[minmax(0,1fr)_150px_130px_130px_40px]";

const objednavek = (count: number) =>
  count === 0
    ? "zatím bez objednávky"
    : count === 1
      ? "1 objednávka"
      : count <= 4
        ? `${count} objednávky`
        : `${count} objednávek`;

/** Zákazníci+ → Statistiky: repeat rate, top customers, registrations. */
const CustomerStats = () => {
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["workbench-customer-statistics"],
    queryFn: () => sdk.client.fetch("/admin/workbench/customers/statistics"),
    refetchOnWindowFocus: true,
    retry: 1,
  });
  if (error) {
    return (
      <div className="px-6 py-5">
        <Text size="small" className="text-ui-fg-error">
          Statistiky se nepodařilo načíst:{" "}
          {ceskaChyba(error, "neznámá chyba")}
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
          {data.accounts_total ?? data.customers_total} s účtem · newsletter odebírá{" "}
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
  /* Návrat z detailu zákazníka vrátí i tam, kde v seznamu byla. */
  useScrollMemory("zakaznici");
  const navigate = useNavigate();
  /* Skupina: Uživatelé (mají účet — jen u nich jdou filtry Doplatek / Vrací
     se / Newsletter) vs. Neregistrovaní (jen hosté, na backendu sloučení
     podle jména+telefonu, i když nakoupili pod různými e-maily). V jedné
     řadě záložek (`tabs`), v adrese pořád dva klíče. */
  /* Skupina, záložka i hledání jdou do adresy, ne do paměti komponenty:
     odchodem na detail zákazníka by se zahodily a návrat by začínal
     u Uživatelů ve „Vše" s prázdným polem (měřeno 11. 11. 2026). */
  const [group, setGroup] = useUrlState<"uzivatele" | "neregistrovani">(
    "skupina",
    "uzivatele"
  );
  const [active, setActive] = useUrlState<string>("zalozka", "vse");
  // Instant input, debounced query — one request per thought, not per keystroke.
  const [search, setSearch] = useUrlState<string>("hledat", "");
  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [searchInput, setSearch]);
  const expert = useExpertMode();
  // Hranice „Stálý zákazník" = hranice, od které chodí kód (nastavení).
  const { data: loyaltySettings } = useLoyaltySettings();

  const params = new URLSearchParams();
  params.set(
    "skupina",
    group === "uzivatele" ? "registrovani" : "neregistrovani"
  );
  if (group === "uzivatele") {
    if (active === "dluzi") params.set("owing", "true");
    if (active === "vraci") params.set("repeat", "true");
    if (active === "newsletter") params.set("newsletter", "true");
  }
  if (search.trim()) params.set("q", search.trim());
  if (expert) params.set("expert", "1");

  const showingStats = group === "uzivatele" && active === "statistiky";

  const { data, isLoading, isError } = useQuery<WorkbenchCustomersResponse>({
    queryKey: ["workbench-customers", group, active, search, expert],
    enabled: !showingStats,
    queryFn: () =>
      sdk.client.fetch(`/admin/workbench/customers?${params.toString()}`),
    refetchOnWindowFocus: true,
  });

  const rows = data?.customers ?? [];

  /* Počty skupin si pamatujeme: ve Statistikách se seznam nenačítá a čísla
     u záložek by jinak zmizela. */
  const [groupCounts, setGroupCounts] = useState<
    WorkbenchCustomersResponse["groups"] | undefined
  >(undefined);
  useEffect(() => {
    if (data?.groups) setGroupCounts(data.groups);
  }, [data?.groups]);

  const activeTab = group === "neregistrovani" ? "neregistrovani" : active;
  const selectTab = (key: string) => {
    if (key === "neregistrovani") {
      setGroup("neregistrovani");
      setActive("vse");
    } else {
      setGroup("uzivatele");
      setActive(key);
    }
  };

  /* Karta: komu a jestli rovnou s formulářem kódu. Zákazník zůstává
     i po zavření, ať panel při zavírání nezbělá. */
  const [karta, setKarta] = useState<{
    customer: WorkbenchCustomer;
    withCode: boolean;
  } | null>(null);
  const [kartaOpen, setKartaOpen] = useState(false);
  const otevritKartu = (customer: WorkbenchCustomer, withCode = false) => {
    setKarta({ customer, withCode });
    setKartaOpen(true);
  };

  return (
    <Container className="divide-y p-0">
      <header className="flex flex-wrap items-start justify-between gap-3 px-6 pb-4 pt-6">
        <div>
          <Heading>Zákazníci</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
            Nákupy, doplatky, oblíbené i newsletter u každého zákazníka.
            Seřazeno podle toho, kolik u vás kdo utratil.
          </Text>
        </div>
        <div className="flex flex-wrap items-center gap-3">
        <LoyaltySettingsButton />
        <ExpertToggle />
        <Input
          size="small"
          type="search"
          placeholder="Hledat jméno nebo e-mail…"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className="w-64 max-w-full"
        />
        </div>
      </header>

      <div>
        <SubTabs
          tabs={tabs.map((tab) => ({
            ...tab,
            count:
              tab.key === "vse"
                ? groupCounts?.registrovani
                : tab.key === "neregistrovani"
                  ? groupCounts?.neregistrovani
                  : undefined,
          }))}
          active={activeTab}
          onSelect={selectTab}
        />
        {group === "neregistrovani" && (
          <Text size="xsmall" className="text-ui-fg-muted -mt-2 px-6 pb-3">
            Hosté bez účtu — stejné jméno a telefon se počítá jako jeden
            člověk, i s různými e-maily.
          </Text>
        )}
      </div>

      {showingStats && <CustomerStats />}

      {!showingStats && isLoading && (
        <div className="flex flex-col gap-y-3 px-6 py-5">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      )}

      {!showingStats && isError && (
        <EmptyState
          title="Zákazníky se nepodařilo načíst"
          description="Zkuste stránku obnovit."
        />
      )}

      {!showingStats && !isLoading && !isError && rows.length === 0 && (
        <EmptyState
          title="Nikdo tu není"
          description="Žádný zákazník neodpovídá zvolenému filtru."
        />
      )}

      {!showingStats && !isLoading && !isError && rows.length > 0 && (
        <div className="divide-y">
          {/* Hlavička tabulky — stejná mřížka jako řádky. Na úzké obrazovce
              se řádek skládá pod sebe a hlavička by nic neříkala. */}
          <div
            className={`bg-ui-bg-subtle hidden gap-x-3 px-6 py-2 lg:grid ${CUSTOMER_COLS}`}
          >
            {["Zákazník", "Utratil", "Dluží", "Naposledy"].map((nazev) => (
              <Text key={nazev} size="xsmall" weight="plus" className="text-ui-fg-subtle">
                {nazev}
              </Text>
            ))}
          </div>
          {rows.map((customer) => {
            const jmeno = customer.name || customer.email;
            const dekovat = deservesThanks(customer);
            return (
              <article
                key={customer.id}
                className={`group hover:bg-ui-bg-base-hover relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-6 py-3 transition-colors lg:items-center ${CUSTOMER_COLS}`}
              >
                {/* Celý řádek otevře Kartu (výsuvný panel): je v ní všechno
                    podstatné — čísla, objednávky, poznámka, kód — a seznam
                    zůstane pod ní. Ovládání nad ním má `relative z-10`. */}
                <button
                  type="button"
                  aria-label={`Otevřít kartu — ${jmeno}`}
                  onClick={() => otevritKartu(customer)}
                  className="focus-visible:shadow-borders-focus absolute inset-0 cursor-pointer outline-none"
                />

                <div className="min-w-0">
                  <span className="flex min-w-0 items-center gap-2">
                    <Text
                      size="small"
                      weight="plus"
                      className="truncate group-hover:underline"
                    >
                      {jmeno}
                    </Text>
                    {/* Jen výjimka: „ověřen" stálo zeleně skoro u všech
                        a nic neříkalo. Neověřený účet je to, co chce vidět. */}
                    {customer.email_verified === false && (
                      <Badge size="2xsmall" color="orange">
                        e-mail neověřen
                      </Badge>
                    )}
                    {isRegularCustomer(customer.orders_count, loyaltySettings?.after_orders) && (
                      <RegularCustomerBadge ordersCount={customer.orders_count} />
                    )}
                  </span>
                  <Text size="xsmall" className="text-ui-fg-subtle mt-0.5 truncate">
                    {/* Bez jména stojí e-mail v titulku — neopakovat ho, ledaže
                        jich sloučený host nasbíral víc. Oblíbené a hodnocení
                        tu dřív měly vlastní sloupec, většinou s „—". */}
                    {[
                      customer.emails?.length &&
                      (customer.name || customer.emails.length > 1)
                        ? customer.emails.join(" · ")
                        : null,
                      customer.phone || null,
                      customer.newsletter ? "odebírá newsletter" : null,
                      customer.wishlist_size > 0
                        ? `${customer.wishlist_size} v oblíbených`
                        : null,
                      customer.reviews_written > 0
                        ? `${customer.reviews_written}× hodnotil(a)`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                  {expert && (
                    <span className="relative z-10 block w-fit">
                      <CopyId value={customer.id} />
                      {(customer.records_count ?? 1) > 1 && (
                        <Text size="xsmall" className="text-ui-fg-muted">
                          {customer.records_count} záznamů v databázi (hosté)
                        </Text>
                      )}
                    </span>
                  )}
                </div>

                {/* Na úzké obrazovce: „…" vpravo nahoře, čísla pod jménem. */}
                <div className="relative z-10 -my-1 flex justify-end lg:order-last lg:my-0">
                  <RowOptionsMenu
                    label={`Možnosti zákazníka ${jmeno}`}
                    contentClassName="z-50"
                    items={[
                      {
                        label: "Detail zákazníka",
                        icon: <User />,
                        onSelect: () => navigate(`/customers/${customer.id}`),
                      },
                      {
                        label: "Napsat e-mail",
                        icon: <Envelope />,
                        // Pošta se otevře jen přímo z kliknutí.
                        sync: true,
                        onSelect: () => {
                          window.location.href = `mailto:${customer.email}`;
                        },
                      },
                      {
                        // Hvězdička, když to čísla už říkají — tři objednávky
                        // a víc, jedna z nich nedávno.
                        label: dekovat ? "Poslat slevový kód ★" : "Poslat slevový kód",
                        icon: <ReceiptPercent />,
                        takesFocus: true,
                        onSelect: () => otevritKartu(customer, true),
                      },
                    ]}
                  />
                </div>

                <div className="col-span-2 flex flex-wrap items-baseline gap-x-4 gap-y-0.5 lg:contents">
                  <div>
                    <Text size="small">{formatCzk(customer.lifetime_value)}</Text>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {objednavek(customer.orders_count)}
                    </Text>
                  </div>

                  <div>
                    {/* Dluh oranžově, jinak nic — „nic nedluží" u každého
                        řádku byl jen šum. */}
                    {customer.outstanding > 0 && (
                      <Text size="small" weight="plus" className="text-ui-tag-orange-text">
                        <span className="lg:hidden">dluží </span>
                        {formatCzk(customer.outstanding)}
                      </Text>
                    )}
                  </div>

                  <div>
                    {customer.last_order_at && (
                      <Text size="small" className="text-ui-fg-subtle">
                        <span className="lg:hidden">naposledy </span>
                        {formatDate(customer.last_order_at)}
                      </Text>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <CustomerDrawer
        customer={karta?.customer ?? null}
        withCode={karta?.withCode ?? false}
        open={kartaOpen}
        onOpenChange={setKartaOpen}
      />
    </Container>
  );
};

const queryClient = adminQueryClient;

const ZakazniciWorkbenchPage = () => (
  <QueryClientProvider client={queryClient}>
    <ZakazniciInner />
  </QueryClientProvider>
);

export const config = defineRouteConfig({
  label: "Zákazníci",
  icon: Users,
  rank: 60,
});

export default ZakazniciWorkbenchPage;
