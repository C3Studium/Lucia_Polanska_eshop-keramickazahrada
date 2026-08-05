import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Badge, Container, Text } from "@medusajs/ui";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { sdk } from "../lib/sdk";

/** Guardian on the campaign: an exhausted budget or a past end date means
 * its discounts silently stopped applying. */
const Inner = ({ id }: { id: string }) => {
  const { data } = useQuery<any>({
    queryKey: ["campaign-check", id],
    queryFn: () => sdk.client.fetch(`/admin/campaigns/${id}?fields=*budget`),
    refetchOnWindowFocus: true,
  });
  const campaign = data?.campaign;
  if (!campaign) return null;

  const problems: string[] = [];
  const budget = campaign.budget;
  if (budget?.limit != null && Number(budget.used ?? 0) >= Number(budget.limit))
    problems.push("Rozpočet kampaně je vyčerpaný — její slevy už neplatí.");
  if (campaign.ends_at && new Date(campaign.ends_at).getTime() < Date.now())
    problems.push("Kampaň už skončila.");

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
export const config = defineWidgetConfig({ zone: "campaign.details.side.before" });
export default Widget;
