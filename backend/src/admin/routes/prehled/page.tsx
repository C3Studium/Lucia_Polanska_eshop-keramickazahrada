import ChybejiciDokumenty from "../../components/chybejici-dokumenty";
import OsireleUcty from "../../components/osirele-ucty";
import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ArrowPath, House } from "@medusajs/icons";
import {
  Badge,
  Button,
  Container,
  DropdownMenu,
  Heading,
  Skeleton,
  Text,
  clx,
} from "@medusajs/ui";
import {
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  OrderRow,
  type MerchantOrder,
} from "../../components/merchant-order-queue";
import { WorkTabs } from "../../components/work-tabs";
import { StorefrontBridgeButton } from "../../components/storefront-bridge-button";
import { formatAmount, formatDate } from "../../lib/format";
import { sdk } from "../../lib/sdk";
import { adminQueryClient } from "../../lib/query-client"

type EndingSoon = {
  type: "price_list" | "seasonal_selection";
  title: string;
  ends_at: string;
};

type OperationsSummary = {
  generated_at: string;
  attention: {
    payment_problems: number;
    failed_emails: number;
    carrier_failures: number;
    overdue_production: number;
    window_days: number;
  };
  today: {
    new_orders: number;
    working: number;
    shipping: number;
    shipping_oldest_days: number | null;
    awaiting_balance: {
      count: number;
      outstanding_amount: number;
      currency_code: string;
      oldest_request_days: number | null;
    };
    in_production: { count: number; nearest_deadline: string | null };
  };
  shop: {
    low_stock: number;
    sold_out: number;
    low_stock_threshold: number;
    pending_reviews: number;
    ending_soon: EndingSoon[];
    active_sales: number;
    active_selections: number;
    discount_codes: number;
    automatic_discounts: number;
  };
  /**
   * „Čeká na vás" (3. 11. 2026). Volitelné: backend před restartem pole ještě
   * neposílá a stránka se kvůli tomu nesmí rozbít.
   */
  waiting?: Waiting;
  next_up: MerchantOrder[];
};

type ParcelIssue = {
  order_id: string;
  display_id: number | string | null;
  parcel_code: string | null;
  kind: "returned" | "problem" | "stored";
  days: number | null;
  text: string | null;
};

type Waiting = {
  commissions_to_confirm: number;
  claims: {
    new: number;
    received: number;
    overdue: number;
    overdue_first: { id: string; status: string } | null;
  };
  courses: { seat_requests: number; cancel_requests: number };
  parcels: ParcelIssue[];
  parcels_total: number;
  order_changes: {
    order_id: string;
    display_id: number | string | null;
    requested_at: string | null;
  }[];
  order_changes_total: number;
  order_change_window_days: number;
  stored_parcel_days: number;
};

/**
 * Jak se skládá „Na řadě" (rozbalovačka nad seznamem). Hodnoty zrcadlí
 * `api/admin/operations/summary`, který řadí i vybírá — v Přehledu je vidět
 * jen pět řádků, takže nad nimi by se řadit nedalo.
 */
type Razeni = "oldest" | "newest";
type Vyber =
  | "all"
  | "commissions"
  | "payment_problem"
  | "received"
  | "shipping";

const razeniLabel: Record<Razeni, string> = {
  oldest: "Nejdéle čekající",
  newest: "Od nejnovější",
};

const vyberLabel: Record<Vyber, string> = {
  all: "Všechno, co čeká",
  commissions: "Jen zakázky na míru",
  payment_problem: "Jen potíže s platbou",
  received: "Jen nové objednávky",
  shipping: "Jen k odeslání",
};

const razeniPopis: Record<Razeni, string> = {
  oldest: "Nejdéle čekající objednávky, u kterých je na tahu někdo z vás.",
  newest: "Od té, se kterou se hýbalo naposledy — a pořád na někoho čeká.",
};

type Tone = "default" | "warning" | "critical";

type Tile = {
  key: string;
  label: string;
  value: string;
  /** Shown under the value: an empty-state sentence or a warning. */
  hint?: string;
  tone?: Tone;
  to: string;
  cta: string;
};

const toneClass: Record<Tone, string> = {
  default: "",
  warning: "text-ui-fg-subtle",
  critical: "text-ui-fg-error",
};

