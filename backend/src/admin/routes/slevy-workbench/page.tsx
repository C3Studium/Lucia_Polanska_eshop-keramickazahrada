import { defineRouteConfig } from "@medusajs/admin-sdk";
import {
  PauseSolid,
  PlaySolid,
  ReceiptPercent,
  SquareTwoStack,
  Trash,
} from "@medusajs/icons";
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Skeleton,
  Text,
  toast,
} from "@medusajs/ui";
import {
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { DiscountEditor } from "../../components/discount-editor";
import { EmptyState } from "../../components/empty-state";
import { RowLink } from "../../components/row-link";
import { RowOptionsMenu } from "../../components/row-options-menu";
import { ExpertToggle, RawData } from "../../lib/expert-mode";
import { SubTabs } from "../../components/work-tabs";
import { formatCzk } from "../../lib/workbench";
import { formatDate } from "../../lib/format";
import { sdk } from "../../lib/sdk";
import { useScrollMemory } from "../../lib/scroll-memory";
import { useUrlState } from "../../lib/url-state";
import { adminQueryClient } from "../../lib/query-client"
import { ceskaChyba } from "../../lib/ceska-chyba";
import {
  ProductSaleDialog,
  SALE_STATE,
  salePeriod,
  useProductSaleWrites,
  type ProductSale,
} from "../../components/product-sale";

/**
 * Slevy — promotions, campaigns and price lists as one workbench
 * (phase 3, admin-advanced-plan.md).
 *
 * The last domain still living on native pages. One joined read
 * (`/admin/workbench/discounts`); **every write goes to the native admin
 * APIs**, so exactly one system owns a code or a price — this page only
 * removes the three-screen walk to see one picture.
 *
 * Seasonal sales deliberately stay in Přehled → Slevy: they are a merchant
 * concept from our own module, and two editors for them would mean two
 * truths.
 */

type WorkbenchPromotion = {
  id: string;
  code: string | null;
  is_automatic: boolean;
  status: string;
  effect: string | null;
  campaign: { id: string; name: string } | null;
  used_count: number | null;
  revenue: number | null;
  discount_given: number | null;
  created_at: string;
};

type WorkbenchCampaign = {
  id: string;
  name: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  budget: { type: string; limit: number | null; used: number | null } | null;
  promotions_count: number;
  used_orders: number;
  revenue: number;
  discount_given: number;
};

type WorkbenchPriceList = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  prices_count: number;
};

type WorkbenchSeasonal = {
  id: string;
  title: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  products_count: number;
  orders: number;
  revenue: number;
};

type DiscountsResponse = {
  promotions: WorkbenchPromotion[];
  campaigns: WorkbenchCampaign[];
  price_lists: WorkbenchPriceList[];
  seasonal_selections: WorkbenchSeasonal[];
  orders_scanned: number;
};

const tabs = [
  { key: "vyrobky", label: "Zlevněné výrobky" },
  { key: "akce", label: "Akce a kódy" },
  { key: "kampane", label: "Kampaně" },
  { key: "ceniky", label: "Ceníky" },
  { key: "statistiky", label: "Statistiky" },
];

/*
 * Tabulky (17. 11. 2026): jedna mřížka pro hlavičku i řádky každé záložky,
 * ať sloupce sedí; pružný je jen název. Poslední sloupec je „…".
 */
const PROMO_COLS = "lg:grid-cols-[minmax(0,1fr)_130px_140px_150px_40px]";
const CAMPAIGN_COLS = "lg:grid-cols-[minmax(0,1fr)_190px_210px_150px_40px]";
const PRICE_LIST_COLS = "lg:grid-cols-[minmax(0,1fr)_130px_210px_40px]";
const SALE_COLS = "lg:grid-cols-[minmax(0,1fr)_170px_120px_200px_40px]";

/** Hlavička tabulky — jen na širokém displeji, na úzkém se řádky skládají. */
const ColumnHeader = ({ cols, names }: { cols: string; names: string[] }) => (
  <div className={`bg-ui-bg-subtle hidden gap-x-3 px-6 py-2 lg:grid ${cols}`}>
    {names.map((name) => (
      <Text key={name} size="xsmall" weight="plus" className="text-ui-fg-subtle">
        {name}
      </Text>
    ))}
  </div>
);

