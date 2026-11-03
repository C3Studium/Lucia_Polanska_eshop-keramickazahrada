import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type { AdminCustomer, DetailWidgetProps } from "@medusajs/framework/types";
import {
  Container,
  Heading,
  Text,
} from "@medusajs/ui";
import {
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { sdk } from "../lib/sdk";
import { adminQueryClient } from "../lib/query-client"
import { CustomerCard } from "../components/customer-card";

/**
 * Context about a person, on their own page (§14, P10-1).
 *
 * Native Medusa already shows their orders, so this adds only what it cannot.
 * Od 3. 11. 2026 je to Karta zákazníka ze Zákazníci+ (hlavní čísla, odznak
 * stálého zákazníka, slevový kód, poznámka, reklamace, kurzy a poukazy) —
 * bez seznamu objednávek, ten nativní stránka má. Plus počet recenzí.
 *
 * ## No new storage
 *
 * The note lives on `customer.metadata` via the native update API. §14 is firm
 * about this — GDPR-wise the admin must not create copies of personal data that
 * outlive the native record, so a „customer notes" table would be a second
 * place to remember to delete from when somebody asks to be forgotten.
 */
const CustomerContextInner = ({ customer }: { customer: AdminCustomer }) => {
  const { data: reviews } = useQuery<{ count: number }>({
    queryKey: ["customer-reviews", customer.id],
    queryFn: () =>
      sdk.client.fetch("/admin/reviews", {
        query: { customer_id: customer.id, limit: 1 },
      }),
  });

  return (
    <Container className="divide-y p-0">
      <header className="px-6 pb-3 pt-4">
        <Heading level="h2">Karta zákazníka</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-1">
          Nákupy, poznámka a slevový kód — jen pro vás, zákazník nic z toho neuvidí.
        </Text>
      </header>

      <div className="px-6 py-4">
        <CustomerCard customerId={customer.id} showOrders={false} />
      </div>

      <div className="px-6 py-4">
        <Text size="small" className="text-ui-fg-subtle">
          Napsané recenze: {reviews?.count ?? 0}
        </Text>
      </div>

    </Container>
  );
};

const queryClient = adminQueryClient;

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
