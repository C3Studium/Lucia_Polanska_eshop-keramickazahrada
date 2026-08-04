import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ExclamationCircle } from "@medusajs/icons";
import { Button, Container, Heading, Skeleton, Text } from "@medusajs/ui";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { EmptyState, pieces } from "../../components/empty-state";
import { sdk } from "../../lib/sdk";

type MerchantSettingsResponse = {
  settings: { low_stock_default_threshold: number };
};

/**
 * Nízký stav (§10, §22).
 *
 * The list itself arrives with **P7-1**, which adds the
 * `/admin/inventory-alerts?type=low` endpoint, the threshold merge (global
 * setting vs. per-item override) and the „Hranice upozornění" drawer. Until
 * then the page is the empty state — correct today, because nothing can yet
 * appear in a list that has no source.
 *
 * The threshold is read rather than hardcoded so the sentence stays true when
 * P7-1 makes it editable.
 */
const NizkyStavInner = () => {
  const { data, isLoading } = useQuery<MerchantSettingsResponse>({
    queryKey: ["merchant-settings"],
    queryFn: () => sdk.client.fetch("/admin/merchant-settings"),
  });

  const threshold = data?.settings?.low_stock_default_threshold;

  return (
    <Container className="divide-y p-0">
      <header className="px-6 py-5">
        <Heading>Nízký stav</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-1 max-w-2xl">
          Kousky, kterých už zbývá málo — ať stihnete dopéct dřív, než dojdou
          úplně.
        </Text>
      </header>

      {isLoading ? (
        <div className="px-6 py-10">
          <Skeleton className="h-24 rounded-lg" />
        </div>
      ) : (
        <EmptyState
          title="Zásoby jsou v pořádku"
          description={
            threshold !== undefined
              ? `Upozorníme vás, když něčeho zbude ${pieces(threshold)} nebo méně.`
              : "Upozorníme vás, když něčeho začne ubývat."
          }
          action={
            <Button size="small" variant="secondary" asChild>
              <Link to="/inventory">Otevřít sklad</Link>
            </Button>
          }
        />
      )}
    </Container>
  );
};

const queryClient = new QueryClient();

const NizkyStavPage = () => (
  <QueryClientProvider client={queryClient}>
    <NizkyStavInner />
  </QueryClientProvider>
);

export const config = defineRouteConfig({
  label: "Nízký stav",
  icon: ExclamationCircle,
  nested: "/inventory",
  rank: 10,
});

export default NizkyStavPage;
