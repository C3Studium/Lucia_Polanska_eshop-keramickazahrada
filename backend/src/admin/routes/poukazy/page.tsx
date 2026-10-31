import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Gift, MagnifyingGlass } from "@medusajs/icons";
import { Badge, Button, Container, Heading, Input, Label, Skeleton, Text, Toaster, toast } from "@medusajs/ui";
import { QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useMemo, useState } from "react";
import { EmptyState } from "../../components/empty-state";
import { SubTabs } from "../../components/work-tabs";
import { GiftVoucherCreateDrawer } from "../../components/gift-voucher-create";
import { GiftVoucherDetailDrawer } from "../../components/gift-voucher-detail";
import {
  type AdminGiftVoucher,
  type GiftVoucherListResponse,
  CopyButton,
  KIND_LABEL,
  StateBadge,
  formatValidUntil,
  openVoucherPage,
} from "../../components/gift-voucher-shared";
import { adminQueryClient } from "../../lib/query-client";
import { sdk } from "../../lib/sdk";
import { ceskaChyba } from "../../lib/ceska-chyba";
import { formatCzk } from "../../lib/workbench";

/**
 * Poukazy — dárkové poukazy prodané v dílně, po telefonu i v obchodě.
 *
 * Všechno jde přes `/admin/gift-vouchers` (backend je jediný, kdo počítá
 * stav a zůstatek). Seznam je tabulka od 1100 px, užší displej má údaje pod
 * kódem a telefon akce řádku pod „…" — stejně jako Produkty+.
 */

const queryClient = adminQueryClient;

type Filter = "vse" | "platne" | "ceka" | "vycerpane" | "zrusene";

const FILTERS: { key: Filter; label: string; match: (v: AdminGiftVoucher) => boolean }[] = [
  { key: "vse", label: "Všechny", match: () => true },
  { key: "platne", label: "Platné", match: (v) => v.state === "active" },
  { key: "ceka", label: "Čeká na platbu", match: (v) => v.state === "pending_payment" },
  {
    key: "vycerpane",
    label: "Vyčerpané a propadlé",
    match: (v) => v.state === "used" || v.state === "expired",
  },
  { key: "zrusene", label: "Zrušené a vrácené", match: (v) => v.state === "cancelled" || v.state === "refunded" },
];

/** Hledání se pošle na server až chvilku po dopsání. */
const useDebounced = (value: string, ms = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
};

const ROW_GRID = "min-[1100px]:grid-cols-[170px_minmax(0,1fr)_150px_110px_130px_120px]";

const RowHeader = () => (
  <div className={`bg-ui-bg-subtle text-ui-fg-subtle hidden gap-x-4 px-6 py-2 min-[1100px]:grid ${ROW_GRID}`}>
    {["Kód", "Pro koho / kupující", "Hodnota · zbývá", "Platí do", "Stav", "Typ"].map((label) => (
      <Text key={label} size="xsmall" weight="plus">
        {label}
      </Text>
    ))}
  </div>
);

const SummaryTile = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="bg-ui-bg-subtle rounded-lg px-4 py-3">
    <Text size="xsmall" className="text-ui-fg-subtle">
      {label}
    </Text>
    <Text size="xlarge" weight="plus" className="mt-0.5">
      {value}
    </Text>
    {hint ? (
      <Text size="xsmall" className="text-ui-fg-muted">
        {hint}
      </Text>
    ) : null}
  </div>
);

