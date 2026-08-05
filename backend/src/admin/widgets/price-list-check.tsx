import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Badge, Container, Text } from "@medusajs/ui";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { sdk } from "../lib/sdk";

/** Guardian on the price list: paused, expired, or empty — all three look
 * "done" in the UI while changing no price at all. */
const Inner = ({ id }: { id: string }) => {
  const { data } = useQuery<any>({
    queryKey: ["price-list-check", id],
    queryFn: () => sdk.client.fetch(`/admin/price-lists/${id}?fields=*prices`),
    refetchOnWindowFocus: true,
  });
  const list = data?.price_list;
  if (!list) return null;

  const problems: string[] = [];
  if (list.status !== "active")
    problems.push("Ceník je pozastavený — ceny v něm zatím neplatí.");
  if (list.ends_at && new Date(list.ends_at).getTime() < Date.now())
    problems.push("Ceník už skončil — ceny se vrátily na běžné.");
  if (!(list.prices ?? []).length)
    problems.push("Ceník je prázdný — žádný produkt v něm nemá cenu.");

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
export const config = defineWidgetConfig({ zone: "price_list.details.side.before" });
export default Widget;