const TileCard = ({ tile }: { tile: Tile }) => (
  <Link
    to={tile.to}
    className="bg-ui-bg-base hover:bg-ui-bg-base-hover transition-fg flex min-h-[8.5rem] flex-col px-6 py-6 outline-none focus-visible:shadow-borders-focus"
  >
    <Text size="small" className="text-ui-fg-subtle">
      {tile.label}
    </Text>
    <Heading
      level="h2"
      className={clx("mt-2 text-2xl leading-tight", toneClass[tile.tone ?? "default"])}
    >
      {tile.value}
    </Heading>
    {tile.hint && (
      <Text
        size="small"
        className={clx(
          "mt-1.5",
          tile.tone === "critical" ? "text-ui-fg-error" : "text-ui-fg-subtle"
        )}
      >
        {tile.hint}
      </Text>
    )}
    {/* Pushed to the bottom so every card's action sits on the same line,
        however much text is above it. */}
    <Text size="small" className="text-ui-fg-interactive mt-auto pt-3">
      {tile.cta}
    </Text>
  </Link>
);

const Zone = ({
  title,
  description,
  tiles,
}: {
  title: string;
  description?: string;
  tiles: Tile[];
}) => {
  if (!tiles.length) {
    return null;
  }
  return (
    <section className="pt-2">
      <header className="flex flex-col gap-y-1 px-6 pb-4 pt-6">
        <Heading level="h2">{title}</Heading>
        {description && (
          <Text size="small" className="text-ui-fg-subtle max-w-2xl">
            {description}
          </Text>
        )}
      </header>
      {/*
        `auto-fit` místo pevných tří sloupců: dlaždice se roztáhnou a vyplní
        řádek. S `lg:grid-cols-3` zůstávalo po čtyřech dlaždicích prázdné
        místo, kterým prosvítalo pozadí mřížky — na obrazovce to vypadalo
        jako dvě šedé rozbité buňky.
      */}
      <div className="grid gap-px bg-ui-border-base grid-cols-[repeat(auto-fit,minmax(15rem,1fr))]">
        {tiles.map((tile) => (
          <TileCard key={tile.key} tile={tile} />
        ))}
      </div>
    </section>
  );
};

/** „1 věc / 2 věci / 5 věcí" — česky, protože „5 věci" vypadá jako chyba. */
const veci = (count: number): string =>
  count === 1 ? "1 věc" : count < 5 ? `${count} věci` : `${count} věcí`;

/** Pozdrav podle denní doby — admin se otevírá ráno a večer stejně často. */
const pozdrav = (now: Date): string => {
  const hodina = now.getHours();
  if (hodina < 10) return "Dobré ráno";
  if (hodina < 18) return "Dobrý den";
  return "Dobrý večer";
};

/**
 * Štítek pro jednu věc, která hoří.
 *
 * Dlaždice o tomtéž dřív stála vedle „Vyprodáno 3" a byla stejně hlasitá.
 * Štítek je menší než dlaždice schválně: je jich málo, nesou jedno číslo
 * a jedno sloveso, a vedou tam, kde se s tím něco dělá.
 */
const Stitek = ({ tile }: { tile: Tile }) => (
  <Link to={tile.to} className="outline-none focus-visible:shadow-borders-focus rounded-full">
    <Badge
      size="small"
      color={tile.tone === "critical" ? "red" : tile.tone === "warning" ? "orange" : "grey"}
    >
      {tile.value} {tile.label.toLowerCase()}
    </Badge>
  </Link>
);

/**
 * Obchod jako jeden řádek štítků (§4).
 *
 * Zásoby, recenze a akce jsou týdenní starost, ne ranní. Jako dlaždice
 * křičely stejně hlasitě jako dnešní práce — a protože čísla u zásob bývají
 * velká („Vyprodáno 126"), křičely dokonce víc. Řádek drží tutéž informaci
 * i tytéž odkazy, jen jim bere velikost.
 */
const ObchodRadek = ({ tiles }: { tiles: Tile[] }) => {
  if (!tiles.length) {
    return null;
  }
  return (
    <section className="flex flex-wrap items-center gap-2 px-6 py-4">
      <Text size="small" className="text-ui-fg-subtle mr-1">
        Obchod
      </Text>
      {tiles.map((tile) => (
        <Link
          key={tile.key}
          to={tile.to}
          className="text-ui-fg-subtle hover:text-ui-fg-base txt-small border-ui-border-base hover:bg-ui-bg-base-hover transition-fg rounded-md border px-2.5 py-1 outline-none focus-visible:shadow-borders-focus"
        >
          <span className="text-ui-fg-base font-medium">{tile.value}</span>{" "}
          {tile.label.toLowerCase()}
        </Link>
      ))}
    </section>
  );
};

/**
 * Tiles that only exist when something is wrong (§4 zone 1). An empty
 * „Vyžaduje pozornost" section is not reassurance, it is clutter — so the whole
 * zone disappears rather than showing four zeroes.
 */