const VoucherRow = ({
  voucher,
  onOpen,
  actionsOpen,
  onToggleActions,
}: {
  voucher: AdminGiftVoucher;
  onOpen: () => void;
  actionsOpen: boolean;
  onToggleActions: () => void;
}) => {
  const who = voucher.recipient_name || voucher.recipient_email;
  const partly = voucher.balance < voucher.initial_value && voucher.payment_status === "paid";

  return (
    <Fragment>
      <article
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen();
          }
        }}
        className={`hover:bg-ui-bg-base-hover grid cursor-pointer gap-x-4 gap-y-1.5 px-6 py-3 outline-none focus-visible:bg-ui-bg-base-hover min-[1100px]:items-center ${ROW_GRID} ${
          voucher.state === "cancelled" ? "opacity-70" : ""
        }`}
      >
        {/* Kód + kopírovat (+ „…" na telefonu) */}
        <div className="flex min-w-0 items-center gap-x-1">
          <span className="font-mono text-sm font-semibold tracking-wide">{voucher.code}</span>
          <CopyButton value={voucher.code} what="Kód" />
          <button
            type="button"
            className="text-ui-fg-subtle hover:text-ui-fg-base hover:bg-ui-bg-base-hover ml-auto shrink-0 rounded-md px-3 py-1.5 text-lg leading-none sm:hidden"
            aria-expanded={actionsOpen}
            aria-label="Další akce"
            onClick={(event) => {
              event.stopPropagation();
              onToggleActions();
            }}
          >
            …
          </button>
        </div>

        {/* Pro koho / kupující */}
        <div className="min-w-0">
          <Text size="small" weight="plus" className="truncate">
            {who ? `Pro: ${who}` : voucher.buyer_name}
          </Text>
          <Text size="xsmall" className="text-ui-fg-subtle truncate">
            {who ? `koupil(a) ${voucher.buyer_name}` : "kupující"}
            {voucher.buyer_email ? ` · ${voucher.buyer_email}` : ""}
          </Text>
        </div>

        {/* Hodnota, platnost, stav, typ — pod 1100 px v jedné řádce */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 min-[1100px]:contents">
          <div>
            <Text size="small">
              {formatCzk(voucher.initial_value)}
              {partly ? (
                <span className="text-ui-fg-subtle"> · zbývá {formatCzk(voucher.balance)}</span>
              ) : null}
            </Text>
          </div>
          <Text size="small" className="text-ui-fg-subtle min-[1100px]:text-ui-fg-base">
            <span className="min-[1100px]:hidden">do </span>
            {formatValidUntil(voucher.valid_until)}
          </Text>
          <div>
            <StateBadge voucher={voucher} />
          </div>
          <Text size="small" className="text-ui-fg-subtle">
            {KIND_LABEL[voucher.kind]}
          </Text>
        </div>
      </article>

      {/* Telefon: akce řádku pod „…" */}
      {actionsOpen && (
        <div className="bg-ui-bg-subtle flex flex-wrap gap-2 px-6 py-3 sm:hidden">
          <Button size="small" variant="secondary" onClick={onOpen}>
            Otevřít detail
          </Button>
          {voucher.payment_status === "paid" && voucher.status !== "cancelled" && (
            <Button size="small" variant="secondary" onClick={() => openVoucherPage(voucher)}>
              Otevřít / vytisknout
            </Button>
          )}
          <CopyButton value={voucher.code} what="Kód" label="Kopírovat kód" />
        </div>
      )}
    </Fragment>
  );
};

