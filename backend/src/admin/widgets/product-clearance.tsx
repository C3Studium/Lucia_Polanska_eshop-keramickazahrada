import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type { AdminProduct, DetailWidgetProps } from "@medusajs/framework/types";
import { Container, Heading, Switch, Text, Toaster, toast } from "@medusajs/ui";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from "@tanstack/react-query";
import { useState } from "react";
import { sdk } from "../lib/sdk";

/**
 * „Výprodej — kus se už nevyrobí" (requested 2026-08-04).
 *
 * Marks a damaged or one-off piece. The consequence is automatic: once it sells
 * out, an hourly job hides it from the shop and removes it from any sale it was
 * part of, because a piece that will never be remade should not leave behind a
 * listing nobody can buy or a discount pointing at nothing.
 *
 * Stored on the product's own metadata, which Medusa already has — a table for
 * one boolean would be exactly the custom state the plan argues against.
 */
const ProductClearanceInner = ({ product }: { product: AdminProduct }) => {
  const [enabled, setEnabled] = useState(
    (product.metadata as Record<string, unknown> | null)?.clearance === true
  );

  const save = useMutation({
    mutationFn: (clearance: boolean) =>
      sdk.admin.product.update(product.id, {
        metadata: { ...(product.metadata ?? {}), clearance },
      }),
    onSuccess: (_result, clearance) => {
      setEnabled(clearance);
      toast.success(
        clearance
          ? "Produkt je označený jako výprodej"
          : "Produkt už není ve výprodeji"
      );
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Nepodařilo se uložit"
      );
    },
  });

  return (
    <Container className="p-0">
      <div className="flex items-start justify-between gap-4 px-6 py-4">
        <div>
          <Heading level="h2">Výprodej</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1 max-w-lg">
            Poškozený nebo poslední kus, který už znovu nevyrobíte. Až se
            prodá, sami ho schováme z e-shopu a odebereme z akcí — ať nikde
            nezůstane nabídka na něco, co už není.
          </Text>
        </div>
        <Switch
          checked={enabled}
          disabled={save.isPending}
          onCheckedChange={(value) => save.mutate(value)}
        />
      </div>
      <Toaster />
    </Container>
  );
};

const queryClient = new QueryClient();

const ProductClearanceWidget = ({ data }: DetailWidgetProps<AdminProduct>) => (
  <QueryClientProvider client={queryClient}>
    <ProductClearanceInner product={data} />
  </QueryClientProvider>
);

export const config = defineWidgetConfig({
  zone: "product.details.side.after",
  id: "keramicka-zahrada:product-clearance",
});

export default ProductClearanceWidget;
