import { defineRouteConfig } from "@medusajs/admin-sdk";
import { XCircle } from "@medusajs/icons";
import { Button, Container, Heading, Text } from "@medusajs/ui";
import { Link } from "react-router-dom";

/**
 * Vyprodáno (§10, §22).
 *
 * Route registered by P1-3; **P7-1 fills it** with
 * `/admin/inventory-alerts?type=out`, which also excludes made-to-order
 * variants and anything that does not track stock at all. Same reasoning as
 * Nízký stav: no data yet means no claim about being sold out or not.
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

    <div className="flex flex-col items-start gap-y-3 px-6 py-8">
      <Text size="small" className="text-ui-fg-subtle max-w-2xl">
        Počty kusů upravíte ve skladu.
      </Text>
      <Button size="small" variant="secondary" asChild>
        <Link to="/inventory">Otevřít sklad</Link>
      </Button>
    </div>
  </Container>
);

export const config = defineRouteConfig({
  label: "Vyprodáno",
  icon: XCircle,
  nested: "/inventory",
  rank: 20,
});

export default VyprodanoPage;