const PoukazyInner = () => {
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim());
  const [filter, setFilter] = useState<Filter>("vse");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [paymentUrlHint, setPaymentUrlHint] = useState<string | null>(null);
  const [createdVoucher, setCreatedVoucher] = useState<AdminGiftVoucher | undefined>();
  const [actionsFor, setActionsFor] = useState<string | null>(null);

  /** Souhrn vždy za všechny poukazy, ne jen za hledané. */
  const allQuery = useQuery<GiftVoucherListResponse>({
    queryKey: ["gift-vouchers", "list", ""],
    queryFn: () => sdk.client.fetch("/admin/gift-vouchers"),
  });
  const searchQuery = useQuery<GiftVoucherListResponse>({
    queryKey: ["gift-vouchers", "list", q],
    queryFn: () => sdk.client.fetch("/admin/gift-vouchers", { query: { q } }),
    enabled: q.length > 0,
    placeholderData: (previous) => previous,
  });
  const listQuery = q ? searchQuery : allQuery;
  const vouchers = listQuery.data?.gift_vouchers ?? [];
  const summary = allQuery.data?.summary;
  const pendingCount = summary?.pending_payment ?? 0;

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.key, vouchers.filter(f.match).length])),
    [vouchers]
  ) as Record<Filter, number>;
  const visible = useMemo(
    () => vouchers.filter(FILTERS.find((f) => f.key === filter)!.match),
    [vouchers, filter]
  );

  const openDetail = (id: string) => {
    setDetailId(id);
    setDetailOpen(true);
    setActionsFor(null);
  };

  const detailInitial =
    vouchers.find((v) => v.id === detailId) ??
    allQuery.data?.gift_vouchers.find((v) => v.id === detailId) ??
    (createdVoucher?.id === detailId ? createdVoucher : undefined);

  const noVouchersAtAll = allQuery.isSuccess && (allQuery.data?.gift_vouchers.length ?? 0) === 0;

  return (
    <Container className="divide-y p-0">
      <Toaster />
      <header className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-end md:justify-between">
        <div>
          <Heading>Poukazy</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1 max-w-2xl">
            Dárkové poukazy — vytištěné i elektronické. Tady je vystavíte,
            zapíšete platbu, pošlete e-mailem a odečtete, když je někdo
            uplatní v dílně.
          </Text>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          Nový poukaz
        </Button>
      </header>

      <VoucherLimits />

      {!noVouchersAtAll && (
        <div className="grid gap-3 px-6 py-4 sm:grid-cols-3">
          {summary ? (
            <>
              <SummaryTile
                label="Platné poukazy"
                value={String(summary.active)}
                hint="zaplacené a dají se uplatnit"
              />
              <SummaryTile
                label="Nevyčerpaný zůstatek celkem"
                value={formatCzk(summary.outstanding_balance)}
                hint="kolik ještě můžou lidé uplatnit"
              />
              <SummaryTile
                label="Čeká na platbu"
                value={String(summary.pending_payment)}
                hint={pendingCount ? "vystavené, ale nezaplacené" : "nic nečeká"}
              />
            </>
          ) : (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          )}
        </div>
      )}

      {noVouchersAtAll ? (
        <EmptyState
          title="Zatím tu nejsou žádné poukazy"
          description="Poukaz vystavíte za pár vteřin: zvolíte hodnotu, pro koho je a jak se platí. Vytištěný si otevřete a vytisknete, elektronický odejde e-mailem. Když ho pak někdo uplatní — v obchodě nebo u vás v dílně — odečtete částku a zbytek na poukazu zůstane."
          action={
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              Nový poukaz
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-y-1 px-6 pt-4">
            <div className="relative max-w-md">
              <span className="text-ui-fg-muted pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2">
                <MagnifyingGlass />
              </span>
              <Input
                type="search"
                className="pl-9"
                placeholder="Hledat kód, jméno nebo e-mail"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
          <SubTabs
            tabs={FILTERS.map((f) => ({ key: f.key, label: f.label, count: counts[f.key] }))}
            active={filter}
            onSelect={(key) => setFilter(key as Filter)}
          />

          {listQuery.isError ? (
            <div className="px-6 py-6">
              <Text size="small" className="text-ui-fg-error">
                {ceskaChyba(listQuery.error, "Poukazy se nepodařilo načíst.")}
              </Text>
            </div>
          ) : listQuery.isLoading ? (
            <div className="flex flex-col gap-y-2 px-6 py-6">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              title={q ? "Nic takového nenacházím" : "V téhle skupině nic není"}
              description={
                q
                  ? "Zkuste jen část jména nebo e-mailu, nebo kód bez pomlček."
                  : "Přepněte na „Všechny“, ať vidíte ostatní poukazy."
              }
            />
          ) : (
            <div className="divide-y">
              <RowHeader />
              {visible.map((voucher) => (
                <VoucherRow
                  key={voucher.id}
                  voucher={voucher}
                  onOpen={() => openDetail(voucher.id)}
                  actionsOpen={actionsFor === voucher.id}
                  onToggleActions={() => setActionsFor(actionsFor === voucher.id ? null : voucher.id)}
                />
              ))}
            </div>
          )}
          {q && searchQuery.isFetching && (
            <div className="px-6 py-2">
              <Badge size="2xsmall" color="grey">
                hledám…
              </Badge>
            </div>
          )}
        </>
      )}

      <GiftVoucherCreateDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(outcome) => {
          setCreateOpen(false);
          setCreatedVoucher(outcome.gift_voucher);
          setPaymentUrlHint(outcome.payment_url ?? null);
          setDetailId(outcome.gift_voucher.id);
          setDetailOpen(true);
        }}
      />
      <GiftVoucherDetailDrawer
        voucherId={detailId}
        initial={detailInitial}
        paymentUrlHint={paymentUrlHint}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setPaymentUrlHint(null);
        }}
      />
    </Container>
  );
};

