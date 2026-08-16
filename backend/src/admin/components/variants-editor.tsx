import {
  Button, Drawer, Input, Text, toast,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { sdk } from "../lib/sdk";

/**
 * Varianty — no-extra-steps variant and price editing (Matěj, 2026-08-06).
 * Everything goes through the native product APIs; this drawer only removes
 * the walk to them. Price edits are per-variant CZK, saved on blur/Enter.
 */
const Row = ({ productId, variant }: { productId: string; variant: any }) => {
  const queryClient = useQueryClient();
  const czk = (variant.prices ?? []).find(
    (price: any) => String(price.currency_code).toLowerCase() === "czk"
  );
  const [price, setPrice] = useState(czk ? String(czk.amount) : "");
  const [title, setTitle] = useState(variant.title ?? "");

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["variants-editor", productId] });
    await queryClient.invalidateQueries({ queryKey: ["workbench-products"] });
  };
  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/products/${productId}/variants/${variant.id}`, {
        method: "POST",
        body: {
          title: title.trim() || variant.title,
          // The price list replaces wholesale — foreign currencies derived by
          // the ČNB job must ride along, or a CZK edit would wipe them.
          prices: price
            ? [
                { currency_code: "czk", amount: Number(price) },
                ...(variant.prices ?? [])
                  .filter(
                    (p: any) => String(p.currency_code).toLowerCase() !== "czk"
                  )
                  .map((p: any) => ({
                    currency_code: p.currency_code,
                    amount: p.amount,
                  })),
              ]
            : undefined,
        },
      }),
    onSuccess: async () => { await invalidate(); toast.success("Varianta uložena."); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Uložení se nepodařilo."),
  });
  const remove = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/products/${productId}/variants/${variant.id}`, {
        method: "DELETE",
      }),
    onSuccess: async () => { await invalidate(); toast.success("Varianta odstraněna."); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Odstranění se nepodařilo."),
  });

  return (
    <div className="border-ui-border-base flex flex-wrap items-center gap-2 rounded-lg border p-2">
      <Input size="small" className="min-w-32 flex-1" value={title}
        onChange={(e) => setTitle(e.target.value)} />
      <Input size="small" className="w-28" type="number" placeholder="Kč"
        value={price} onChange={(e) => setPrice(e.target.value)} />
      <Button size="small" variant="secondary" isLoading={save.isPending}
        onClick={() => save.mutate()}>Uložit</Button>
      <Button size="small" variant="transparent" onClick={() => remove.mutate()}>
        Odebrat
      </Button>
    </div>
  );
};

export const VariantsEditor = ({ productId, productTitle, trigger }: {
  productId: string; productTitle: string; trigger: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const queryClient = useQueryClient();

  const { data } = useQuery<{ product: any }>({
    queryKey: ["variants-editor", productId],
    queryFn: () =>
      sdk.client.fetch(
        `/admin/products/${productId}?fields=id,title,*variants,*variants.prices,*options,*options.values`
      ),
    enabled: open,
  });
  const product = data?.product;

  const add = useMutation({
    mutationFn: () => {
      if (!newTitle.trim()) throw new Error("Varianta potřebuje název.");
      const optionTitle = product?.options?.[0]?.title;
      return sdk.client.fetch(`/admin/products/${productId}/variants`, {
        method: "POST",
        body: {
          title: newTitle.trim(),
          ...(optionTitle ? { options: { [optionTitle]: newTitle.trim() } } : {}),
          prices: newPrice
            ? [{ currency_code: "czk", amount: Number(newPrice) }]
            : [],
          // Shop default: keep selling after sell-out (stock goes negative);
          // per-product override lives on the product detail page.
          allow_backorder: true,
        },
      });
    },
    onSuccess: async () => {
      setNewTitle(""); setNewPrice("");
      await queryClient.invalidateQueries({ queryKey: ["variants-editor", productId] });
      await queryClient.invalidateQueries({ queryKey: ["workbench-products"] });
      toast.success("Varianta přidána.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Přidání se nepodařilo."),
  });

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Varianty — {productTitle}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-3 overflow-y-auto">
          {(product?.variants ?? []).map((variant: any) => (
            <Row key={variant.id} productId={productId} variant={variant} />
          ))}
          <div className="border-ui-border-base flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-2">
            <Input size="small" className="min-w-32 flex-1" placeholder="Nová varianta (např. Modrá)"
              value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            <Input size="small" className="w-28" type="number" placeholder="Kč"
              value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
            <Button size="small" isLoading={add.isPending} onClick={() => add.mutate()}>
              Přidat
            </Button>
          </div>
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  );
};