/** Toggle a promotion between active and draft through the native API. */
const PromotionRow = ({ promotion }: { promotion: WorkbenchPromotion }) => {
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["workbench-discounts"] });
    await queryClient.invalidateQueries({ queryKey: ["operations-discounts"] });
  };

  const setStatus = useMutation({
    mutationFn: (status: "active" | "draft") =>
      sdk.client.fetch(`/admin/promotions/${promotion.id}`, {
        method: "POST",
        body: { status },
      }),
    onSuccess: async (_r, status) => {
      await invalidate();
      toast.success(
        status === "active" ? "Sleva spuštěna." : "Sleva pozastavena."
      );
    },
    onError: (error) =>
      toast.error(
        ceskaChyba(error, "Změna se nepodařila.")
      ),
  });

  const remove = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/promotions/${promotion.id}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Sleva smazána.");
    },
    onError: (error) =>
      toast.error(
        ceskaChyba(error, "Smazání se nepodařilo.")
      ),
  });

  const active = promotion.status === "active";
  const nazev = promotion.is_automatic
    ? "Automatická sleva"
    : promotion.code || "—";

  return (
    <article
      className={`group hover:bg-ui-bg-base-hover relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-6 py-3 transition-colors lg:items-center ${PROMO_COLS}`}
    >
      {/* Celý řádek vede na podrobnosti slevy. Vlastní úprava slevy tu není
          (DiscountEditor jen zakládá), takže je to nativní detail Medusy —
          jediné místo, kde jde změnit hodnotu, pravidla a platnost. */}
      <RowLink to={`/promotions/${promotion.id}`} label={`Otevřít slevu ${nazev}`} />

      <div className="min-w-0">
        <Text size="small" weight="plus" className="truncate group-hover:underline">
          {nazev}
        </Text>
        <Text size="xsmall" className="text-ui-fg-subtle mt-0.5 truncate">
          {promotion.effect ?? ""}
          {promotion.campaign ? ` · kampaň ${promotion.campaign.name}` : ""}
        </Text>
      </div>

      {/* Na úzké obrazovce „…" vpravo nahoře, zbytek pod názvem. */}
      <div className="relative z-10 -my-1 flex justify-end lg:order-last lg:my-0">
        <RowOptionsMenu
          label={`Možnosti slevy ${nazev}`}
          contentClassName="z-50"
          items={[
            {
              label: active ? "Pozastavit" : "Spustit",
              icon: active ? <PauseSolid /> : <PlaySolid />,
              onSelect: () => setStatus.mutate(active ? "draft" : "active"),
            },
            ...(promotion.code && !promotion.is_automatic
              ? [
                  {
                    label: "Kopírovat kód",
                    icon: <SquareTwoStack />,
                    // Schránka chce kliknutí, ne odložené volání.
                    sync: true,
                    onSelect: () => {
                      navigator.clipboard
                        ?.writeText(promotion.code as string)
                        .then(
                          () => toast.success(`Kód ${promotion.code} zkopírován.`),
                          () => toast.error("Kód se nepodařilo zkopírovat.")
                        );
                    },
                  },
                ]
              : []),
            "separator" as const,
            {
              label: "Smazat",
              icon: <Trash />,
              destructive: true,
              onSelect: () => setConfirmDelete(true),
            },
          ]}
        />
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Smazat slevu?"
          description={`${
            promotion.code
              ? `Kód ${promotion.code} přestane platit okamžitě.`
              : "Automatická sleva přestane platit okamžitě."
          } Objednávek, které ji už použily, se to nedotkne.`}
          consequence="Smazanou slevu nejde vrátit."
          confirmLabel="Smazat"
          isPending={remove.isPending}
          onConfirm={() => remove.mutate()}
        />
      </div>

      <div className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1 lg:contents">
        <div>
          {/* Stav jako štítek, přepnutí v „…": přepínač v klikacím řádku by
              šlo trefit omylem a kód by zákazníkům tiše přestal platit. */}
          <Badge size="2xsmall" color={active ? "green" : "grey"}>
            {setStatus.isPending ? "Ukládám…" : active ? "Běží" : "Pozastaveno"}
          </Badge>
        </div>

        <div>
          {typeof promotion.used_count === "number" && (
            <Text size="small" className="text-ui-fg-subtle">
              {promotion.used_count === 0 ? (
                "zatím nepoužito"
              ) : (
                <>
                  <span className="lg:hidden">použito </span>
                  {promotion.used_count}×
                </>
              )}
            </Text>
          )}
        </div>

        <div>
          {typeof promotion.revenue === "number" && promotion.revenue > 0 && (
            <>
              <Text size="small">
                <span className="lg:hidden">přineslo </span>
                {formatCzk(promotion.revenue)}
              </Text>
              {promotion.discount_given ? (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  sleva {formatCzk(promotion.discount_given)}
                </Text>
              ) : null}
            </>
          )}
        </div>
      </div>
    </article>
  );
};

