import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ReceiptPercent } from "@medusajs/icons";
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Prompt,
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
import { useState } from "react";
import { DiscountEditor } from "../../components/discount-editor";
import { EmptyState } from "../../components/empty-state";
import { SubTabs } from "../../components/work-tabs";
import { formatCzk } from "../../lib/workbench";
import { formatDate } from "../../lib/format";
import { sdk } from "../../lib/sdk";

/**
 * Slevy+ — promotions, campaigns and price lists as one workbench
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

type DiscountsResponse = {
  promotions: WorkbenchPromotion[];
  campaigns: WorkbenchCampaign[];
  price_lists: WorkbenchPriceList[];
};

const tabs = [
  { key: "akce", label: "Akce a kódy" },
  { key: "kampane", label: "Kampaně" },
  { key: "ceniky", label: "Ceníky" },
];

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
        error instanceof Error ? error.message : "Změna se nepodařila."
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
        error instanceof Error ? error.message : "Smazání se nepodařilo."
      ),
  });

  const active = promotion.status === "active";

  return (
    <article className="grid gap-3 px-6 py-4 lg:grid-cols-[minmax(0,1.2fr)_150px_170px_minmax(0,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <Text size="small" weight="plus" className="truncate">
          {promotion.is_automatic
            ? "Automatická sleva"
            : promotion.code || "—"}
        </Text>
        <Text size="xsmall" className="text-ui-fg-subtle mt-1">
          {promotion.effect ?? ""}
          {promotion.campaign ? ` · kampaň ${promotion.campaign.name}` : ""}
        </Text>
      </div>

      <div>
        <Badge size="2xsmall" color={active ? "green" : "grey"}>
          {active ? "Běží" : "Pozastaveno"}
        </Badge>
      </div>

      <div>
        {typeof promotion.used_count === "number" && (
          <Text size="xsmall" className="text-ui-fg-subtle">
            {promotion.used_count === 0
              ? "zatím nepoužito"
              : promotion.used_count === 1
                ? "použito 1×"
                : `použito ${promotion.used_count}×`}
          </Text>
        )}
      </div>

      <div />

      <div className="flex justify-start gap-2 lg:justify-end">
        <Button
          size="small"
          variant="secondary"
          isLoading={setStatus.isPending}
          onClick={() => setStatus.mutate(active ? "draft" : "active")}
        >
          {active ? "Pozastavit" : "Spustit"}
        </Button>
        <Prompt open={confirmDelete} onOpenChange={setConfirmDelete}>
          <Prompt.Trigger asChild>
            <Button size="small" variant="transparent">
              Smazat
            </Button>
          </Prompt.Trigger>
          <Prompt.Content>
            <Prompt.Header>
              <Prompt.Title>Smazat slevu?</Prompt.Title>
              <Prompt.Description>
                {promotion.code
                  ? `Kód ${promotion.code} přestane platit okamžitě.`
                  : "Automatická sleva přestane platit okamžitě."}{" "}
                Objednávek, které ji už použily, se to nedotkne.
              </Prompt.Description>
            </Prompt.Header>
            <Prompt.Footer>
              <Prompt.Cancel>Zrušit</Prompt.Cancel>
              <Prompt.Action onClick={() => remove.mutate()}>
                Smazat
              </Prompt.Action>
            </Prompt.Footer>
          </Prompt.Content>
        </Prompt>
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
        error instanceof Error ? error.message : "Uložení se nepodařilo."
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
              Zrušit
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
        error instanceof Error ? error.message : "Změna se nepodařila."
      ),
  });

  return (
    <article className="grid gap-3 px-6 py-4 lg:grid-cols-[minmax(0,1.2fr)_150px_190px_minmax(0,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <Text size="small" weight="plus" className="truncate">
          {list.title}
        </Text>
        <Text size="xsmall" className="text-ui-fg-subtle mt-1">
          {list.prices_count === 1
            ? "1 cena"
            : list.prices_count <= 4
              ? `${list.prices_count} ceny`
              : `${list.prices_count} cen`}
        </Text>
      </div>

      <div>
        <Badge size="2xsmall" color={active ? "green" : "grey"}>
          {active ? "Běží" : "Pozastaveno"}
        </Badge>
      </div>

      <div>
        {(list.starts_at || list.ends_at) && (
          <Text size="xsmall" className="text-ui-fg-subtle">
            {formatDate(list.starts_at)} – {formatDate(list.ends_at)}
          </Text>
        )}
      </div>

      <div />

      <div className="flex justify-start gap-2 lg:justify-end">
        <Button
          size="small"
          variant="secondary"
          isLoading={setStatus.isPending}
          onClick={() => setStatus.mutate(active ? "draft" : "active")}
        >
          {active ? "Pozastavit" : "Aktivovat"}
        </Button>
      </div>
    </article>
  );
};

const SlevyInner = () => {
  const [active, setActive] = useState("akce");

  const { data, isLoading, isError } = useQuery<DiscountsResponse>({
    queryKey: ["workbench-discounts"],
    queryFn: () => sdk.client.fetch("/admin/workbench/discounts"),
    refetchOnWindowFocus: true,
  });

  return (
    <Container className="divide-y p-0">
      <Toaster />
      <header className="flex flex-wrap items-start justify-between gap-3 px-6 pb-4 pt-6">
        <div>
          <Heading>Slevy — správa</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
            Kódy a automatické slevy, kampaně a akční ceníky — spouštění,
            pozastavení a mazání na jednom místě. Sezónní akce mají svůj
            domov v Přehledu → Slevy a akce.
          </Text>
        </div>
        <div className="flex gap-2">
          <CampaignEditor
            trigger={
              <Button size="small" variant="secondary">
                Nová kampaň
              </Button>
            }
          />
          <DiscountEditor
            trigger={
              <Button size="small" variant="secondary">
                Nová sleva
              </Button>
            }
          />
        </div>
      </header>

      <SubTabs
        tabs={tabs.map((tab) => ({
          ...tab,
          count:
            tab.key === "akce"
              ? data?.promotions.length
              : tab.key === "kampane"
                ? data?.campaigns.length
                : data?.price_lists.length,
        }))}
        active={active}
        onSelect={setActive}
      />

      {isLoading && (
        <div className="flex flex-col gap-y-3 px-6 py-5">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      )}

      {isError && (
        <EmptyState
          title="Slevy se nepodařilo načíst"
          description="Zkuste stránku obnovit."
        />
      )}

      {!isLoading && !isError && active === "akce" && (
        <div className="divide-y">
          {(data?.promotions ?? []).length === 0 && (
            <EmptyState
              title="Žádné slevy"
              description="Novou slevu vytvoříte tlačítkem nahoře."
            />
          )}
          {(data?.promotions ?? []).map((promotion) => (
            <PromotionRow key={promotion.id} promotion={promotion} />
          ))}
        </div>
      )}

      {!isLoading && !isError && active === "kampane" && (
        <div className="divide-y">
          {(data?.campaigns ?? []).length === 0 && (
            <EmptyState
              title="Žádné kampaně"
              description="Kampaň drží slevy pohromadě a hlídá jejich rozpočet."
            />
          )}
          {(data?.campaigns ?? []).map((campaign) => (
            <article
              key={campaign.id}
              className="grid gap-3 px-6 py-4 lg:grid-cols-[minmax(0,1.2fr)_190px_190px_minmax(0,1fr)_auto] lg:items-center"
            >
              <div className="min-w-0">
                <Text size="small" weight="plus" className="truncate">
                  {campaign.name}
                </Text>
                <Text size="xsmall" className="text-ui-fg-subtle mt-1">
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
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {formatDate(campaign.starts_at)} –{" "}
                    {formatDate(campaign.ends_at)}
                  </Text>
                )}
              </div>
              <div>
                {campaign.budget?.limit != null && (
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {campaign.budget.type === "spend"
                      ? `utraceno ${formatCzk(campaign.budget.used ?? 0)} z ${formatCzk(campaign.budget.limit)}`
                      : `použito ${campaign.budget.used ?? 0}× z ${campaign.budget.limit}`}
                  </Text>
                )}
              </div>
              <div />
              <div className="flex justify-start lg:justify-end">
                <CampaignEditor
                  campaign={campaign}
                  trigger={
                    <Button size="small" variant="secondary">
                      Upravit
                    </Button>
                  }
                />
              </div>
            </article>
          ))}
        </div>
      )}

      {!isLoading && !isError && active === "ceniky" && (
        <div className="divide-y">
          {(data?.price_lists ?? []).length === 0 && (
            <EmptyState
              title="Žádné ceníky"
              description="Akční ceník vzniká při sezónní akci v Přehledu → Slevy a akce."
            />
          )}
          {(data?.price_lists ?? []).map((list) => (
            <PriceListRow key={list.id} list={list} />
          ))}
        </div>
      )}
    </Container>
  );
};

const queryClient = new QueryClient();

const SlevyWorkbenchPage = () => (
  <QueryClientProvider client={queryClient}>
    <SlevyInner />
  </QueryClientProvider>
);

export const config = defineRouteConfig({
  label: "Slevy+",
  icon: ReceiptPercent,
});

export default SlevyWorkbenchPage;
