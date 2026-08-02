import { Button, Drawer, Skeleton, Text, toast } from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BundleComposer, BundleEditorItem } from "./bundle-composer";
import {
  bundleDetailsToProductPayload,
  BundleProductDetails,
  createEmptyBundleProductDetails,
} from "./bundle-product-details";
import { sdk } from "../lib/sdk";

type UpdateBundledProductProps = {
  id: string;
  initialTitle?: string;
};

type BundleDetails = {
  bundled_product?: {
    title?: string;
    pricing_mode?: BundleProductDetails["pricing_mode"];
    discount_percentage?: number | null;
    product?: {
      id?: string | null;
      title?: string | null;
      subtitle?: string | null;
      description?: string | null;
      handle?: string | null;
      material?: string | null;
      discountable?: boolean | null;
      status?: "draft" | "proposed" | "published" | "rejected";
      thumbnail?: string | null;
      images?: Array<{ id?: string | null; url: string }> | null;
    } | null;
    items?: Array<{
      quantity?: number | null;
      display_order?: number | null;
      variant_mode?: BundleEditorItem["variant_mode"];
      variant?: {
        id: string;
        title: string;
        sku?: string | null;
      } | null;
      product?: {
        id: string;
        title: string;
        thumbnail?: string | null;
        handle?: string | null;
        status?: "draft" | "proposed" | "published" | "rejected";
        variants?: Array<{
          id: string;
          title: string;
          sku?: string | null;
        }>;
      } | null;
    }>;
  };
};

const UpdateBundledProduct = ({
  id,
  initialTitle,
}: UpdateBundledProductProps) => {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<BundleProductDetails>(() => ({
    ...createEmptyBundleProductDetails(),
    title: initialTitle ?? "",
  }));
  const [items, setItems] = useState<BundleEditorItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
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

    const product = data.bundled_product.product;
    const images = (product?.images || []).map((image) => ({
      ...(image.id ? { id: image.id } : {}),
      url: image.url,
    }));

    setDetails({
      title:
        product?.title || data.bundled_product.title || initialTitle || "",
      subtitle: product?.subtitle || "",
      description: product?.description || "",
      handle: product?.handle || "",
      material: product?.material || "",
      discountable: product?.discountable !== false,
      status: product?.status === "draft" ? "draft" : "published",
      images,
      thumbnail: product?.thumbnail || images[0]?.url || null,
      pricing_mode:
        data.bundled_product.pricing_mode || "component_sum",
      discount_percentage:
        data.bundled_product.discount_percentage ?? null,
    });
    setItems(
      [...(data.bundled_product.items || [])]
        .sort((first, second) =>
          (first.display_order ?? 0) - (second.display_order ?? 0)
        )
        .flatMap((item) => {
        if (!item.product?.id) return [];

        return [
          {
            product_id: item.product.id,
            quantity:
              typeof item.quantity === "number" && item.quantity > 0
                ? item.quantity
                : 1,
            display_order:
              typeof item.display_order === "number" ? item.display_order : 0,
            variant_mode: item.variant_mode || "customer_selects",
            variant_id: item.variant?.id || null,
            product: {
              id: item.product.id,
              title: item.product.title,
              thumbnail: item.product.thumbnail,
              handle: item.product.handle,
              status: item.product.status,
              variants: item.product.variants || [],
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
    details.title.trim().length > 0 &&
    details.handle.trim().length > 0 &&
    items.length > 0 &&
    !isUploading &&
    items.every(
      (item) =>
        item.product_id &&
        Number.isFinite(item.quantity) &&
        item.quantity > 0 &&
        (item.variant_mode !== "fixed_variant" || !!item.variant_id)
    );

  const handleUpdate = async () => {
    if (!details.title.trim()) {
      toast.error("Doplňte název balíčku");
      return;
    }

    if (!details.handle.trim()) {
      toast.error("Doplňte URL identifikátor balíčku");
      return;
    }

    if (isUploading) {
      toast.error("Počkejte prosím na dokončení nahrávání obrázků");
      return;
    }

    if (!items.length) {
      toast.error("Balíček musí obsahovat alespoň jeden produkt");
      return;
    }

    if (
      items.some(
        (item) => item.variant_mode === "fixed_variant" && !item.variant_id
      )
    ) {
      toast.error("U položek s pevným provedením vyberte konkrétní variantu");
      return;
    }

    try {
      await updateBundle({
        title: details.title.trim(),
        pricing_mode: details.pricing_mode,
        discount_percentage: details.discount_percentage,
        product: bundleDetailsToProductPayload(details),
        items: items.map((item, displayOrder) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          display_order: displayOrder,
          variant_mode: item.variant_mode,
          ...(item.variant_mode === "fixed_variant" && item.variant_id
            ? { variant_id: item.variant_id }
            : {}),
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
      setDetails({
        ...createEmptyBundleProductDetails(),
        title: initialTitle || "",
      });
      setItems([]);
      setIsUploading(false);
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
              details={details}
              onDetailsChange={(patch) =>
                setDetails((current) => ({ ...current, ...patch }))
              }
              items={items}
              onItemsChange={setItems}
              onUploadingChange={setIsUploading}
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
