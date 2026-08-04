import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Tools } from "@medusajs/icons";
import { Container, Heading, Text } from "@medusajs/ui";
import { Link } from "react-router-dom";

const entries = [
  {
    to: "/zakazkova-vyroba/zakazky",
    title: "Zakázky",
    description:
      "Zakázky od zadání přes výrobu až po doplatek — vždy s jedním dalším krokem.",
  },
  {
    to: "/zakazkova-vyroba/produkty",
    title: "Produkty na zakázku",
    description:
      "U kterých produktů si zákazník objednává výrobu na míru, jaká je záloha a jak dlouho výroba trvá.",
  },
];

/**
 * Landing page for the Zakázková výroba section.
 *
 * The sidebar's parent item links here, so it is a signpost rather than a
 * workspace: the actual work happens on Zakázky (P6-1). Counts are deliberately
 * absent until that page owns them — a tile showing a number nobody can act on
 * is noise.
 */
const ZakazkovaVyrobaOverview = () => (
  <Container className="divide-y p-0">
    <header className="px-6 py-5">
      <Heading>Zakázková výroba</Heading>
      <Text size="small" className="text-ui-fg-subtle mt-1 max-w-2xl">
        Kousky, které vyrábíte na míru — zákazník popíše zadání, zaplatí zálohu a
        po dokončení doplatek.
      </Text>
    </header>

    <div className="grid gap-px bg-ui-border-base sm:grid-cols-2">
      {entries.map((entry) => (
        <Link
          key={entry.to}
          to={entry.to}
          className="bg-ui-bg-base hover:bg-ui-bg-base-hover transition-fg flex flex-col gap-y-2 px-6 py-5 outline-none focus-visible:shadow-borders-focus"
        >
          <Heading level="h2">{entry.title}</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {entry.description}
          </Text>
        </Link>
      ))}
    </div>
  </Container>
);

/**
 * Top-level section, deliberately without `nested`.
 *
 * `nested` would place this under a core item, but the dashboard refuses to
 * render children of a route that declares it — and this section needs its two
 * children (§2.2). Same reasoning as Denní práce.
 */
export const config = defineRouteConfig({
  label: "Zakázková výroba",
  icon: Tools,
  rank: 20,
});

export default ZakazkovaVyrobaOverview;