/** Create/edit a campaign — name, window, budget — through the native API. */
const CampaignEditor = ({
  campaign,
  trigger,
}: {
  campaign?: WorkbenchCampaign;
  trigger: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(campaign?.name ?? "");
  const [startsAt, setStartsAt] = useState(
    campaign?.starts_at ? campaign.starts_at.slice(0, 10) : ""
  );
  const [endsAt, setEndsAt] = useState(
    campaign?.ends_at ? campaign.ends_at.slice(0, 10) : ""
  );
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: () => {
      if (!name.trim()) {
        throw new Error("Kampaň potřebuje název.");
      }
      const body = {
        name: name.trim(),
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      };
      return campaign
        ? sdk.client.fetch(`/admin/campaigns/${campaign.id}`, {
            method: "POST",
            body,
          })
        : sdk.client.fetch(`/admin/campaigns`, {
            method: "POST",
            body: { ...body, campaign_identifier: name.trim().toLowerCase().replace(/\s+/g, "-") },
          });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["workbench-discounts"],
      });
      toast.success(campaign ? "Kampaň upravena." : "Kampaň založena.");
      setOpen(false);
    },
    onError: (error) =>
      toast.error(
        ceskaChyba(error, "Uložení se nepodařilo.")
      ),
  });

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>
            {campaign ? `Kampaň — ${campaign.name}` : "Nová kampaň"}
          </Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-4">
          <div>
            <Label htmlFor="camp-name">Název</Label>
            <Input
              id="camp-name"
              value={name}
              placeholder="Např. Vánoce 2026"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="camp-start">Od</Label>
              <Input
                id="camp-start"
                type="date"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="camp-end">Do</Label>
              <Input
                id="camp-end"
                type="date"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
              />
            </div>
          </div>
          <Text size="xsmall" className="text-ui-fg-subtle">
            Kampaň drží slevy pohromadě a měří jejich útratu. Slevy do ní
            přiřadíte při jejich vytváření.
          </Text>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="secondary" size="small">
              Zavřít
            </Button>
          </Drawer.Close>
          <Button
            size="small"
            isLoading={save.isPending}
            onClick={() => save.mutate()}
          >
            Uložit
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

