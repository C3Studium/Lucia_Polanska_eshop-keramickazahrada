import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ListBullet } from "@medusajs/icons";
import { Button, Container, Heading, Text } from "@medusajs/ui";
import { Link } from "react-router-dom";
import { EmptyState } from "../../../components/empty-state";

/**
 * Zakázky — the grouped production queue (§7.2, §22).
 *
 * The queue itself is built by **P6-1**: stage sections stacked, one action per
 * card, on top of a list endpoint that does not exist yet — today
 * `/admin/made-to-order/orders` only serves a single commission by id. Until
 * then the page is its empty state.
 */
const ZakazkyPage = () => (
  <Container className="divide-y p-0">
    <header className="px-6 py-5">
      <Heading>Zakázky</Heading>
      <Text size="small" className="text-ui-fg-subtle mt-1 max-w-2xl">
        Zakázky od zadání přes výrobu až po doplatek — vždy s jedním dalším
        krokem.
      </Text>
    </header>

    <EmptyState
      title="Žádná zakázka"
      description="Zakázka vznikne, když si zákazník objedná produkt označený „Na zakázku“."
      action={
        <Button size="small" variant="secondary" asChild>
          <Link to="/zakazkova-vyroba/produkty">Produkty na zakázku</Link>
        </Button>
      }
    />
  </Container>
);

export const config = defineRouteConfig({
  label: "Zakázky",
  icon: ListBullet,
  rank: 10,
});

export default ZakazkyPage;
