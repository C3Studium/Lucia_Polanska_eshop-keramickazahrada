import { Button, Container, Heading, Text } from "@medusajs/ui";
import { Link } from "react-router-dom";
import { EmptyState } from "../../../components/empty-state";
import { WorkTabs } from "../../../components/work-tabs";

/**
 * Zakázky — the grouped production queue (§7.2, §22), now a tab of Přehled.
 *
 * It sits with the order queues because it is the same kind of thing: work
 * waiting for her today. Setting up *which products* are made to order is
 * configuration, not work, so that stayed behind under Produkty na zakázku.
 *
 * The queue itself is built by **P6-1** on top of a list endpoint that does not
 * exist yet — today `/admin/made-to-order/orders` only serves a single
 * commission by id. Until then the page is its empty state.
 */
const ZakazkyPage = () => (
  <Container className="p-0">
    <WorkTabs active="zakazky" />

    <header className="px-6 pb-1 pt-5">
      <Heading>Zakázky</Heading>
      <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
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

export default ZakazkyPage;
