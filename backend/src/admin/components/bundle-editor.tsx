import {
  Button,
  Drawer,
  Input,
  Label,
  Select,
  Text,
  toast,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { sdk } from "../lib/sdk";

/**
 * Balíček editor — Produkty+ → Balíčky (phase 3 follow-up).
 *
 * Edits go through the existing `/admin/bundled-products` routes, which are
 * the single owner of bundle state. The editor covers what she actually
 * decides about a bundle: what is in it, and how its price relates to the
 * components (full sum, sum with a discount, or a fixed price).
 */

type BundleItemRow = {
  product_id: string;
  title: string;
  quantity: number;
};

type BundleDetail = {
  bundled_product: {
    id: string;
    title: string;
    pricing_mode: "component_sum" | "component_sum_discount" | "fixed_price";
    discount_percentage: number | null;
    items: {
      id: string;
      quantity: number;
      product: { id: string; title: string } | null;
    }[];
  };
};

export const BundleEditor = ({
  bundleId,
  trigger,
  onSaved,
}: {
  /*
   * Edit only. Creating goes through the Nový produkt panel
   * (CreateBundledProduct), because POST /admin/bundled-products requires the
   * composite product payload this drawer never collects — the old create
   * mode here could only ever 400.
   */
  bundleId: string;
  trigger: React.ReactNode;
  onSaved?: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pricingMode, setPricingMode] = useState<string>("component_sum");
  const [discount, setDiscount] = useState("");
  const [items, setItems] = useState<BundleItemRow[]>([]);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: detail } = useQuery<BundleDetail>({
    queryKey: ["workbench-bundle", bundleId],
    queryFn: () =>
      sdk.client.fetch(`/admin/bundled-products/${bundleId}`),
    enabled: open && Boolean(bundleId),
  });

  useEffect(() => {
    if (open && bundleId && detail) {
      const bundle = detail.bundled_product;
      setTitle(bundle.title);
      setPricingMode(bundle.pricing_mode);
      setDiscount(
        bundle.discount_percentage != null
          ? String(bundle.discount_percentage)
          : ""
      );
      setItems(
        bundle.items
          .filter((item) => item.product)
          .map((item) => ({
            product_id: item.product!.id,
            title: item.product!.title,
            quantity: item.quantity,
          }))
      );
    }
  }, [open, bundleId, detail]);

  // Product picker: a thin search over the catalog the workbench already
  // serves. Only plain products are offered — a bundle of bundles or of
  // commissions is a pricing question nobody has answered.
  const { data: candidates } = useQuery<{
    products: { id: string; title: string; kind: string }[];
  }>({
    queryKey: ["workbench-bundle-candidates", search],
    queryFn: () =>
      sdk.client.fetch(
        `/admin/workbench/products?kind=bezne${search.trim() ? `&q=${encodeURIComponent(search.trim())}` : ""}&limit=8`
      ),
    enabled: open && search.trim().length > 1,
  });

  const save = useMutation({
    mutationFn: () => {
      if (!title.trim()) throw new Error("Balíček potřebuje název.");
      if (items.length < 2)
        throw new Error("Balíček dává smysl od dvou produktů.");
      const discountValue = discount ? Number(discount) : null;
      if (
        pricingMode === "component_sum_discount" &&
        (!discountValue || discountValue <= 0 || discountValue >= 100)
      ) {
        throw new Error("Sleva balíčku musí být mezi 1 a 99 %.");
      }

      const body = {
        title: title.trim(),
        pricing_mode: pricingMode,
        discount_percentage:
          pricingMode === "component_sum_discount" ? discountValue : null,
        items: items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
      };

      return sdk.client.fetch(`/admin/bundled-products/${bundleId}`, {
        method: "PATCH",
        body,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workbench-products"] });
      await queryClient.invalidateQueries({ queryKey: ["workbench-bundle", bundleId] });
      toast.success("Balíček upraven.");
      setOpen(false);
      onSaved?.();
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
          <Drawer.Title>{`Balíček — ${title || "…"}`}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-5 overflow-y-auto">
          <div>
            <Label htmlFor="bundle-title">Název</Label>
            <Input
              id="bundle-title"
              value={title}
              placeholder="Např. Snídaňový set"
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div>
            <Label>Cena balíčku</Label>
            <Select value={pricingMode} onValueChange={setPricingMode}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="component_sum">
                  Součet cen produktů
                </Select.Item>
                <Select.Item value="component_sum_discount">
                  Součet se slevou
                </Select.Item>
                <Select.Item value="fixed_price">Pevná cena</Select.Item>
              </Select.Content>
            </Select>
            {pricingMode === "component_sum_discount" && (
              <div className="mt-2">
                <Label htmlFor="bundle-discount">Sleva (%)</Label>
                <Input
                  id="bundle-discount"
                  type="number"
                  min={1}
                  max={99}
                  value={discount}
                  onChange={(event) => setDiscount(event.target.value)}
                />
              </div>
            )}
            {pricingMode === "fixed_price" && (
              <Text size="xsmall" className="text-ui-fg-subtle mt-2">
                Pevnou cenu nastavíte na produktu balíčku — tady se určuje jen
                režim.
              </Text>
            )}
          </div>

          <div>
            <Label>Co je uvnitř</Label>
            {items.length === 0 && (
              <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                Zatím prázdné — vyhledejte produkty níže.
              </Text>
            )}
            {items.map((item, index) => (
              <div
                key={item.product_id}
                className="mt-2 flex items-center gap-2"
              >
                <Text size="small" className="min-w-0 flex-1 truncate">
                  {item.title}
                </Text>
                <Input
                  size="small"
                  type="number"
                  min={1}
                  className="w-16"
                  value={String(item.quantity)}
                  onChange={(event) => {
                    const next = [...items];
                    next[index] = {
                      ...item,
                      quantity: Math.max(1, Number(event.target.value) || 1),
                    };
                    setItems(next);
                  }}
                />
                <Button
                  size="small"
                  variant="transparent"
                  onClick={() =>
                    setItems(items.filter((_, i) => i !== index))
                  }
                >
                  Odebrat
                </Button>
              </div>
            ))}

            <Input
              size="small"
              type="search"
              className="mt-3"
              placeholder="Přidat produkt — hledejte podle názvu…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {(candidates?.products ?? [])
              .filter(
                (candidate) =>
                  !items.some((item) => item.product_id === candidate.id)
              )
              .map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  className="text-ui-fg-interactive txt-small mt-1.5 block hover:underline"
                  onClick={() => {
                    setItems([
                      ...items,
                      {
                        product_id: candidate.id,
                        title: candidate.title,
                        quantity: 1,
                      },
                    ]);
                    setSearch("");
                  }}
                >
                  + {candidate.title}
                </button>
              ))}
          </div>
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
