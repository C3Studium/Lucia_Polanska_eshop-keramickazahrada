import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Badge, Button, Container, Text, toast } from "@medusajs/ui";
import {
  QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient,
} from "@tanstack/react-query";
import { ProductionProfileEditor } from "../components/production-profile-editor";
import { sdk } from "../lib/sdk";

/**
 * Typ produktu — right where she creates it (Matěj: the zakázka % and the
 * poškozené sale belong AT product creation, not three pages away).
 *
 * Medusa's create-modal has no injection zones, but its flow lands on this
 * detail page before anything is published — so this widget IS the creation
 * step for the two special types: set the commission terms (minimum deposit
 * = the checkout slider's floor) or mark the piece as damaged clearance,
 * whose price IS the one-off sale and which retires itself when sold out.
 */
const Inner = ({ productId }: { productId: string }) => {
  const queryClient = useQueryClient();

  const { data: profileData } = useQuery<{ product: any }>({
    queryKey: ["production-profile", productId],
    queryFn: () => sdk.client.fetch(`/admin/made-to-order/products/${productId}`),
    refetchOnWindowFocus: true,
  });
  const { data: productData } = useQuery<{ product: any }>({
    queryKey: ["product-type-tools", productId],
    queryFn: () => sdk.client.fetch(`/admin/products/${productId}?fields=id,title,metadata`),
    refetchOnWindowFocus: true,
  });

  const profile = profileData?.product?.profile;
  const product = productData?.product;
  const clearance = Boolean((product?.metadata as any)?.clearance);

  const toggleClearance = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/products/${productId}`, {
        method: "POST",
        body: { metadata: { clearance: !clearance } },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["product-type-tools", productId] });
      await queryClient.invalidateQueries({ queryKey: ["workbench-products"] });
      toast.success(
        clearance
          ? "Vyřazeno z výprodeje poškozených."
          : "Označeno jako poškozené — cena produktu je teď jeho jednorázová sleva."
      );
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Změna se nepodařila."),
  });

  return (
    <Container className="flex flex-col gap-y-3 p-4">
      <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
        Typ produktu
      </Text>

      <div className="flex items-center justify-between gap-2">
        <div>
          <Text size="small" weight="plus">
            Zakázková výroba{" "}
            {profile?.enabled && (
              <Badge size="2xsmall" color="orange" className="ml-1">
                min. záloha {profile.default_deposit_percentage} %
              </Badge>
            )}
          </Text>
          <Text size="xsmall" className="text-ui-fg-subtle">
            {profile?.enabled
              ? `Výroba ${profile.production_time_min_days}–${profile.production_time_max_days} dní.`
              : "Vyrábí se až na objednávku; zákazník platí zálohu podle vašeho minima."}
          </Text>
        </div>
        <ProductionProfileEditor
          productId={productId}
          productTitle={product?.title ?? "produkt"}
          trigger={
            <Button size="small" variant="secondary">
              {profile?.enabled ? "Upravit" : "Nastavit"}
            </Button>
          }
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div>
          <Text size="small" weight="plus">
            Poškozený kus{" "}
            {clearance && (
              <Badge size="2xsmall" color="red" className="ml-1">výprodej</Badge>
            )}
          </Text>
          <Text size="xsmall" className="text-ui-fg-subtle">
            {clearance
              ? "Cena níže JE jednorázová sleva. Po vyprodání se sám skryje a z akcí vyřadí."
              : "Jednorázový kus se slevou — cenu nastavte přímo u variant níže."}
          </Text>
        </div>
        <Button
          size="small"
          variant="secondary"
          isLoading={toggleClearance.isPending}
          onClick={() => toggleClearance.mutate()}
        >
          {clearance ? "Ukončit výprodej" : "Označit"}
        </Button>
      </div>
    </Container>
  );
};

const queryClient = new QueryClient();
const Widget = ({ data }: { data: { id: string } }) => (
  <QueryClientProvider client={queryClient}>
    <Inner productId={data.id} />
  </QueryClientProvider>
);
export const config = defineWidgetConfig({ zone: "product.details.side.after" });
export default Widget;
