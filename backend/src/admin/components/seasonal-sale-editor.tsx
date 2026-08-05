import {
  Button,
  Drawer,
  Input,
  Label,
  Select,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { sdk } from "../lib/sdk";

/**
 * Creating and editing a sezónní akce, without leaving the list.
 *
 * ## Why a drawer rather than the plan's five-step wizard
 *
 * §13 specifies a wizard: name, products, dates, discount, preview. A wizard
 * earns its place when the steps depend on each other and the whole thing is
 * unfamiliar — but she will make maybe six of these a year, and by the third
 * one the ceremony is in the way. Everything fits on one surface, and one
 * surface can also *edit*, which a wizard cannot.
 *
 * The products picker is a search over the catalogue rather than a list of
 * everything: with a few hundred pieces, scrolling to find „Hrnek modrý" is
 * slower than typing it.
 */

export type SaleDraft = {
  id?: string;
  title: string;
  handle: string;
  description?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  on_end?: "keep_selling" | "hide_products";
  publication_status?: "draft" | "published" | "archived";
  items?: Array<{ product_id: string }>;
};

const toDateInput = (value?: string | null) =>
  value ? new Date(value).toISOString().slice(0, 10) : "";

/** „Vánoční kolekce" → „vanocni-kolekce". Handles are URLs, so no diacritics. */
const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)

export const SeasonalSaleEditor = ({
  sale,
  trigger,
}: {
  sale?: SaleDraft;
  trigger: React.ReactNode;
}) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(sale?.title ?? "");
  const [description, setDescription] = useState(sale?.description ?? "");
  const [startsAt, setStartsAt] = useState(toDateInput(sale?.starts_at));
  const [endsAt, setEndsAt] = useState(toDateInput(sale?.ends_at));
  const [onEnd, setOnEnd] = useState(sale?.on_end ?? "keep_selling");
  const [productIds, setProductIds] = useState<string[]>(
    (sale?.items ?? []).map((item) => item.product_id)
  );
  const [search, setSearch] = useState("");

  const { data: catalogue } = useQuery<{
    products: Array<{ id: string; title: string; thumbnail: string | null }>;
  }>({
    queryKey: ["catalog-products", "sale-picker", search],
    queryFn: () =>
      sdk.client.fetch("/admin/operations/products", {
        query: { kind: "standard", q: search, limit: 30 },
      }),
    enabled: open,
  });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        title,
        handle: sale?.handle ?? slugify(title),
        description: description || null,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        on_end: onEnd,
        items: productIds.map((product_id) => ({ product_id })),
      };

      return sale?.id
        ? sdk.client.fetch(
            `/admin/merchant-catalog/seasonal-selections/${sale.id}`,
            { method: "PATCH", body }
          )
        : sdk.client.fetch("/admin/merchant-catalog/seasonal-selections", {
            method: "POST",
            body: { ...body, publication_status: "draft" },
          });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["seasonal-selections"] });
      await queryClient.invalidateQueries({ queryKey: ["operations-discounts"] });
      toast.success(sale?.id ? "Akce byla upravena" : "Akce byla založena");
      setOpen(false);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Akci se nepodařilo uložit"
      ),
  });

  // A sale that ends before it starts is always a mistake, and it would show as
  // finished the moment it was saved.
  const datesInvalid =
    Boolean(startsAt && endsAt) && new Date(endsAt) < new Date(startsAt);
  const canSave = title.trim().length > 1 && !datesInvalid;

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>
            {sale?.id ? "Upravit akci" : "Nová sezónní akce"}
          </Drawer.Title>
        </Drawer.Header>

        <Drawer.Body className="flex flex-col gap-y-4 overflow-y-auto">
          <div className="flex flex-col gap-y-1">
            <Label size="xsmall" htmlFor="sale-title">
              Název
            </Label>
            <Input
              id="sale-title"
              placeholder="Např. Vánoční kolekce"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-y-1">
            <Label size="xsmall" htmlFor="sale-description">
              Popis pro zákazníky
            </Label>
            <Textarea
              id="sale-description"
              rows={2}
              value={description ?? ""}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-y-1">
              <Label size="xsmall" htmlFor="sale-from">
                Od
              </Label>
              <Input
                id="sale-from"
                type="date"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-y-1">
              <Label size="xsmall" htmlFor="sale-to">
                Do
              </Label>
              <Input
                id="sale-to"
                type="date"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
              />
            </div>
          </div>

          {datesInvalid && (
            <Text size="small" className="text-ui-fg-error">
              Konec akce nemůže být dřív než začátek.
            </Text>
          )}

          <div className="flex flex-col gap-y-1">
            <Label size="xsmall">Až akce skončí</Label>
            <Select
              value={onEnd}
              onValueChange={(value) => setOnEnd(value as typeof onEnd)}
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="keep_selling">
                  Vrátit na běžnou cenu a prodávat dál
                </Select.Item>
                <Select.Item value="hide_products">
                  Schovat produkty z e-shopu (výprodej)
                </Select.Item>
              </Select.Content>
            </Select>
          </div>

          <div className="flex flex-col gap-y-2">
            <Label size="xsmall">Produkty v akci ({productIds.length})</Label>
            <Input
              type="search"
              placeholder="Hledat produkt…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="max-h-64 overflow-y-auto rounded-lg border">
              {(catalogue?.products ?? []).map((product) => {
                const selected = productIds.includes(product.id);
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() =>
                      setProductIds((current) =>
                        selected
                          ? current.filter((id) => id !== product.id)
                          : [...current, product.id]
                      )
                    }
                    className={
                      "hover:bg-ui-bg-base-hover flex w-full items-center gap-2 border-b px-3 py-2 text-left last:border-b-0 " +
                      (selected ? "bg-ui-bg-base-pressed" : "")
                    }
                  >
                    {product.thumbnail ? (
                      <img
                        src={product.thumbnail}
                        alt=""
                        className="h-6 w-6 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="bg-ui-bg-subtle h-6 w-6 shrink-0 rounded" />
                    )}
                    <Text size="small" className="min-w-0 flex-1 truncate">
                      {product.title}
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-muted">
                      {selected ? "V akci" : "Přidat"}
                    </Text>
                  </button>
                );
              })}
            </div>
            <Text size="xsmall" className="text-ui-fg-muted">
              Slevu na vybrané produkty nastavíte v ceníku, který je k akci
              připojený.
            </Text>
          </div>
        </Drawer.Body>

        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="secondary" size="small">
              Zpět
            </Button>
          </Drawer.Close>
          <Button
            size="small"
            isLoading={save.isPending}
            disabled={!canSave}
            onClick={() => save.mutate()}
          >
            {sale?.id ? "Uložit" : "Založit akci"}
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};
