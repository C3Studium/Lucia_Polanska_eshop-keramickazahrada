import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ListBullet } from "@medusajs/icons";
import { Button, Container, Heading, Text } from "@medusajs/ui";
import { Link } from "react-router-dom";

/**
 * Zakázky — the grouped production queue (§7.2, §22).
 *
 * P1-2 puts the route in place so the section has its children; **P6-1 builds
 * the queue itself** (stage sections stacked, one action per card) on top of a
 * list endpoint that does not exist yet — `/admin/made-to-order/orders` today
 * only serves a single commission by id.
 *
 * Until then this renders the §19 explanatory text *without* claiming the queue
 * is empty: there is no way to know that here, and a page that says „Žádná
 * zakázka" over real commissions would be a lie.
 */
const ZakazkyPage = () => (
  <Container className="divide-y p-0">
    <header className="px-6 py-5">
      <Heading>Zakázky</Heading>
      <Text size="small" className="text-ui-fg-subtle mt-1 max-w-2xl">
        Zakázka vznikne, když si zákazník objedná produkt označený „Na zakázku".
        Uvidíte tu zadání, termín výroby i to, kolik zbývá doplatit.
      </Text>
    </header>

    <div className="flex flex-col items-start gap-y-3 px-6 py-8">
      <Text size="small" className="text-ui-fg-subtle max-w-2xl">
        Které produkty se vyrábějí na zakázku, nastavíte u produktů.
      </Text>
      <Button size="small" variant="secondary" asChild>
        <Link to="/zakazkova-vyroba/produkty">Produkty na zakázku</Link>
      </Button>
    </div>
  </Container>
);

export const config = defineRouteConfig({
  label: "Zakázky",
  icon: ListBullet,
  rank: 10,
});

export default ZakazkyPage;
