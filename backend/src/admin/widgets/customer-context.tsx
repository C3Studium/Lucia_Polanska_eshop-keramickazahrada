import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type { AdminCustomer, DetailWidgetProps } from "@medusajs/framework/types";
import {
  Button,
  Container,
  Heading,
  Text,
  Textarea,
  Toaster,
  toast,
} from "@medusajs/ui";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import { useState } from "react";
import { sdk } from "../lib/sdk";

/**
 * Context about a person, on their own page (§14, P10-1).
 *
 * Native Medusa already shows their orders, so this adds only what it cannot:
 * a note she can keep, and how many reviews they have written.
 *
 * ## No new storage
 *
 * The note lives on `customer.metadata` via the native update API. §14 is firm
 * about this — GDPR-wise the admin must not create copies of personal data that
 * outlive the native record, so a „customer notes" table would be a second
 * place to remember to delete from when somebody asks to be forgotten.
 */
const CustomerContextInner = ({ customer }: { customer: AdminCustomer }) => {
  const initial =
    ((customer.metadata as Record<string, unknown> | null)?.note as string) ??
    "";
  const [note, setNote] = useState(initial);

  const { data: reviews } = useQuery<{ count: number }>({
    queryKey: ["customer-reviews", customer.id],
    queryFn: () =>
      sdk.client.fetch("/admin/reviews", {
        query: { customer_id: customer.id, limit: 1 },
      }),
  });

  const save = useMutation({
    mutationFn: () =>
      sdk.admin.customer.update(customer.id, {
        metadata: { ...(customer.metadata ?? {}), note },
      }),
    onSuccess: () => toast.success("Poznámka byla uložena"),
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Poznámku se nepodařilo uložit"
      ),
  });

  return (
    <Container className="divide-y p-0">
      <header className="px-6 pb-3 pt-4">
        <Heading level="h2">Poznámka</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-1">
          Jen pro vás — zákazník ji nikdy neuvidí.
        </Text>
      </header>

      <div className="flex flex-col gap-y-2 px-6 py-4">
        <Textarea
          rows={3}
          value={note}
          placeholder="Např. sbírá modrou sérii, chce vždy zabalit jako dárek…"
          onChange={(event) => setNote(event.target.value)}
        />
        <div className="flex items-center gap-2">
          <Button
            size="small"
            isLoading={save.isPending}
            disabled={note === initial}
            onClick={() => save.mutate()}
          >
            Uložit
          </Button>
          {customer.email && (
            <Button size="small" variant="secondary" asChild>
              <a href={`mailto:${customer.email}`}>Napsat zákazníkovi</a>
            </Button>
          )}
        </div>
      </div>

      <div className="px-6 py-4">
        <Text size="small" className="text-ui-fg-subtle">
          Napsané recenze: {reviews?.count ?? 0}
        </Text>
      </div>

      <Toaster />
    </Container>
  );
};

const queryClient = new QueryClient();

const CustomerContextWidget = ({ data }: DetailWidgetProps<AdminCustomer>) => (
  <QueryClientProvider client={queryClient}>
    <CustomerContextInner customer={data} />
  </QueryClientProvider>
);

export const config = defineWidgetConfig({
  zone: "customer.details.side.after",
  id: "keramicka-zahrada:customer-context",
});

export default CustomerContextWidget;