const attentionTiles = (summary: OperationsSummary): Tile[] => {
  const tiles: Tile[] = [];
  const { attention } = summary;

  if (attention.payment_problems > 0) {
    tiles.push({
      key: "payment-problems",
      label: "Problémy s platbou",
      value: String(attention.payment_problems),
      tone: "critical",
      hint: "Platba nedorazila nebo se nezdařila.",
      to: "/prehled/prace?krok=problem-s-platbou",
      cta: "Vyřešit",
    });
  }

  if (attention.failed_emails > 0) {
    tiles.push({
      key: "failed-emails",
      label: "Nezdařené e-maily",
      value: String(attention.failed_emails),
      tone: "critical",
      hint: `Za posledních ${attention.window_days} dní se nepodařilo odeslat.`,
      to: "/prehled/emaily",
      cta: "Zobrazit a poslat znovu",
    });
  }

  if (attention.carrier_failures > 0) {
    tiles.push({
      key: "carrier-failures",
      label: "Zásilky se nepodařilo vytvořit",
      value: String(attention.carrier_failures),
      tone: "critical",
      hint: "Zkuste vytvoření zásilky znovu.",
      to: "/prehled/prace?krok=k-odeslani",
      cta: "Zkusit znovu",
    });
  }

  if (attention.overdue_production > 0) {
    tiles.push({
      key: "overdue-production",
      label: "Zpožděné zakázky",
      value: String(attention.overdue_production),
      tone: "critical",
      hint: "Slíbený termín už uplynul.",
      to: "/prehled/zakazky",
      cta: "Zobrazit zakázky",
    });
  }

  const waiting = summary.waiting;
  if (waiting) {
    // Lhůta na vyřízení je ze zákona — po ní to hoří, ne „čeká".
    const overdue = waiting.claims.overdue;
    if (overdue > 0) {
      const first = waiting.claims.overdue_first;
      tiles.push({
        key: "claims-overdue",
        label: tvar(overdue, "Reklamace po lhůtě", "Reklamace po lhůtě", "Reklamací po lhůtě"),
        value: String(overdue),
        tone: "critical",
        hint: "Uplynula lhůta na vyřízení.",
        to:
          overdue === 1 && first
            ? `/reklamace/${encodeURIComponent(first.id)}`
            : `/reklamace?status=${first?.status ?? "pending"}`,
        cta: "Vyřídit",
      });
    }

    // Zásilky s potíží jednotlivě — bývá jich málo a každá vede na svou
    // objednávku. Dlouho uložené jsou v „Čeká na vás", tady jen to zlé.
    for (const parcel of waiting.parcels) {
      if (parcel.kind === "stored") continue;
      tiles.push({
        key: `parcel-${parcel.order_id}`,
        label: parcel.kind === "returned" ? "se vrací zpět" : "— pošta hlásí problém",
        value: `Zásilka #${parcel.display_id ?? "?"}`,
        tone: parcel.kind === "returned" ? "critical" : "warning",
        hint: parcel.text ?? undefined,
        to: `/orders/${parcel.order_id}`,
        cta: "Otevřít objednávku",
      });
    }
  }

  return tiles;
};

/**
 * „1 žádost / 2 žádosti / 5 žádostí" — tři tvary podle čísla. Každý štítek
 * nese svoje, protože čeština se jedním pravidlem skloňovat nedá.
 */
const tvar = (count: number, one: string, few: string, many: string): string =>
  count === 1 ? one : count >= 2 && count <= 4 ? few : many;

/**
 * „Čeká na vás" — žádosti a rozhodnutí, kde je na tahu ona (3. 11. 2026).
 *
 * Jen nenulové, každý štítek vede rovnou na seznam (nebo objednávku), kde se
 * to vyřeší. Co hoří (po lhůtě, vrácená zásilka), je nahoře v hlavičce,
 * ne tady — jedna věc se nesmí objevit dvakrát.
 */