/** Price-list window/status edits through the native API. */
const PriceListRow = ({ list }: { list: WorkbenchPriceList }) => {
  const queryClient = useQueryClient();
  const active = list.status === "active";

  const setStatus = useMutation({
    mutationFn: (status: "active" | "draft") =>
      sdk.client.fetch(`/admin/price-lists/${list.id}`, {
        method: "POST",
        body: { status },
      }),
    onSuccess: async (_r, status) => {
      await queryClient.invalidateQueries({
        queryKey: ["workbench-discounts"],
      });
      toast.success(
        status === "active" ? "Ceník aktivován." : "Ceník pozastaven."
      );
    },
    onError: (error) =>
      toast.error(
        ceskaChyba(error, "Změna se nepodařila.")
      ),
  });

  /* Řádek se neotevírá: ceník patří sezónní akci (Přehled → Slevy a akce)
     a ceny se mění tam. Nativní editor ceníku by byl druhá pravda. */
  return (
    <article
      className={`relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-6 py-3 lg:items-center ${PRICE_LIST_COLS}`}
    >
      <div className="min-w-0">
        <Text size="small" weight="plus" className="truncate">
          {list.title}
        </Text>
        <Text size="xsmall" className="text-ui-fg-subtle mt-0.5">
          {list.prices_count === 1
            ? "1 cena"
            : list.prices_count <= 4
              ? `${list.prices_count} ceny`
              : `${list.prices_count} cen`}
        </Text>
      </div>

      <div className="-my-1 flex justify-end lg:order-last lg:my-0">
        <RowOptionsMenu
          label={`Možnosti ceníku ${list.title}`}
          contentClassName="z-50"
          items={[
            {
              label: active ? "Pozastavit" : "Spustit",
              icon: active ? <PauseSolid /> : <PlaySolid />,
              onSelect: () => setStatus.mutate(active ? "draft" : "active"),
            },
          ]}
        />
      </div>

      <div className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1 lg:contents">
        <div>
          <Badge size="2xsmall" color={active ? "green" : "grey"}>
            {setStatus.isPending ? "Ukládám…" : active ? "Běží" : "Pozastaveno"}
          </Badge>
        </div>

        <div>
          {(list.starts_at || list.ends_at) && (
            <Text size="small" className="text-ui-fg-subtle">
              {formatDate(list.starts_at)} – {formatDate(list.ends_at)}
            </Text>
          )}
        </div>
      </div>
    </article>
  );
};

type ProductSaleRowData = ProductSale & {
  title: string;
  thumbnail: string | null;
  product_status: string;
  price_before: number | null;
  price_after: number | null;
  variants_count: number;
};

/** Zlevněné výrobky — sleva nastavená přímo u ceny výrobku (lib/product-sale). */
const SaleProductRow = ({ row }: { row: ProductSaleRowData }) => {
  const [editing, setEditing] = useState(false);
  const { save, remove } = useProductSaleWrites(row.product_id);
  const enabled = row.status === "active";
  const state = SALE_STATE[row.state];

  return (
    <article
      className={`group hover:bg-ui-bg-base-hover relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-6 py-3 transition-colors lg:items-center ${SALE_COLS}`}
    >
      <RowLink to={`/produkt/${row.product_id}`} label={`Otevřít výrobek ${row.title}`} />

      <div className="flex min-w-0 items-center gap-3">
        <div className="bg-ui-bg-subtle size-10 shrink-0 overflow-hidden rounded-md">
          {row.thumbnail && (
            <img src={row.thumbnail} alt="" className="size-full object-cover" />
          )}
        </div>
        <div className="min-w-0">
          <Text size="small" weight="plus" className="truncate group-hover:underline">
            {row.title}
          </Text>
          <Text size="xsmall" className="text-ui-fg-subtle mt-0.5">
            −{row.percent} %
            {row.variants_count > 1 ? ` · všechna provedení (${row.variants_count})` : ""}
            {row.product_status !== "published" ? " · není v obchodě" : ""}
          </Text>
        </div>
      </div>

      <div className="relative z-10 -my-1 flex justify-end lg:order-last lg:my-0">
        <RowOptionsMenu
          label={`Možnosti slevy ${row.title}`}
          contentClassName="z-50"
          items={[
            {
              label: enabled ? "Vypnout slevu" : "Zapnout slevu",
              icon: enabled ? <PauseSolid /> : <PlaySolid />,
              onSelect: () =>
                save.mutate(
                  { enabled: !enabled },
                  {
                    onSuccess: () =>
                      toast.success(enabled ? "Sleva vypnutá." : "Sleva zapnutá."),
                  }
                ),
            },
            {
              label: "Upravit slevu",
              icon: <ReceiptPercent />,
              onSelect: () => setEditing(true),
            },
            "separator" as const,
            {
              label: "Odebrat slevu",
              icon: <Trash />,
              destructive: true,
              onSelect: () => remove.mutate(),
            },
          ]}
        />
        <ProductSaleDialog
          productId={row.product_id}
          productTitle={row.title}
          price={row.price_before}
          sale={row}
          open={editing}
          onOpenChange={setEditing}
        />
      </div>

      <div className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1 lg:contents">
        <div>
          {row.price_before !== null && (
            <Text size="small" className="tabular-nums">
              <span className="text-ui-fg-muted line-through">
                {formatCzk(row.price_before)}
              </span>{" "}
              <span className="font-medium">{formatCzk(row.price_after)}</span>
            </Text>
          )}
        </div>
        <div>
          <Badge size="2xsmall" color={state.color}>
            {save.isPending || remove.isPending ? "Ukládám…" : state.label}
          </Badge>
        </div>
        <div>
          <Text size="small" className="text-ui-fg-subtle">
            {salePeriod(row)}
          </Text>
        </div>
      </div>
    </article>
  );
};

