import { Button, Drawer, Skeleton, Text, toast } from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BundleComposer, BundleEditorItem } from "./bundle-composer";
import { sdk } from "../lib/sdk";

type UpdateBundledProductProps = {
  id: string;
  initialTitle?: string;
};

type BundleDetails = {
  bundled_product?: {
    title?: string;
    product?: { id?: string | null } | null;
    items?: Array<{
      quantity?: number | null;
      product?: {
        id: string;
        title: string;
        thumbnail?: string | null;
        handle?: string | null;
        status?: "draft" | "proposed" | "published" | "rejected";
      } | null;
    }>;
  };
};

const UpdateBundledProduct = ({
  id,
  initialTitle,
}: UpdateBundledProductProps) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle ?? "");
  const [items, setItems] = useState<BundleEditorItem[]>([]);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<BundleDetails>({
    queryKey: ["bundled-product", id],
    queryFn: () =>
      sdk.client.fetch(`/admin/bundled-products/${id}`, {
        method: "GET",
      }),
    enabled: open && !!id,
  });

  useEffect(() => {
    if (!open || !data?.bundled_product) return;

    setTitle(data.bundled_product.title || initialTitle || "");
    setItems(
      (data.bundled_product.items || []).flatMap((item) => {
        if (!item.product?.id) return [];

        return [
          {
            product_id: item.product.id,
            quantity:
              typeof item.quantity === "number" && item.quantity > 0
                ? item.quantity
                : 1,
            product: {
              id: item.product.id,
              title: item.product.title,
              thumbnail: item.product.thumbnail,
              handle: item.product.handle,
              status: item.product.status,
            },
          },
        ];
      })
    );
  }, [data, initialTitle, open]);

  const { mutateAsync: updateBundle, isPending } = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      sdk.client.fetch(`/admin/bundled-products/${id}`, {
        method: "PATCH",
        body: payload,
      }),
  });

  const isValid =
    title.trim().length > 0 &&
    items.length > 0 &&
    items.every(
      (item) =>
        item.product_id && Number.isFinite(item.quantity) && item.quantity > 0
    );

  const handleUpdate = async () => {
    if (!title.trim()) {
      toast.error("Doplňte název balíčku");
      return;
    }

    if (!items.length) {
      toast.error("Balíček musí obsahovat alespoň jeden produkt");
      return;
    }

    try {
      await updateBundle({
        title: title.trim(),
        items: items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["bundled-products"] }),
        queryClient.invalidateQueries({ queryKey: ["bundled-product", id] }),
      ]);
      toast.success("Balíček byl aktualizován");
      setOpen(false);
    } catch {
      toast.error("Balíček se nepodařilo aktualizovat");
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setTitle(initialTitle || "");
      setItems([]);
    }
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <Drawer.Trigger asChild>
        <Button variant="secondary" size="small">
          Upravit
        </Button>
      </Drawer.Trigger>
      <Drawer.Content className="flex h-full flex-col">
        <Drawer.Header>
          <Drawer.Title>Upravit balíček</Drawer.Title>
          <Drawer.Description>
            Vyhledejte produkty a upravte pořadí nebo množství položek.
          </Drawer.Description>
        </Drawer.Header>

        <Drawer.Body className="flex-1 overflow-y-auto px-6 py-6">
          {isLoading && (
            <div className="flex flex-col gap-y-6">
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-36 rounded-lg" />
              <Skeleton className="h-48 rounded-lg" />
            </div>
          )}

          {isError && (
            <div className="border-ui-border-error bg-ui-bg-base flex min-h-32 items-center justify-center rounded-lg border px-6 text-center">
              <Text size="small" className="text-ui-fg-error">
                Podrobnosti balíčku se nepodařilo načíst. Zavřete editor a
                zkuste to znovu.
              </Text>
            </div>
          )}

          {!isLoading && !isError && (
            <BundleComposer
              title={title}
              onTitleChange={setTitle}
              items={items}
              onItemsChange={setItems}
              excludedProductIds={
                data?.bundled_product?.product?.id
                  ? [data.bundled_product.product.id]
                  : []
              }
            />
          )}
        </Drawer.Body>

        <Drawer.Footer>
          <Button
            variant="secondary"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Zrušit
          </Button>
          <Button
            variant="primary"
            onClick={handleUpdate}
            isLoading={isPending}
            disabled={!isValid || isLoading || isError}
          >
            Uložit změny
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

export default UpdateBundledProduct;
