import { Button, FocusModal, Heading, Text, toast } from "@medusajs/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BundleComposer, BundleEditorItem } from "./bundle-composer";
import {
  bundleDetailsToProductPayload,
  BundleProductDetails,
  createEmptyBundleProductDetails,
} from "./bundle-product-details";
import { sdk } from "../lib/sdk";

const CreateBundledProduct = () => {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<BundleProductDetails>(
    createEmptyBundleProductDetails
  );
  const [items, setItems] = useState<BundleEditorItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();

  const { mutateAsync: createBundle, isPending } = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      sdk.client.fetch("/admin/bundled-products", {
        method: "POST",
        body: payload,
      }),
  });

  const reset = () => {
    setDetails(createEmptyBundleProductDetails());
    setItems([]);
    setIsUploading(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen && !isPending) reset();
  };

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

  const handleCreate = async () => {
    const validTitle = details.title.trim();

    if (!validTitle) {
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
      toast.error("Přidejte do balíčku alespoň jeden produkt");
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
      await createBundle({
        title: validTitle,
        pricing_mode: details.pricing_mode,
        discount_percentage: details.discount_percentage,
        product: {
          ...bundleDetailsToProductPayload(details),
          options: [
            {
              title: "Default",
              values: ["default"],
            },
          ],
          variants: [
            {
              title: validTitle,
              prices: [],
              options: {
                Default: "default",
              },
              manage_inventory: false,
            },
          ],
        },
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

      await queryClient.invalidateQueries({ queryKey: ["bundled-products"] });
      toast.success("Balíček byl vytvořen");
      setOpen(false);
      reset();
    } catch {
      toast.error("Balíček se nepodařilo vytvořit");
    }
  };

  return (
    <FocusModal open={open} onOpenChange={handleOpenChange}>
      <FocusModal.Trigger asChild>
        <Button variant="primary">Vytvořit balíček</Button>
      </FocusModal.Trigger>
      <FocusModal.Content>
        <FocusModal.Header>
          <div className="flex w-full items-center justify-between gap-x-3">
            <div className="hidden items-center gap-x-2 sm:flex">
              <span className="bg-ui-tag-neutral-bg text-ui-fg-subtle rounded-md px-2 py-1 font-mono text-xs">
                01
              </span>
              <Text size="small" weight="plus">
                Nový balíček
              </Text>
            </div>
            <div className="ml-auto flex items-center gap-x-2">
              <FocusModal.Close asChild>
                <Button variant="secondary" size="small" disabled={isPending}>
                  Zrušit
                </Button>
              </FocusModal.Close>
              <Button
                variant="primary"
                size="small"
                onClick={handleCreate}
                isLoading={isPending}
                disabled={!isValid}
              >
                Vytvořit balíček
              </Button>
            </div>
          </div>
        </FocusModal.Header>

        <FocusModal.Body>
          <div className="flex h-full flex-col items-center overflow-y-auto">
            <div className="mx-auto flex w-full max-w-[780px] flex-col px-4 py-12 sm:px-8 sm:py-16">
              <div className="border-ui-border-base mb-10 border-b pb-8">
                <FocusModal.Title asChild>
                  <Heading level="h1">Sestavit nový balíček</Heading>
                </FocusModal.Title>
                <FocusModal.Description asChild>
                  <Text className="text-ui-fg-subtle mt-2 max-w-xl">
                    Najděte konkrétní objekty, určete jejich množství a seřaďte
                    je tak, jak se mají zákazníkovi zobrazit.
                  </Text>
                </FocusModal.Description>
              </div>

              <BundleComposer
                details={details}
                onDetailsChange={(patch) =>
                  setDetails((current) => ({ ...current, ...patch }))
                }
                items={items}
                onItemsChange={setItems}
                onUploadingChange={setIsUploading}
              />
            </div>
          </div>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  );
};

export default CreateBundledProduct;
