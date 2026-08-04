import { defineRouteConfig } from "@medusajs/admin-sdk";
import { XCircle } from "@medusajs/icons";
import { Button, Container, Heading, Text } from "@medusajs/ui";
import { Link } from "react-router-dom";
import { EmptyState } from "../../components/empty-state";

/**
 * Vyprodáno (§10, §22).
 *
 * The list arrives with **P7-1** (`/admin/inventory-alerts?type=out`), which
 * also excludes made-to-order variants and anything that does not track stock.
 * Until then the page is its empty state.
 */
const VyprodanoPage = () => (
  <Container className="divide-y p-0">
    <header className="px-6 py-5">
      <Heading>Vyprodáno</Heading>
      <Text size="small" className="text-ui-fg-subtle mt-1 max-w-2xl">
        Kousky, které došly úplně. Zákazníci si je nemohou objednat, dokud
        nepřidáte nové.
      </Text>
    </header>

    <EmptyState
      title="Nic není vyprodané"
      description="Jakmile něčeho zbude nula kusů, objeví se to tady."
      action={
        <Button size="small" variant="secondary" asChild>
          <Link to="/inventory">Otevřít sklad</Link>
        </Button>
      }
    />
  </Container>
);

export const config = defineRouteConfig({
  label: "Vyprodáno",
  icon: XCircle,
  nested: "/inventory",
  rank: 20,
});

export default VyprodanoPage;
