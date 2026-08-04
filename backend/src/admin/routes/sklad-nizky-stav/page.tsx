import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ExclamationCircle } from "@medusajs/icons";
import { Button, Container, Heading, Text } from "@medusajs/ui";
import { Link } from "react-router-dom";

/**
 * Nízký stav (§10, §22).
 *
 * P1-3 registers the route under Sklad; **P7-1 fills it** with the
 * `/admin/inventory-alerts?type=low` read endpoint, the threshold merge
 * (global setting vs. per-item override) and the „Hranice upozornění" drawer.
 *
 * Until that endpoint exists this page cannot know whether anything is running
 * low, so it does not say „Zásoby jsou v pořádku" — a false all-clear on a
 * stock page is exactly the mistake this section is meant to prevent.
 */
const NizkyStavPage = () => (
  <Container className="divide-y p-0">
    <header className="px-6 py-5">
      <Heading>Nízký stav</Heading>
      <Text size="small" className="text-ui-fg-subtle mt-1 max-w-2xl">
        Kousky, kterých už zbývá málo — ať stihnete dopéct dřív, než dojdou
        úplně.
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
  label: "Nízký stav",
  icon: ExclamationCircle,
  nested: "/inventory",
  rank: 10,
});

export default NizkyStavPage;
