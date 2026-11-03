import { Heading, Text } from "@medusajs/ui";
import { Fragment } from "react";
import { Link } from "react-router-dom";
import { formatDate } from "../lib/format";
import { pieces } from "./empty-state";

/**
 * „Jak se mu daří" — prodeje, oblíbené, hodnocení a zapojení jedné karty
 * v pravém sloupci detailu produktu (Matěj, 3. 11. 2026: „udělej to více
 * srozumitelné"). Dřív to byly tři oddíly pod sebou na konci stránky;
 * teď nahoře čísla jednou větou, podrobnosti (měsíce, texty recenzí) se
 * rozbalí. Data jsou tatáž (GET /admin/workbench/products/:id).
 */
export type ProductPerformance = {
  sales_by_month: { month: string; sold: number }[];
  reviews: {
    count: number;
    average: number | null;
    latest: { rating: number; title: string | null; content: string; created_at: string }[];
  };
  memberships: {
    bundles: { id: string; title: string }[];
    seasonal_selections: { id: string; title: string; status: string }[];
  };
};

const monthLabel = (month: string): string => {
  const [year, index] = month.split("-").map(Number);
  if (!year || !index) return month;
  return new Intl.DateTimeFormat("cs-CZ", { month: "long" }).format(
    new Date(year, index - 1, 1)
  );
};

const reviewsWord = (count: number): string =>
  count >= 1 && count <= 4 ? "recenze" : "recenzí";

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

export const ProductPerformanceCard = ({
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
        <Heading level="h2">Jak se mu daří</Heading>
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
      <Heading level="h2">Jak se mu daří</Heading>
      <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5">
        <Row label="Prodáno za 6 měsíců">
          {soldTotal ? <strong>{pieces(soldTotal)}</strong> : "zatím nic"}
        </Row>
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
      </div>
      {(bundles.length > 0 || selections.length > 0) && (
        <Text size="xsmall" className="text-ui-fg-muted mt-1">
          Změna ceny se propíše i do balíčku a akce.
        </Text>
      )}

      {soldTotal > 0 && (
        <details className="mt-3">
          <summary className="text-ui-fg-subtle txt-small cursor-pointer">
            Prodeje po měsících
          </summary>
          <div className="mt-2 flex flex-col gap-1">
            {months.map((month) => (
              <div key={month.month} className="flex items-center justify-between gap-2">
                <Text size="small" className="text-ui-fg-subtle capitalize">
                  {monthLabel(month.month)}
                </Text>
                <Text size="small" className="tabular-nums">
                  {month.sold ? pieces(month.sold) : "—"}
                </Text>
              </div>
            ))}
          </div>
        </details>
      )}

      {reviews.count > 0 && reviews.latest.length > 0 && (
        <details className="mt-2">
          <summary className="text-ui-fg-subtle txt-small cursor-pointer">
            Poslední recenze
          </summary>
          <div className="mt-2 flex flex-col gap-3">
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