const SlevyInner = () => {
  /* Návrat z detailu slevy vrátí i tam, kde v seznamu byla. */
  useScrollMemory("slevy");
  /* Záložka v adrese, ne v paměti: odchodem by se zahodila a návrat by
     začínal zase u „Akce a kódy" (měřeno 11. 11. 2026). */
  const [active, setActive] = useUrlState<string>("zalozka", "vyrobky");

  const { data, isLoading, isError } = useQuery<DiscountsResponse>({
    queryKey: ["workbench-discounts"],
    queryFn: () => sdk.client.fetch("/admin/workbench/discounts"),
    refetchOnWindowFocus: true,
  });

  const productSales = useQuery<{ sales: ProductSaleRowData[] }>({
    queryKey: ["product-sales"],
    queryFn: () => sdk.client.fetch("/admin/workbench/product-sales"),
    refetchOnWindowFocus: true,
  });

  return (
    <Container className="divide-y p-0">
      <header className="flex flex-wrap items-start justify-between gap-3 px-6 pb-4 pt-6">
        <div>
          <Heading>Slevy</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
            Zlevněné výrobky, kódy a automatické slevy, kampaně a akční ceníky
            na jednom místě. Slevu na jeden výrobek nastavíte u jeho ceny.
            Sezónní výprodeje se zakládají zvlášť:{" "}
            <Link to="/prehled/slevy" className="text-ui-fg-interactive hover:underline">
              Sezónní akce →
            </Link>
          </Text>
        </div>
        <div className="flex items-center gap-3">
          <ExpertToggle />
          {/* Jedno hlavní tlačítko. „Nová kampaň" jen v Kampaních — jinde
              byla druhé tlačítko, které se skoro nepoužívá. */}
          {active === "kampane" && (
            <CampaignEditor
              trigger={
                <Button size="small" variant="secondary">
                  Nová kampaň
                </Button>
              }
            />
          )}
          {/* Na Zlevněných výrobcích ne — sleva výrobku se zakládá u jeho
              ceny, „Nová sleva" tady je kód do košíku. */}
          {active !== "vyrobky" && (
            <DiscountEditor
              trigger={
                <Button size="small" variant="primary">
                  Nová sleva
                </Button>
              }
            />
          )}
        </div>
      </header>

      <SubTabs
        tabs={tabs.map((tab) => ({
          ...tab,
          count:
            tab.key === "vyrobky"
              ? productSales.data?.sales.length
              : tab.key === "akce"
              ? data?.promotions.length
              : tab.key === "kampane"
                ? data?.campaigns.length
                : data?.price_lists.length,
        }))}
        active={active}
        onSelect={setActive}
      />

      {isLoading && active !== "vyrobky" && (
        <div className="flex flex-col gap-y-3 px-6 py-5">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      )}

      {isError && active !== "vyrobky" && (
        <EmptyState
          title="Slevy se nepodařilo načíst"
          description="Zkuste stránku obnovit."
        />
      )}

      {active === "vyrobky" && (
        <div className="divide-y">
          {productSales.isLoading ? (
            <div className="flex flex-col gap-y-3 px-6 py-5">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
            </div>
          ) : productSales.isError ? (
            <EmptyState
              title="Zlevněné výrobky se nepodařilo načíst"
              description="Zkuste stránku obnovit."
            />
          ) : (productSales.data?.sales ?? []).length === 0 ? (
            <EmptyState
              title="Žádný výrobek není ve slevě"
              description="Slevu nastavíte na detailu výrobku u ceny — tlačítko Přidat slevu."
            />
          ) : (
            <>
              <ColumnHeader
                cols={SALE_COLS}
                names={["Výrobek", "Cena", "Stav", "Platí"]}
              />
              {(productSales.data?.sales ?? []).map((row) => (
                <SaleProductRow key={row.price_list_id} row={row} />
              ))}
            </>
          )}
        </div>
      )}

      {!isLoading && !isError && active === "akce" && (
        <div className="divide-y">
          {(data?.promotions ?? []).length === 0 ? (
            <EmptyState
              title="Žádné slevy"
              description="Novou slevu vytvoříte tlačítkem nahoře."
            />
          ) : (
            <ColumnHeader
              cols={PROMO_COLS}
              names={["Sleva", "Stav", "Použito", "Přineslo"]}
            />
          )}
          {(data?.promotions ?? []).map((promotion) => (
            <PromotionRow key={promotion.id} promotion={promotion} />
          ))}
        </div>
      )}

      {!isLoading && !isError && active === "kampane" && (
        <div className="divide-y">
          {(data?.campaigns ?? []).length === 0 ? (
            <EmptyState
              title="Žádné kampaně"
              description="Kampaň drží slevy pohromadě a hlídá jejich rozpočet."
            />
          ) : (
            <ColumnHeader
              cols={CAMPAIGN_COLS}
              names={["Kampaň", "Období", "Rozpočet", "Přineslo"]}
            />
          )}
          {(data?.campaigns ?? []).map((campaign) => (
            <article
              key={campaign.id}
              className={`group hover:bg-ui-bg-base-hover relative grid gap-x-3 gap-y-1 px-6 py-3 transition-colors lg:items-center ${CAMPAIGN_COLS}`}
            >
              {/* Celý řádek otevře úpravu kampaně (dřív tlačítko „Upravit").
                  Jiná akce u kampaně není, proto ani „…". */}
              <CampaignEditor
                campaign={campaign}
                trigger={
                  <button
                    type="button"
                    aria-label={`Upravit kampaň ${campaign.name}`}
                    className="focus-visible:shadow-borders-focus absolute inset-0 cursor-pointer outline-none"
                  />
                }
              />
              <div className="min-w-0">
                <Text size="small" weight="plus" className="truncate group-hover:underline">
                  {campaign.name}
                </Text>
                <Text size="xsmall" className="text-ui-fg-subtle mt-0.5">
                  {campaign.promotions_count === 0
                    ? "zatím bez slev"
                    : campaign.promotions_count === 1
                      ? "1 sleva"
                      : campaign.promotions_count <= 4
                        ? `${campaign.promotions_count} slevy`
                        : `${campaign.promotions_count} slev`}
                </Text>
              </div>
              <div>
                {(campaign.starts_at || campaign.ends_at) && (
                  <Text size="small" className="text-ui-fg-subtle">
                    {formatDate(campaign.starts_at)} –{" "}
                    {formatDate(campaign.ends_at)}
                  </Text>
                )}
              </div>
              <div>
                {campaign.budget?.limit != null && (
                  <Text size="small" className="text-ui-fg-subtle">
                    {campaign.budget.type === "spend"
                      ? `utraceno ${formatCzk(campaign.budget.used ?? 0)} z ${formatCzk(campaign.budget.limit)}`
                      : `použito ${campaign.budget.used ?? 0}× z ${campaign.budget.limit}`}
                  </Text>
                )}
              </div>
              <div>
                {campaign.revenue > 0 && (
                  <>
                    <Text size="small">
                      <span className="lg:hidden">přineslo </span>
                      {formatCzk(campaign.revenue)}
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {campaign.used_orders}{" "}
                      {campaign.used_orders === 1 ? "objednávka" : "objednávek"}
                    </Text>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {!isLoading && !isError && active === "statistiky" && (
        <div className="flex flex-col gap-y-5 px-6 py-5">
          <RawData data={data} />
          <div>
            <Text size="small" weight="plus">
              Co která akce přinesla
            </Text>
            <Text size="xsmall" className="text-ui-fg-subtle mt-1">
              Tržba je součet objednávek, ve kterých sleva zazněla; u sezónních
              akcí tržba prodaných kusů z akce v jejím období. Počítáno
              z posledních {data?.orders_scanned ?? 0} objednávek.
            </Text>
          </div>

          <div>
            <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
              Slevové kódy
            </Text>
            {(data?.promotions ?? [])
              .filter((promotion) => (promotion.used_count ?? 0) > 0)
              .sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))
              .map((promotion) => (
                <Text key={promotion.id} size="small" className="mt-1.5">
                  {promotion.code ?? "Automatická"} — přineslo{" "}
                  {formatCzk(promotion.revenue ?? 0)} · sleva{" "}
                  {formatCzk(promotion.discount_given ?? 0)} · použito{" "}
                  {promotion.used_count}×
                </Text>
              ))}
            {(data?.promotions ?? []).every(
              (promotion) => (promotion.used_count ?? 0) === 0
            ) && (
              <Text size="small" className="text-ui-fg-subtle mt-1.5">
                Žádný kód zatím nikdo nepoužil.
              </Text>
            )}
          </div>

          <div>
            <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
              Kampaně
            </Text>
            {(data?.campaigns ?? [])
              .filter((campaign) => campaign.used_orders > 0)
              .map((campaign) => (
                <Text key={campaign.id} size="small" className="mt-1.5">
                  {campaign.name} — přineslo {formatCzk(campaign.revenue)} ·
                  sleva {formatCzk(campaign.discount_given)} ·{" "}
                  {campaign.used_orders}{" "}
                  {campaign.used_orders === 1 ? "objednávka" : "objednávek"}
                </Text>
              ))}
            {(data?.campaigns ?? []).every(
              (campaign) => campaign.used_orders === 0
            ) && (
              <Text size="small" className="text-ui-fg-subtle mt-1.5">
                Kampaně zatím nic nepřinesly.
              </Text>
            )}
          </div>

          <div>
            <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
              Sezónní akce
            </Text>
            {(data?.seasonal_selections ?? []).map((selection) => (
              <Text key={selection.id} size="small" className="mt-1.5">
                {selection.title}
                {selection.status === "published" ? " (běží)" : ""} — přineslo{" "}
                {formatCzk(selection.revenue)} · {selection.orders}{" "}
                {selection.orders === 1 ? "objednávka" : "objednávek"} ·{" "}
                {selection.products_count}{" "}
                {selection.products_count === 1 ? "produkt" : "produktů"}
              </Text>
            ))}
            {(data?.seasonal_selections ?? []).length === 0 && (
              <Text size="small" className="text-ui-fg-subtle mt-1.5">
                Žádná sezónní akce zatím neproběhla.
              </Text>
            )}
          </div>
        </div>
      )}

      {!isLoading && !isError && active === "ceniky" && (
        <div className="divide-y">
          {(data?.price_lists ?? []).length === 0 ? (
            <EmptyState
              title="Žádné ceníky"
              description="Akční ceník vzniká při sezónní akci (odkaz Sezónní akce nahoře)."
            />
          ) : (
            <ColumnHeader cols={PRICE_LIST_COLS} names={["Ceník", "Stav", "Platí"]} />
          )}
          {(data?.price_lists ?? []).map((list) => (
            <PriceListRow key={list.id} list={list} />
          ))}
        </div>
      )}
    </Container>
  );
};

const queryClient = adminQueryClient;

const SlevyWorkbenchPage = () => (
  <QueryClientProvider client={queryClient}>
    <SlevyInner />
  </QueryClientProvider>
);

export const config = defineRouteConfig({
  label: "Slevy",
  icon: ReceiptPercent,
  // Vedlejší: za Poukazy (45), před Zákazníky (60).
  rank: 50,
});

export default SlevyWorkbenchPage;