const waitingTiles = (
  waiting: Waiting | undefined,
  newInquiries: number
): Tile[] => {
  const tiles: Tile[] = [];

  if (newInquiries > 0) {
    tiles.push({
      key: "inquiries",
      value: String(newInquiries),
      label: tvar(
        newInquiries,
        "nová poptávka zakázky",
        "nové poptávky zakázek",
        "nových poptávek zakázek"
      ),
      hint: "Zákazník popsal, co by chtěl — pošlete mu nabídku.",
      to: "/zakazkova-vyroba/poptavky",
      cta: "Otevřít",
    });
  }

  if (!waiting) {
    return tiles;
  }

  const { claims, courses } = waiting;

  if (waiting.commissions_to_confirm > 0) {
    const count = waiting.commissions_to_confirm;
    tiles.push({
      key: "commissions-to-confirm",
      value: String(count),
      label: tvar(
        count,
        "zakázka čeká na potvrzení zadání nebo ceny",
        "zakázky čekají na potvrzení zadání nebo ceny",
        "zakázek čeká na potvrzení zadání nebo ceny"
      ),
      hint: "Přečtěte si zadání a potvrďte ho, u ceny po domluvě pošlete cenu.",
      to: "/prehled/zakazky",
      cta: "Otevřít",
    });
  }

  if (claims.new > 0) {
    tiles.push({
      key: "claims-new",
      value: String(claims.new),
      label: tvar(
        claims.new,
        "nová reklamace nebo vrácení",
        "nové reklamace nebo vrácení",
        "nových reklamací nebo vrácení"
      ),
      hint: "Rozhodněte, jestli žádost schválíte.",
      to: "/reklamace?status=pending",
      cta: "Otevřít",
    });
  }

  if (claims.received > 0) {
    tiles.push({
      key: "claims-received",
      value: String(claims.received),
      label: tvar(
        claims.received,
        "žádost s vráceným zbožím k dokončení",
        "žádosti s vráceným zbožím k dokončení",
        "žádostí s vráceným zbožím k dokončení"
      ),
      hint: "Zboží je zpátky u vás. Zbývá rozhodnout a případně vrátit peníze.",
      to: "/reklamace?status=received",
      cta: "Otevřít",
    });
  }

  for (const change of waiting.order_changes) {
    tiles.push({
      key: `order-change-${change.order_id}`,
      value: "",
      label: `Objednávka #${change.display_id ?? "?"}: zákazník žádá o změnu`,
      hint: "Zavolejte nebo odepište zákazníkovi — kontakt je v e-mailu i na objednávce.",
      to: `/orders/${change.order_id}`,
      cta: "Otevřít",
    });
  }

  if (courses.seat_requests > 0) {
    tiles.push({
      key: "course-seats",
      value: String(courses.seat_requests),
      label: tvar(
        courses.seat_requests,
        "žádost o místo na kurzu",
        "žádosti o místo na kurzu",
        "žádostí o místo na kurzu"
      ),
      hint: "Termín je plný a někdo by rád přišel.",
      to: "/kurzy-sprava?zalozka=mista",
      cta: "Otevřít",
    });
  }

  if (courses.cancel_requests > 0) {
    tiles.push({
      key: "course-cancels",
      value: String(courses.cancel_requests),
      label: tvar(
        courses.cancel_requests,
        "žádost o zrušení kurzu",
        "žádosti o zrušení kurzu",
        "žádostí o zrušení kurzu"
      ),
      hint: "Zákazník chce zrušit rezervaci méně než 24 hodin předem.",
      to: "/kurzy-sprava?zalozka=zadosti",
      cta: "Otevřít",
    });
  }

  for (const parcel of waiting.parcels) {
    if (parcel.kind !== "stored") continue;
    tiles.push({
      key: `parcel-stored-${parcel.order_id}`,
      value: "",
      label: `Zásilka #${parcel.display_id ?? "?"} leží na poště ${parcel.days ?? waiting.stored_parcel_days} dní`,
      hint: "Zákazník si ji zatím nevyzvedl — připomeňte mu to, ať se nevrátí.",
      to: `/orders/${parcel.order_id}`,
      cta: "Otevřít objednávku",
    });
  }

  return tiles;
};

/** Kolik věcí „Čeká na vás" a hořících věcí z téhož bloku — do úvodní věty. */
const waitingCount = (waiting: Waiting | undefined, newInquiries: number): number =>
  newInquiries +
  (waiting
    ? waiting.commissions_to_confirm +
      waiting.claims.new +
      waiting.claims.received +
      waiting.claims.overdue +
      waiting.courses.seat_requests +
      waiting.courses.cancel_requests +
      waiting.parcels_total +
      waiting.order_changes_total
    : 0);

/**
 * Řádek „Čeká na vás" — hned pod úvodní větou, nad „Na řadě".
 *
 * Štítky místo dlaždic: jsou to žádosti od lidí, kterých bývá pár, a každá
 * má jeden cíl. Číslo tučně, věta celá — „2 žádosti o místo na kurzu", ne
 * „Kurzy: 2". Bez ničeho na řádku se řádek vůbec neukáže.
 */
