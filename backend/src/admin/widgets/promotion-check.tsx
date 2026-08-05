import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Badge, Container, Text } from "@medusajs/ui";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { sdk } from "../lib/sdk";

/**
 * Guardian on the promotion page — the three mistakes a discount invites:
 * left as a draft (nobody sees it), automatic with no rules (EVERYTHING is
 * discounted), or a percentage at/over 100 (giving goods away).
 */
const Inner = ({ id }: { id: string }) => {
  const { data } = useQuery<any>({
    queryKey: ["promotion-check", id],
    queryFn: () =>
      sdk.client.fetch(`/admin/promotions/${id}?fields=*application_method,*rules`),
    refetchOnWindowFocus: true,
  });
  const promotion = data?.promotion;
  if (!promotion) return null;

  const problems: string[] = [];
  if (promotion.status !== "active")
    problems.push("Sleva je vypnutá (koncept) — zákazníci ji nevidí a kód nefunguje.");
  if (promotion.is_automatic && !(promotion.rules ?? []).length)
    problems.push("Automatická sleva bez pravidel platí na ÚPLNĚ VŠECHNO v obchodě.");
  const method = promotion.application_method;
  if (method?.type === "percentage" && Number(method.value) >= 100)
    problems.push("Sleva 100 % — zboží by bylo zadarmo.");

  if (!problems.length) return null;
  return (
    <Container className="flex flex-col gap-y-1.5 p-4">
      <Badge size="2xsmall" color="orange" className="self-start">Zkontrolujte</Badge>
      {problems.map((text, i) => (
        <Text key={i} size="xsmall" className="text-ui-fg-error">● {text}</Text>
      ))}
    </Container>
  );
};

const queryClient = new QueryClient();
const Widget = ({ data }: { data: { id: string } }) => (
  <QueryClientProvider client={queryClient}><Inner id={data.id} /></QueryClientProvider>
);
export const config = defineWidgetConfig({ zone: "promotion.details.side.before" });
export default Widget;
