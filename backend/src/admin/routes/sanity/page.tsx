import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Sanity } from "@medusajs/icons";
import {
  Badge,
  Button,
  Container,
  Heading,
  Table,
  Text,
  Toaster,
  toast,
} from "@medusajs/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { formatDateTime } from "../../lib/format";
import { useSanitySyncs, useTriggerSanitySync } from "../../hooks/sanity";

/**
 * Obsah webu — the Sanity sync log, in her words.
 *
 * Products copy themselves to the CMS the storefront reads; this page exists
 * for the one afternoon a change doesn't show up on the web. One button
 * re-runs the copy, the table says whether the last runs went through.
 */

const queryClientProvider = new QueryClient()

/** Sync-run states in Czech; unknown states fall back to the raw word. */
const STATE_BADGES: Record<string, { label: string; color: "blue" | "green" | "red" | "grey" }> = {
  invoking: { label: "probíhá", color: "blue" },
  done: { label: "hotovo", color: "green" },
  failed: { label: "selhalo", color: "red" },
};

const SanityRouteInner = () => {
  const { mutateAsync, isPending } = useTriggerSanitySync();
  const { workflow_executions, studio_url, refetch } = useSanitySyncs();

  const handleSync = async () => {
    try {
      await mutateAsync();
      toast.success("Přenos běží — za chvíli se objeví v tabulce.");
      refetch();
    } catch (err) {
      toast.error(`Přenos se nepodařilo spustit: ${
        (err as Record<string, unknown>).message
      }`);
    }
  };

  return (
    <Container className="flex flex-col p-0 overflow-hidden">
      <div className="p-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Heading>Obsah webu</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
            Produkty se na web přepisují samy. Když se změna na webu neukáže,
            spusťte přenos tlačítkem — tabulka ukazuje, jak poslední přenosy
            dopadly.
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="small"
            onClick={handleSync}
            disabled={isPending}
          >
            Přenést znovu
          </Button>
          {/* The Studio lives on the storefront — the server says where. */}
          {studio_url && (
            <a href={studio_url} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" size="small">
                Otevřít úpravy obsahu
              </Button>
            </a>
          )}
        </div>
      </div>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Stav</Table.HeaderCell>
            <Table.HeaderCell>Spuštěno</Table.HeaderCell>
            <Table.HeaderCell>Poslední změna</Table.HeaderCell>
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {(workflow_executions || []).map((execution) => {
            const badge = STATE_BADGES[execution.state] ?? {
              label: execution.state,
              color: "grey" as const,
            };
            return (
              <Table.Row key={execution.id}>
                <Table.Cell>
                  <Badge rounded="full" size="2xsmall" color={badge.color}>
                    {badge.label}
                  </Badge>
                </Table.Cell>
                <Table.Cell>{formatDateTime(execution.created_at)}</Table.Cell>
                <Table.Cell>{formatDateTime(execution.updated_at)}</Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table>
      {!(workflow_executions || []).length && (
        <div className="px-6 py-8 text-center">
          <Text size="small" className="text-ui-fg-subtle">
            Zatím žádný přenos neproběhl. Spustí se sám při změně produktu,
            nebo ho spusťte tlačítkem nahoře.
          </Text>
        </div>
      )}
    </Container>
  );
};

const SanityRoute = () => (
  <QueryClientProvider client={queryClientProvider}>
    <SanityRouteInner />
    <Toaster />
  </QueryClientProvider>
)

export const config = defineRouteConfig({
  label: "Obsah webu",
  icon: Sanity,
  rank: 120,
});

export default SanityRoute;