const CekaRadek = ({ tiles }: { tiles: Tile[] }) => {
  if (!tiles.length) {
    return null;
  }
  return (
    <section className="flex flex-col gap-y-3 px-6 py-5">
      <Heading level="h2">Čeká na vás</Heading>
      <div className="flex flex-wrap items-center gap-2">
        {tiles.map((tile) => (
          <Link
            key={tile.key}
            to={tile.to}
            title={tile.hint}
            className="text-ui-fg-base txt-compact-small border-ui-border-strong bg-ui-bg-base hover:bg-ui-bg-base-hover transition-fg flex items-center gap-x-1.5 rounded-lg border px-3 py-2 outline-none focus-visible:shadow-borders-focus"
          >
            {tile.value && <span className="font-semibold">{tile.value}</span>}
            <span>{tile.label}</span>
            <span aria-hidden="true" className="text-ui-fg-interactive">
              →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
};

const workTiles = (summary: OperationsSummary): Tile[] => {
  const { today } = summary;
  const tiles: Tile[] = [
    {
      key: "new-orders",
      label: "Nové objednávky",
      value: String(today.new_orders),
      hint: today.new_orders === 0 ? "Žádné nové — máte klid ☕" : undefined,
      to: "/prehled/prace?krok=nove",
      cta: today.new_orders === 0 ? "Otevřít frontu" : "Začít",
    },
    {
      key: "working",
      label: "Připravujeme",
      value: String(today.working),
      hint: today.working === 0 ? "Nic rozpracovaného" : undefined,
      to: "/prehled/prace?krok=pripravujeme",
      cta: "Otevřít",
    },
    {
      key: "shipping",
      label: "K odeslání",
      value: String(today.shipping),
      hint:
        today.shipping === 0
          ? "Vše odesláno"
          : today.shipping_oldest_days !== null &&
              today.shipping_oldest_days > 3
            ? `Nejstarší čeká ${today.shipping_oldest_days} dní.`
            : undefined,
      tone:
        today.shipping > 0 &&
        today.shipping_oldest_days !== null &&
        today.shipping_oldest_days > 3
          ? "critical"
          : "default",
      to: "/prehled/prace?krok=k-odeslani",
      cta: "Otevřít",
    },
  ];

  // Hidden at zero: she has no reason to think about money nobody owes.
  if (today.awaiting_balance.count > 0) {
    const overdue =
      today.awaiting_balance.oldest_request_days !== null &&
      today.awaiting_balance.oldest_request_days > 7;

    tiles.push({
      key: "awaiting-balance",
      label: "Čeká na doplatek",
      value: formatAmount(
        today.awaiting_balance.outstanding_amount,
        today.awaiting_balance.currency_code
      ),
      hint: overdue
        ? `Nejstarší žádost je ${today.awaiting_balance.oldest_request_days} dní stará.`
        : `${today.awaiting_balance.count} zakázk${
            today.awaiting_balance.count === 1 ? "a" : "y"
          } čeká na zaplacení.`,
      tone: overdue ? "critical" : "default",
      to: "/prehled/zakazky",
      cta: "Zobrazit",
    });
  }

  const deadlineDays =
    today.in_production.nearest_deadline !== null
      ? Math.ceil(
          (new Date(today.in_production.nearest_deadline).getTime() -
            Date.now()) /
            (24 * 60 * 60 * 1000)
        )
      : null;

  tiles.push({
    key: "in-production",
    label: "Ve výrobě",
    value: String(today.in_production.count),
    hint:
      today.in_production.count === 0
        ? "Žádná zakázka ve výrobě"
        : today.in_production.nearest_deadline
          ? `Nejbližší termín ${formatDate(today.in_production.nearest_deadline)}`
          : undefined,
    tone:
      deadlineDays !== null && deadlineDays <= 3 && today.in_production.count > 0
        ? "critical"
        : "default",
    to: "/prehled/zakazky",
    cta: "Zobrazit",
  });

  return tiles;
};

const shopTiles = (summary: OperationsSummary): Tile[] => {
  const { shop } = summary;
  const tiles: Tile[] = [
    {
      key: "low-stock",
      label: "Dochází na skladě",
      value: String(shop.low_stock),
      hint:
        shop.low_stock === 0
          ? "Zásoby v pořádku"
          : `Hranice upozornění: ${shop.low_stock_threshold} ks`,
      tone: shop.low_stock > 0 ? "critical" : "default",
      to: "/sklad-nizky-stav",
      cta: "Zobrazit",
    },
  ];

  if (shop.sold_out > 0) {
    tiles.push({
      key: "sold-out",
      label: "Vyprodáno",
      value: String(shop.sold_out),
      hint: "Zákazníci si to nemohou objednat.",
      tone: "critical",
      to: "/sklad-vyprodano",
      cta: "Zobrazit",
    });
  }

  tiles.push({
    key: "reviews",
    label: "Recenze ke schválení",
    value: String(shop.pending_reviews),
    hint: shop.pending_reviews === 0 ? "Žádné nové recenze" : undefined,
    tone: shop.pending_reviews > 5 ? "critical" : "default",
    to: "/reviews",
    cta: "Otevřít",
  });

  // What is currently discounted. Three instruments run independently (§13) and
  // are easy to forget once live, so they get one tile rather than three.
  const discountsRunning =
    shop.active_sales + shop.active_selections + shop.discount_codes +
    shop.automatic_discounts;

  if (discountsRunning > 0) {
    const parts = [
      shop.active_selections > 0 ? `${shop.active_selections} akce` : null,
      shop.active_sales > 0 ? `${shop.active_sales} ceníky` : null,
      shop.discount_codes > 0 ? `${shop.discount_codes} kódů` : null,
      shop.automatic_discounts > 0
        ? `${shop.automatic_discounts} automatických`
        : null,
    ].filter(Boolean);

    tiles.push({
      key: "discounts",
      label: "Běžící slevy",
      value: String(discountsRunning),
      hint: parts.join(" · "),
      to: "/prehled/slevy",
      cta: "Zobrazit",
    });
  }

  if (shop.ending_soon.length) {
    const first = shop.ending_soon[0];
    tiles.push({
      key: "ending-soon",
      label: "Končí brzy",
      value: first.title,
      hint: `Končí ${formatDate(first.ends_at)}${
        shop.ending_soon.length > 1
          ? ` · a další ${shop.ending_soon.length - 1}`
          : ""
      }`,
      to: "/prehled/slevy",
      cta: "Zobrazit",
    });
  }

  return tiles;
};

/**
 * Vitrína + Dovolená — the shop seen from outside, on the dashboard
 * (Matěj, 2026-08-06). The check walks the customer's path server-side;
 * the vacation toggle writes the merchant setting the payment workflow
 * enforces. Display here, law in the backend.
 */
const VitrinaCard = () => {
  const { data } = useQuery<{
    open: boolean;
    vacation: boolean;
    vacation_until: string | null;
    problems: { text: string; path: string | null; severity: "warn" | "bad" }[];
  }>({
    queryKey: ["storefront-check"],
    queryFn: () => sdk.client.fetch("/admin/workbench/storefront-check"),
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
  });

  const { data: settings } = useQuery<{ settings: any }>({
    queryKey: ["merchant-settings"],
    queryFn: () => sdk.client.fetch("/admin/merchant-settings"),
  });

  const vacationOn = Boolean(settings?.settings?.vacation_enabled);

  return (
    <section className="border-ui-border-base border-b px-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {data ? (
            <Badge size="2xsmall" color={data.open && !vacationOn ? "green" : vacationOn ? "orange" : "red"}>
              {vacationOn
                ? "Dovolená"
                : data.open
                  ? "Obchod je otevřený"
                  : "Něco brání nákupu"}
            </Badge>
          ) : (
            <Badge size="2xsmall" color="grey">
              Kontroluji obchod…
            </Badge>
          )}
          {vacationOn && settings?.settings?.vacation_until && (
            <Text size="xsmall" className="text-ui-fg-subtle">
              do {settings.settings.vacation_until}
            </Text>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {/* Provozní deník — co se v obchodě dělo a co z toho neprošlo.
              Totéž chodí večer e-mailem; odkaz je tu pro „hned". */}
          <Link
            to="/prehled/provoz"
            className="text-ui-fg-interactive txt-small hover:underline"
          >
            Provoz →
          </Link>
          <Link
            to="/nastaveni-obchodu"
            className="text-ui-fg-interactive txt-small hover:underline"
          >
            Dovolená a oznámení →
          </Link>
        </div>
      </div>

      {(data?.problems ?? []).map((problem, index) => (
        <Text
          key={index}
          size="xsmall"
          className={
            problem.severity === "bad"
              ? "text-ui-fg-error mt-2"
              : "text-ui-fg-subtle mt-2"
          }
        >
          {problem.severity === "bad" ? "●" : "○"} {problem.text}
          {problem.path && (
            <Link to={problem.path} className="text-ui-fg-interactive ml-1 hover:underline">
              Vyřešit
            </Link>
          )}
        </Text>
      ))}
    </section>
  );
};

const PrehledInner = () => {
  /* Volba platí do zavření stránky — ne do nastavení, je to pohled, ne nastavení. */
  const [razeni, setRazeni] = useState<Razeni>("oldest");
  const [vyber, setVyber] = useState<Vyber>("all");

  const { data, isLoading, isError, refetch, isFetching } =
    useQuery<OperationsSummary>({
      queryKey: ["operations-summary", razeni, vyber],
      queryFn: () =>
        sdk.client.fetch("/admin/operations/summary", {
          query: { next_up_sort: razeni, next_up_only: vyber },
        }),
      // The dashboard is left open on a workbench all day; stale counts here
      // would send her to an empty queue.
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
      // Přepnutí volby nesmí shodit celou stránku do kostry — než dojdou nová
      // čísla, zůstanou na ní ta předchozí.
      placeholderData: (previous) => previous,
    });

  /*
   * Nové poptávky zakázek mají vlastní endpoint (modul poptávek). Chyba nebo
   * 404 (backend ještě bez nové routy) = štítek se prostě neukáže — kvůli
   * poptávkám se Přehled nesmí hlásit jako nenačtený.
   */
  const { data: inquiryCounts } = useQuery<{ new: number }>({
    queryKey: ["commission-inquiries", "counts"],
    queryFn: () => sdk.client.fetch("/admin/commission-inquiries/counts"),
    retry: false,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const newInquiries = Math.max(0, Number(inquiryCounts?.new) || 0);

  if (isLoading) {
    return (
      <Container className="divide-y p-0">
        <WorkTabs active="prehled" />
        <header className="px-6 pb-2 pt-6">
          <Heading>Přehled</Heading>
        </header>
        <div className="grid gap-px bg-ui-border-base sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="bg-ui-bg-base px-6 py-5">
              <Skeleton className="h-16 rounded-lg" />
            </div>
          ))}
        </div>
      </Container>
    );
  }

  if (isError || !data) {
    return (
      <Container className="p-0">
        <WorkTabs active="prehled" />
        <div className="flex min-h-64 flex-col items-center justify-center gap-y-3 px-6 py-10 text-center">
          <Heading level="h2">Přehled se nepodařilo načíst</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Zkuste to prosím znovu.
          </Text>
          <Button size="small" variant="secondary" onClick={() => refetch()}>
            Zkusit znovu
          </Button>
        </div>
      </Container>
    );
  }

  const attention = attentionTiles(data);
  const work = workTiles(data);
  const shop = shopTiles(data);
  const waiting = waitingTiles(data.waiting, newInquiries);
  const cekaCelkem = waitingCount(data.waiting, newInquiries);

  const allClear =
    attention.length === 0 &&
    cekaCelkem === 0 &&
    data.today.new_orders === 0 &&
    data.today.working === 0 &&
    data.today.shipping === 0 &&
    data.next_up.length === 0;

  /*
   * Kolik věcí dnes čeká — číslo do úvodní věty.
   *
   * Sčítá se jen to, co je dnes práce: poruchy a objednávky, které někdo
   * musí posunout. Zásoby a recenze v tom schválně nejsou — „93 dochází na
   * skladě" by z klidného dne udělalo stovku úkolů, a přitom to není nic,
   * co se má udělat dnes. Žádosti z „Čeká na vás" (poptávky, reklamace,
   * kurzy, zásilky) ano — na ty někdo čeká.
   */
  const celkem =
    data.attention.payment_problems +
    data.attention.failed_emails +
    data.attention.carrier_failures +
    data.attention.overdue_production +
    data.today.new_orders +
    data.today.working +
    data.today.shipping +
    cekaCelkem;

  return (
    <div className="flex flex-col gap-y-3">
      {/* Úplně nahoře a jen když opravdu je co řešit — viz komentáře
          v komponentách. Účet, ke kterému se někdo právě nedostane, jde
          napřed: dokument se dá doplnit zítra, zákazník čeká teď. */}
      <OsireleUcty />
      <ChybejiciDokumenty />
      <Container className="divide-y p-0">
        <WorkTabs active="prehled" />
      <VitrinaCard />

        {/*
          Jedna věta místo nadpisu „Přehled" (§4).

          Nadpis stránky říkal, kde jsem — to už je vidět ze záložky. Tahle
          věta říká, co mě čeká, a jmenuje jen to, co hoří. Zbytek čísel je
          níž; sem patří jen součet a výjimky.
        */}
        <header className="flex flex-wrap items-start justify-between gap-3 px-6 pb-2 pt-6">
          <div className="min-w-0">
            <Heading>
              {pozdrav(new Date())}.{" "}
              {celkem === 0
                ? "Dnes nic nehoří."
                : `Dnes vás čeká ${veci(celkem)}.`}
            </Heading>
            {attention.length > 0 ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {attention.map((tile) => (
                  <Stitek key={tile.key} tile={tile} />
                ))}
              </div>
            ) : (
              <Text size="small" className="text-ui-fg-subtle mt-2">
                {celkem === 0
                  ? "Nové objednávky se tu objeví samy."
                  : "Nic se nepokazilo — všechno níž je běžná práce."}
              </Text>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* The way onto the live site with the admin bar switched on —
                see components/storefront-bridge-button.tsx. */}
            <StorefrontBridgeButton path="/cz" />
            <Button
              size="small"
              variant="secondary"
              isLoading={isFetching}
              onClick={() => refetch()}
            >
              <ArrowPath />
              Obnovit
            </Button>
          </div>
        </header>

        <CekaRadek tiles={waiting} />

        {/*
          Pořadí dne (§4): co hoří (štítky v hlavičce) → co čeká na odpověď
          (Čeká na vás) → na čem jsem na tahu
          (Na řadě) → kolik toho je (Dnešní práce) → obchod (řádek štítků).

          „Na řadě" bývalo úplně dole, pod čtrnácti dlaždicemi. Přitom je to
          ta odpověď na „co mám dělat teď", kvůli které stránka vznikla —
          konkrétní objednávky s konkrétním dalším krokem, ne čísla.
          Zóna „Vyžaduje pozornost" zmizela do štítků nahoře, zóna „Obchod"
          do řádku dole; zůstala jedna zóna dlaždic, a ta má smysl.
        */}
        <section className="divide-y">
          <header className="flex flex-wrap items-start justify-between gap-3 px-6 pb-4 pt-6">
            <div className="min-w-0">
              <Heading level="h2">Na řadě</Heading>
              <Text size="small" className="text-ui-fg-subtle mt-2">
                {razeniPopis[razeni]}
              </Text>
            </div>

            {/* Řazení a výběr v jedné rozbalovačce — pět řádků si zaslouží
                jedno tlačítko, ne řádek pilulek. Počítá to server. */}
            <DropdownMenu>
              <DropdownMenu.Trigger asChild>
                <Button size="small" variant="secondary" isLoading={isFetching}>
                  {razeniLabel[razeni]}
                  {vyber === "all" ? "" : ` · ${vyberLabel[vyber]}`} ▾
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content>
                <DropdownMenu.Label>Řadit</DropdownMenu.Label>
                <DropdownMenu.RadioGroup
                  value={razeni}
                  onValueChange={(value) => setRazeni(value as Razeni)}
                >
                  <DropdownMenu.RadioItem value="oldest">
                    {razeniLabel.oldest}
                  </DropdownMenu.RadioItem>
                  <DropdownMenu.RadioItem value="newest">
                    {razeniLabel.newest}
                  </DropdownMenu.RadioItem>
                </DropdownMenu.RadioGroup>

                <DropdownMenu.Separator />

                <DropdownMenu.Label>Ukázat</DropdownMenu.Label>
                <DropdownMenu.RadioGroup
                  value={vyber}
                  onValueChange={(value) => setVyber(value as Vyber)}
                >
                  {(Object.keys(vyberLabel) as Vyber[]).map((key) => (
                    <DropdownMenu.RadioItem key={key} value={key}>
                      {vyberLabel[key]}
                    </DropdownMenu.RadioItem>
                  ))}
                </DropdownMenu.RadioGroup>
              </DropdownMenu.Content>
            </DropdownMenu>
          </header>

          {data.next_up.length === 0 ? (
            <div className="flex min-h-32 flex-col items-center justify-center gap-y-2 px-6 py-8 text-center">
              <Text size="small" className="text-ui-fg-subtle max-w-md">
                {vyber !== "all"
                  ? "V tomhle výběru nic nečeká — zkuste ho rozbalovačkou rozšířit."
                  : allClear
                    ? "Všechno zvládnuto — nic nečeká. 🎉"
                    : "Žádná objednávka nečeká na vás."}
              </Text>
            </div>
          ) : (
            <div className="divide-y">
              {/*
                The same card component the queues use, so an order looks and
                behaves identically wherever she meets it.
              */}
              {data.next_up.map((order) => (
                <OrderRow key={order.order_id} order={order} stage={order.stage} />
              ))}
            </div>
          )}
        </section>

        <Zone
          title="Dnešní práce"
          description="Kolik toho je dohromady — klikem se dostanete na seznam."
          tiles={work}
        />

        <ObchodRadek tiles={shop} />
      </Container>
    </div>
  );
};

const queryClient = adminQueryClient;

/**
 * Přehled (§4) — the page that answers „co mám udělat teď?".
 *
 * Deliberately not analytics: no charts, no trends, nothing that needs
 * interpretation. Every tile is a count with one destination, and the zones are
 * ordered the way the day is: what is broken, what is in progress, what the
 * shop needs. Counts live here, on page headers and in the bell, because the
 * sidebar cannot carry badges (§2.1).
 */
const PrehledPage = () => (
  <QueryClientProvider client={queryClient}>
    <PrehledInner />
  </QueryClientProvider>
);

export const config = defineRouteConfig({
  label: "Přehled",
  icon: House,
  // Sidebar reads as her workflow: Přehled first, technical pages last.
  rank: 0,
});

export default PrehledPage;