const PoukazyPage = () => (
  <QueryClientProvider client={queryClient}>
    <PoukazyInner />
  </QueryClientProvider>
);

export const config = defineRouteConfig({
  label: "Poukazy",
  icon: Gift,
  rank: 75,
});

/**
 * Meze poukazu s vlastní částkou — „od kolika do kolika" a po jakém kroku.
 *
 * Do 31. 10. 2026 se daly změnit jedině skriptem, takže zvednout strop
 * znamenalo napsat vývojáři. Hodnoty bydlí v metadatech toho produktu
 * (odtud je čte obchod i pokladna), tohle je jen políčko k nim.
 */
const VoucherLimits = () => {
  const queryClient = useQueryClient();
  const { data } = useQuery<{
    product: { id: string; title: string } | null;
    limits: { min: number; max: number; step: number; currency: string };
  }>({
    queryKey: ["gift-voucher-limits"],
    queryFn: () => sdk.client.fetch("/admin/gift-vouchers/limits"),
    retry: false,
  });

  const [draft, setDraft] = useState<{ min: string; max: string; step: string } | null>(null);
  const limits = data?.limits;
  const hodnoty = draft ?? {
    min: String(limits?.min ?? ""),
    max: String(limits?.max ?? ""),
    step: String(limits?.step ?? ""),
  };

  const ulozit = useMutation({
    mutationFn: () =>
      sdk.client.fetch("/admin/gift-vouchers/limits", {
        method: "POST",
        body: {
          min: Number(hodnoty.min),
          max: Number(hodnoty.max),
          step: Number(hodnoty.step),
        },
      }),
    onSuccess: async () => {
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: ["gift-voucher-limits"] });
      toast.success("Meze poukazu uložené.");
    },
    onError: (error) => toast.error(ceskaChyba(error, "Meze se nepodařilo uložit.")),
  });

  if (!data) return null;
  if (!data.product) {
    return (
      <div className="px-6 py-4">
        <Text size="small" className="text-ui-fg-subtle">
          V katalogu není poukaz s vlastní částkou, takže není co nastavovat.
        </Text>
      </div>
    );
  }

  const cisla = [hodnoty.min, hodnoty.max, hodnoty.step].map((v) => Number(v));
  const platne =
    cisla.every((v) => Number.isInteger(v) && v > 0) && cisla[1] >= cisla[0];
  const zmeneno =
    cisla[0] !== limits?.min || cisla[1] !== limits?.max || cisla[2] !== limits?.step;

  return (
    <div className="flex flex-col gap-y-2 px-6 py-4">
      <Text size="small" weight="plus">
        Poukaz s vlastní částkou — od kolika do kolika
      </Text>
      <Text size="xsmall" className="text-ui-fg-subtle">
        Platí pro „{data.product.title}" v obchodě: zákazník si zvolí částku
        v těchhle mezích a po tomhle kroku.
      </Text>
      <div className="flex flex-wrap items-end gap-3">
        {([
          ["min", "Od (Kč)"],
          ["max", "Do (Kč)"],
          ["step", "Po (Kč)"],
        ] as const).map(([klic, popisek]) => (
          <div key={klic} className="flex flex-col gap-y-1">
            <Label size="xsmall" htmlFor={`voucher-${klic}`}>
              {popisek}
            </Label>
            <Input
              id={`voucher-${klic}`}
              type="number"
              min={1}
              step="1"
              className="w-28"
              value={hodnoty[klic]}
              onChange={(event) =>
                setDraft({ ...hodnoty, [klic]: event.target.value })
              }
            />
          </div>
        ))}
        <Button
          size="small"
          variant="secondary"
          isLoading={ulozit.isPending}
          disabled={!platne || !zmeneno || ulozit.isPending}
          onClick={() => ulozit.mutate()}
        >
          Uložit meze
        </Button>
      </div>
      {!platne && (
        <Text size="xsmall" className="text-ui-fg-error">
          Zadejte celá kladná čísla; horní mez nemůže být nižší než dolní.
        </Text>
      )}
    </div>
  );
};

export default PoukazyPage;
