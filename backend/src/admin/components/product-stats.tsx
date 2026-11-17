import { Heading, Text } from "@medusajs/ui";
import { Fragment } from "react";
import { Link } from "react-router-dom";
import { formatDate } from "../lib/format";
import { pieces } from "./empty-state";
import type { ProductPerformance } from "./product-performance-card";

/**
 * „Statistiky" na konci hlavního sloupce detailu výrobku (17. 11. 2026).
 *
 * Lucie: čísla nemají být nahoře — nahoře je jen to, s čím se něco dělá
 * (název, stav, cena, sklad, co chybí). Proto samostatný oddíl dole a místo
 * rozbalovacího seznamu měsíců malý sloupcový graf. Data i řádky jsou tytéž
 * jako v dřívější kartě „Jak se mu daří" (product-performance-card.tsx).
 */

const monthShort = (month: string): string => {
  const [year, index] = month.split("-").map(Number);
  if (!year || !index) return month;
  return new Intl.DateTimeFormat("cs-CZ", { month: "short" }).format(
    new Date(year, index - 1, 1)
  );
};

const monthLong = (month: string): string => {
  const [year, index] = month.split("-").map(Number);
  if (!year || !index) return month;
  return new Intl.DateTimeFormat("cs-CZ", { month: "long", year: "numeric" }).format(
    new Date(year, index - 1, 1)
  );
};

const reviewsWord = (count: number): string =>
  count >= 1 && count <= 4 ? "recenze" : "recenzí";

/**
 * Sloupce po měsících — holé SVG, žádná knihovna. Popisky jsou v HTML pod
 * grafem (stejná mřížka), ať jsou čitelné a nezkreslí je roztažení SVG.
 */
const SalesChart = ({ months }: { months: { month: string; sold: number }[] }) => {
  const max = Math.max(1, ...months.map((month) => month.sold));
  const columns = { gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` };
  const height = 40;
  return (
    <figure className="m-0">
      <div className="grid" style={columns}>
        {months.map((month) => (
          <Text
            key={month.month}
            size="small"
            weight="plus"
            className={`text-center tabular-nums ${month.sold ? "" : "text-ui-fg-muted"}`}
          >
            {month.sold}
          </Text>
        ))}
      </div>
      <svg
        role="img"
        aria-label={`Prodeje po měsících: ${months
          .map((month) => `${monthLong(month.month)} ${pieces(month.sold)}`)
          .join(", ")}`}
        viewBox={`0 0 ${months.length * 10} ${height}`}
        preserveAspectRatio="none"
        className="text-ui-fg-interactive mt-1 block h-24 w-full"
      >
        {months.map((month, index) => {
          // Nulový měsíc = tenká linka, ať je vidět, že tam měsíc je.
          const bar = month.sold ? Math.max(2, (month.sold / max) * height) : 0.6;
          return (
            <rect
              key={month.month}
              x={index * 10 + 2}
              y={height - bar}
              width={6}
              height={bar}
              rx={0.8}
              fill="currentColor"
              opacity={month.sold ? 0.85 : 0.25}
            >
              <title>{`${monthLong(month.month)}: ${pieces(month.sold)}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="border-ui-border-base grid border-t pt-1" style={columns}>
        {months.map((month) => (
          <Text
            key={month.month}
            size="xsmall"
            className="text-ui-fg-subtle text-center"
          >
            {monthShort(month.month)}
          </Text>
        ))}
      </div>
    </figure>
  );
};

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <>
    <Text size="small" className="text-ui-fg-subtle">
      {label}
    </Text>
    <Text size="small" className="tabular-nums">
      {children}
    </Text>
  </>
);

export const ProductStats = ({
  detail,
  wishlistTotal,
  waitingTotal,
}: {
  /** `undefined` = ještě se načítá. */
  detail: ProductPerformance | undefined;
  wishlistTotal: number;
  waitingTotal: number;
}) => {
  if (!detail) {
    return (
      <section className="px-6 py-5">
        <Heading level="h2">Statistiky</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-2">
          Načítám…
        </Text>
      </section>
    );
  }

  const months = detail.sales_by_month ?? [];
  const soldTotal = months.reduce((sum, month) => sum + month.sold, 0);
  const { reviews, memberships } = detail;
  const bundles = memberships.bundles ?? [];
  const selections = memberships.seasonal_selections ?? [];
  const average =
    reviews.average != null
      ? new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 }).format(
          reviews.average
        )
      : null;

  return (
    <section className="px-6 py-5">
      <Heading level="h2">Statistiky</Heading>

      <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div>
          <Text size="small" weight="plus">
            Prodáno za 6 měsíců:{" "}
            {soldTotal ? pieces(soldTotal) : "zatím nic"}
          </Text>
          {months.length > 0 && soldTotal > 0 ? (
            <div className="mt-3">
              <SalesChart months={months} />
            </div>
          ) : (
            <Text size="small" className="text-ui-fg-subtle mt-1">
              Až se kus prodá, ukáže se tu graf po měsících.
            </Text>
          )}
        </div>

        <div className="grid h-fit grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
          <Row label="V oblíbených">
            {wishlistTotal ? `${wishlistTotal}×` : "zatím nikde"}
          </Row>
          {waitingTotal > 0 && (
            <Row label="Čeká na naskladnění">
              {waitingTotal}{" "}
              {waitingTotal === 1 ? "zákazník" : waitingTotal <= 4 ? "zákazníci" : "zákazníků"}
            </Row>
          )}
          <Row label="Hodnocení">
            {reviews.count && average ? (
              <>
                ★ {average}{" "}
                <span className="text-ui-fg-subtle">
                  ({reviews.count} {reviewsWord(reviews.count)})
                </span>
              </>
            ) : (
              "zatím bez recenzí"
            )}
          </Row>
          <Row label="Balíčky a akce">
            {bundles.length || selections.length ? (
              <>
                {bundles.map((bundle, index) => (
                  <Fragment key={bundle.id}>
                    {index > 0 && ", "}
                    balíček{" "}
                    <Link
                      to="/bundled-products"
                      className="text-ui-fg-interactive hover:underline"
                    >
                      {bundle.title}
                    </Link>
                  </Fragment>
                ))}
                {selections.map((selection, index) => (
                  <Fragment key={selection.id}>
                    {(bundles.length > 0 || index > 0) && ", "}
                    akce{" "}
                    <Link
                      to="/sezonni-vybery"
                      className="text-ui-fg-interactive hover:underline"
                    >
                      {selection.title}
                    </Link>
                  </Fragment>
                ))}
              </>
            ) : (
              "není v žádném"
            )}
          </Row>
          {(bundles.length > 0 || selections.length > 0) && (
            <Text size="xsmall" className="text-ui-fg-muted col-span-2">
              Změna ceny se propíše i do balíčku a akce.
            </Text>
          )}
        </div>
      </div>

      {reviews.count > 0 && reviews.latest.length > 0 && (
        <details className="mt-4">
          <summary className="text-ui-fg-subtle txt-small min-h-[40px] cursor-pointer py-2">
            Poslední recenze
          </summary>
          <div className="mt-1 flex flex-col gap-3">
            {reviews.latest.map((review, index) => (
              <div key={index}>
                <div className="flex items-center justify-between gap-2">
                  <Text size="small" weight="plus">
                    {"★".repeat(Math.max(1, Math.round(review.rating)))}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {formatDate(review.created_at)}
                  </Text>
                </div>
                <Text size="small" className="text-ui-fg-subtle mt-0.5">
                  {review.content.length > 160
                    ? `${review.content.slice(0, 160)}…`
                    : review.content}
                </Text>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
};
