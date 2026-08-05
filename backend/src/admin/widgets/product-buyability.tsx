import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Badge, Container, Text } from "@medusajs/ui";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { sdk } from "../lib/sdk";

/**
 * The publish-time smoke detector (Matěj: „when she is about to post
 * something, it will tell her"). Sits on the native product page — the place
 * she publishes from — and answers the only question publishing has: will a
 * customer be able to buy this? Same data as Produkty+ Rozbalit, so the
 * warning here and the row there can never disagree.
 */
const Inner = ({ productId }: { productId: string }) => {
  const { data } = useQuery<any>({
    queryKey: ["workbench-product", productId],
    queryFn: () => sdk.client.fetch(`/admin/workbench/products/${productId}`),
  });
  if (!data) return null;

  const problems: string[] = [];
  const variants = data.variants ?? [];
  if (!variants.length) problems.push("Produkt nemá žádnou variantu.");
  if (variants.length && variants.every((v: any) => v.price_czk === null))
    problems.push("Žádná varianta nemá cenu v Kč — nejde koupit.");
  if (
    variants.length &&
    variants.every((v: any) => (v.available ?? 0) <= 0) &&
    !data.production?.enabled
  )
    problems.push("Vše je vyprodané a nejde o zakázku — zákazník uvidí jen ‚Vyprodáno'.");

  if (!problems.length) {
    return (
      <Container className="p-4">
        <Badge size="2xsmall" color="green">Zákazník může koupit</Badge>
      </Container>
    );
  }
  return (
    <Container className="flex flex-col gap-y-1.5 p-4">
      <Badge size="2xsmall" color="red" className="self-start">
        Po zveřejnění nepůjde koupit
      </Badge>
      {problems.map((text, i) => (
        <Text key={i} size="xsmall" className="text-ui-fg-error">● {text}</Text>
      ))}
    </Container>
  );
};

const queryClient = new QueryClient();
const Widget = ({ data }: { data: { id: string } }) => (
  <QueryClientProvider client={queryClient}>
    <Inner productId={data.id} />
  </QueryClientProvider>
);
export const config = defineWidgetConfig({ zone: "product.details.side.before" });
export default Widget;
