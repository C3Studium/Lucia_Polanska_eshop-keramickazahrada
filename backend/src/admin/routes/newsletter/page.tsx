import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { defineRouteConfig } from "@medusajs/admin-sdk";
import {
  ArrowDownMini,
  ArrowUpMini,
  DotsSix,
  EnvelopeSolid,
  MagnifyingGlass,
  Trash,
  XMarkMini,
} from "@medusajs/icons";
import {
  Badge,
  Button,
  Container,
  Heading,
  IconButton,
  Input,
  Label,
  Prompt,
  Skeleton,
  Text,
  Toaster,
  clx,
  toast,
} from "@medusajs/ui";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EmptyState } from "../../components/empty-state";
import { SubTabs } from "../../components/work-tabs";
import { formatAmount, formatDateTime } from "../../lib/format";
import { sdk } from "../../lib/sdk";

/**
 * Newsletter — odběratelé, psaní kampaní a historie na jednom místě.
 *
 * The „Napsat" tab is a full block editor: ordered blocks (nadpis with three
 * sizes, odstavec with bold + inline links, tlačítko, produkt, obrázek,
 * oddělovač) composed in React state, reordered by drag & drop (keyboard
 * included) or the arrow buttons, previewed by the backend rendering the
 * *actual* e-mail HTML (`POST /admin/newsletter/preview` → sandboxed iframe),
 * autosaved as a server-side draft every couple of seconds, and sent through
 * the existing idempotent campaign fan-out. Only confirmed subscribers are
 * ever counted or reached — the same predicate on both sides.
 *
 * Paragraph formatting is stored as *runs* (`{text, bold?, url?}`), never
 * HTML: the contentEditable below serialises to exactly that model and
 * pastes are stripped to plain text, so nothing else can survive the trip —
 * see `lib/newsletter-blocks.ts`.
 *
 * The send button obeys `unsubscribe_ready`: without a public backend URL
 * the unsubscribe links in the mail would be dead, and such an e-mail must
 * not exist (zák. č. 480/2004 Sb.) — the server refuses it independently.
 */

type SubscriberState = "confirmed" | "pending" | "unsubscribed";

type AdminSubscriber = {
  id: string;
  email: string;
  source: string | null;
  subscribed_at: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  suppressed_reason: string | null;
  state: SubscriberState;
};

type SubscribersResponse = {
  count: number;
  counts: { confirmed: number; pending: number; unsubscribed: number };
  total: number;
  subscribers: AdminSubscriber[];
  unsubscribe_ready: boolean;
};

type CampaignRow = {
  id: string;
  subject: string;
  preheader: string | null;
  campaign_key: string;
  recipients: number | null;
  sent_at: string;
};

type DraftRow = {
  id: string;
  subject: string | null;
  preheader: string | null;
  blocks: unknown;
  updated_at: string;
};

type CampaignStatsResponse = {
  campaign: {
    id: string;
    subject: string;
    campaign_key: string;
    recipients: number | null;
    sent_at: string | null;
  };
  measurement_ready: boolean;
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    complained: number;
    links: Array<{ url: string; clicks: number; addresses: number }>;
  };
};

type ProductSnapshot = {
  product_id: string;
  title: string;
  handle: string;
  thumbnail: string | null;
  price_text: string | null;
};

/** One formatted stretch of paragraph text — mirrors `NewsletterRun`. */
type Run = { text: string; bold?: boolean; url?: string };

type HeadingLevel = 1 | 2 | 3;

type EditorBlock =
  | { uid: string; type: "heading"; text: string; level: HeadingLevel }
  | { uid: string; type: "paragraph"; runs: Run[] }
  | { uid: string; type: "button"; label: string; url: string }
  | { uid: string; type: "product"; product: ProductSnapshot | null }
  | { uid: string; type: "image"; src: string; alt: string; link: string }
  | { uid: string; type: "catalog"; products: ProductSnapshot[] }
  | {
      uid: string;
      type: "promo";
      title: string;
      code: string;
      note: string;
      label: string;
      url: string;
    }
  | { uid: string; type: "divider" };

/** The catalogue grid stops at six tiles — beyond that it IS the shop. */
const MAX_CATALOG_PRODUCTS = 6;

const BLOCK_LABELS: Record<EditorBlock["type"], string> = {
  heading: "Nadpis",
  paragraph: "Odstavec",
  button: "Tlačítko",
  product: "Produkt",
  image: "Obrázek",
  catalog: "Katalog",
  promo: "Sleva / akce",
  divider: "Oddělovač",
};

const HEADING_LEVEL_LABELS: Record<HeadingLevel, string> = {
  1: "Velký titulek",
  2: "Mezititulek",
  3: "Drobný nadpis",
};

const STATE_LABELS: Record<SubscriberState, string> = {
  confirmed: "potvrzený",
  pending: "čeká na potvrzení",
  unsubscribed: "odhlášený",
};

const STATE_COLORS: Record<SubscriberState, "green" | "orange" | "grey"> = {
  confirmed: "green",
  pending: "orange",
  unsubscribed: "grey",
};

/** The suppressed states get their own words *and* their own color. The
 * reason only speaks while the row is actually unsubscribed — a stale value
 * on a re-subscribed address must never relabel an active subscriber. */
const isSuppressed = (subscriber: AdminSubscriber): boolean =>
  subscriber.state === "unsubscribed" && !!subscriber.suppressed_reason;

const subscriberStateLabel = (subscriber: AdminSubscriber): string =>
  isSuppressed(subscriber)
    ? subscriber.suppressed_reason === "bounce"
      ? "vyřazen — nedoručitelné"
      : "vyřazen — označil jako spam"
    : STATE_LABELS[subscriber.state];

const subscriberStateColor = (
  subscriber: AdminSubscriber
): "green" | "orange" | "grey" | "red" =>
  isSuppressed(subscriber) ? "red" : STATE_COLORS[subscriber.state];

const isWebUrl = (value: string): boolean => /^https?:\/\//i.test(value.trim());

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const newUid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const defaultBlocks = (): EditorBlock[] => [
  { uid: newUid(), type: "heading", text: "", level: 2 },
  { uid: newUid(), type: "paragraph", runs: [] },
];

const paragraphPlainText = (runs: Run[]): string =>
  runs.map((run) => run.text).join("");

/** Editor state → the API's block shape; unfinished blocks are left out. */
const toApiBlocks = (blocks: EditorBlock[]): Record<string, unknown>[] => {
  const result: Record<string, unknown>[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case "heading":
        if (block.text.trim()) {
          result.push({ type: "heading", text: block.text, level: block.level });
        }
        break;
      case "paragraph":
        if (paragraphPlainText(block.runs).trim()) {
          result.push({ type: "paragraph", runs: block.runs });
        }
        break;
      case "button":
        if (block.label.trim() && isWebUrl(block.url)) {
          result.push({ type: "button", label: block.label, url: block.url.trim() });
        }
        break;
      case "product":
        if (block.product) {
          result.push({ type: "product", ...block.product });
        }
        break;
      case "image":
        if (isWebUrl(block.src)) {
          result.push({
            type: "image",
            src: block.src.trim(),
            alt: block.alt,
            ...(isWebUrl(block.link) ? { link: block.link.trim() } : {}),
          });
        }
        break;
      case "catalog":
        if (block.products.length) {
          result.push({ type: "catalog", products: block.products });
        }
        break;
      case "promo":
        if (block.title.trim()) {
          result.push({
            type: "promo",
            title: block.title.trim(),
            ...(block.code.trim() ? { code: block.code.trim() } : {}),
            ...(block.note.trim() ? { note: block.note.trim() } : {}),
            ...(block.label.trim() ? { label: block.label.trim() } : {}),
            ...(isWebUrl(block.url) ? { url: block.url.trim() } : {}),
          });
        }
        break;
      case "divider":
        result.push({ type: "divider" });
        break;
    }
  }
  return result;
};

/**
 * Editor state → the draft the autosave stores. Unlike `toApiBlocks` nothing
 * is left out: a half-typed button must survive the round trip — the server
 * keeps drafts through its own lenient sanitiser.
 */
const toDraftBlocks = (blocks: EditorBlock[]): Record<string, unknown>[] =>
  blocks.map((block) => {
    switch (block.type) {
      case "heading":
        return { type: "heading", text: block.text, level: block.level };
      case "paragraph":
        return { type: "paragraph", runs: block.runs };
      case "button":
        return { type: "button", label: block.label, url: block.url };
      case "product":
        return block.product
          ? { type: "product", ...block.product }
          : { type: "product" };
      case "image":
        return { type: "image", src: block.src, alt: block.alt, link: block.link };
      case "catalog":
        return { type: "catalog", products: block.products };
      case "promo":
        return {
          type: "promo",
          title: block.title,
          code: block.code,
          note: block.note,
          label: block.label,
          url: block.url,
        };
      case "divider":
        return { type: "divider" };
    }
  });

const strOf = (value: unknown): string => (typeof value === "string" ? value : "");

const levelOf = (value: unknown): HeadingLevel =>
  value === 1 || value === 2 || value === 3 ? value : 2;

/** Stored draft blocks (or a sent campaign's blocks) → editor state. */
const fromDraftBlocks = (input: unknown): EditorBlock[] => {
  if (!Array.isArray(input)) {
    return [];
  }
  const result: EditorBlock[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const block = raw as Record<string, unknown>;
    const uid = newUid();
    switch (block.type) {
      case "heading":
        result.push({
          uid,
          type: "heading",
          text: strOf(block.text),
          level: levelOf(block.level),
        });
        break;
      case "paragraph": {
        const rawRuns = Array.isArray(block.runs)
          ? block.runs
          : typeof block.text === "string"
            ? [{ text: block.text }]
            : [];
        const runs: Run[] = [];
        for (const entry of rawRuns) {
          if (!entry || typeof entry !== "object") continue;
          const run = entry as Record<string, unknown>;
          if (typeof run.text !== "string" || !run.text) continue;
          runs.push({
            text: run.text,
            ...(run.bold === true ? { bold: true } : {}),
            ...(typeof run.url === "string" && isWebUrl(run.url)
              ? { url: run.url }
              : {}),
          });
        }
        result.push({ uid, type: "paragraph", runs });
        break;
      }
      case "button":
        result.push({
          uid,
          type: "button",
          label: strOf(block.label),
          url: strOf(block.url),
        });
        break;
      case "product":
        result.push({
          uid,
          type: "product",
          product:
            typeof block.product_id === "string" && block.product_id
              ? {
                  product_id: block.product_id,
                  title: strOf(block.title),
                  handle: strOf(block.handle),
                  thumbnail:
                    typeof block.thumbnail === "string" ? block.thumbnail : null,
                  price_text:
                    typeof block.price_text === "string" ? block.price_text : null,
                }
              : null,
        });
        break;
      case "image":
        result.push({
          uid,
          type: "image",
          src: strOf(block.src),
          alt: strOf(block.alt),
          link: strOf(block.link),
        });
        break;
      case "catalog": {
        const rawProducts = Array.isArray(block.products) ? block.products : [];
        result.push({
          uid,
          type: "catalog",
          products: rawProducts
            .slice(0, MAX_CATALOG_PRODUCTS)
            .flatMap((raw) => {
              const product = raw as Record<string, unknown> | null;
              return product &&
                typeof product === "object" &&
                typeof product.product_id === "string" &&
                product.product_id
                ? [
                    {
                      product_id: product.product_id,
                      title: strOf(product.title),
                      handle: strOf(product.handle),
                      thumbnail:
                        typeof product.thumbnail === "string"
                          ? product.thumbnail
                          : null,
                      price_text:
                        typeof product.price_text === "string"
                          ? product.price_text
                          : null,
                    },
                  ]
                : [];
            }),
        });
        break;
      }
      case "promo":
        result.push({
          uid,
          type: "promo",
          title: strOf(block.title),
          code: strOf(block.code),
          note: strOf(block.note),
          label: strOf(block.label),
          url: strOf(block.url),
        });
        break;
      case "divider":
        result.push({ uid, type: "divider" });
        break;
    }
  }
  return result;
};

/** Nothing typed anywhere — autosave has no reason to create a draft yet. */
const isBlankComposition = (
  subject: string,
  preheader: string,
  blocks: EditorBlock[]
): boolean =>
  !subject.trim() &&
  !preheader.trim() &&
  blocks.every((block) => {
    switch (block.type) {
      case "heading":
        return !block.text.trim();
      case "paragraph":
        return !paragraphPlainText(block.runs).trim();
      case "button":
        return !block.label.trim() && !block.url.trim();
      case "product":
        return !block.product;
      case "image":
        return !block.src && !block.alt.trim() && !block.link.trim();
      case "catalog":
        return !block.products.length;
      case "promo":
        return (
          !block.title.trim() &&
          !block.code.trim() &&
          !block.note.trim() &&
          !block.label.trim() &&
          !block.url.trim()
        );
      case "divider":
        return true;
    }
  });

/** Czech reasons the campaign is not sendable yet. Mirrors the server check. */
const compositionProblems = (
  subject: string,
  blocks: EditorBlock[]
): string[] => {
  const problems: string[] = [];
  if (!subject.trim()) {
    problems.push("Chybí předmět e-mailu.");
  }
  const api = toApiBlocks(blocks);
  if (!api.some((block) => block.type !== "divider")) {
    problems.push("E-mail nemá žádný obsah — přidejte alespoň jeden blok.");
  }
  if (
    blocks.some(
      (block) =>
        block.type === "button" &&
        (block.label.trim() || block.url.trim()) &&
        !isWebUrl(block.url)
    )
  ) {
    problems.push("Tlačítko potřebuje úplnou adresu začínající https://.");
  }
  if (blocks.some((block) => block.type === "product" && !block.product)) {
    problems.push("V bloku Produkt zbývá vybrat produkt.");
  }
  if (blocks.some((block) => block.type === "image" && !block.src)) {
    problems.push("V bloku Obrázek zbývá nahrát fotku.");
  }
  if (
    blocks.some(
      (block) => block.type === "image" && block.src && !block.alt.trim()
    )
  ) {
    // Verbatim the server's wording (`lib/newsletter-blocks.ts`).
    problems.push(
      "U obrázku zbývá doplnit popis — přečte ho hlasová čtečka a zobrazí se, když se obrázek nenačte."
    );
  }
  if (
    blocks.some(
      (block) =>
        block.type === "image" && block.link.trim() && !isWebUrl(block.link)
    )
  ) {
    problems.push("Odkaz u obrázku potřebuje úplnou adresu začínající https://.");
  }
  return problems;
};

const czechRecipients = (count: number): string => {
  if (count === 1) return "1 odběrateli";
  return `${count} odběratelům`;
};

/* ------------------------------------------------------------------ */
/* Odběratelé                                                          */
/* ------------------------------------------------------------------ */

const csvField = (value: string): string => {
  // Excel/LibreOffice execute cells starting with = + - @ (or a stray
  // tab/CR) as formulas — and an e-mail address is attacker-chosen text, so
  // a leading apostrophe neutralises it before it can become one.
  const defused = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /["';\n]/.test(defused)
    ? `"${defused.replace(/"/g, '""')}"`
    : defused;
};

const exportCsv = (subscribers: AdminSubscriber[]) => {
  const header = "email;stav;zdroj;prihlaseno;potvrzeno;odhlaseno";
  const lines = subscribers.map((subscriber) =>
    [
      subscriber.email,
      subscriberStateLabel(subscriber),
      subscriber.source ?? "",
      subscriber.subscribed_at ?? "",
      subscriber.confirmed_at ?? "",
      subscriber.unsubscribed_at ?? "",
    ]
      .map(csvField)
      .join(";")
  );
  // BOM so Czech diacritics open correctly in Excel.
  const blob = new Blob(["\uFEFF" + [header, ...lines].join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `newsletter-odberatele-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
};

const SubscribersTab = ({ data }: { data: SubscribersResponse }) => {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return data.subscribers;
    return data.subscribers.filter((subscriber) =>
      subscriber.email.toLowerCase().includes(needle)
    );
  }, [data.subscribers, search]);

  const bounced = data.subscribers.filter(
    (subscriber) =>
      isSuppressed(subscriber) && subscriber.suppressed_reason === "bounce"
  ).length;
  const complained = data.subscribers.filter(
    (subscriber) =>
      isSuppressed(subscriber) && subscriber.suppressed_reason === "complaint"
  ).length;

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge size="2xsmall" color="green">
            potvrzení: {data.counts.confirmed}
          </Badge>
          <Badge size="2xsmall" color="orange">
            čekají na potvrzení: {data.counts.pending}
          </Badge>
          <Badge size="2xsmall" color="grey">
            odhlášení: {data.counts.unsubscribed}
          </Badge>
          {bounced > 0 && (
            <Badge size="2xsmall" color="red">
              vyřazené — nedoručitelné: {bounced}
            </Badge>
          )}
          {complained > 0 && (
            <Badge size="2xsmall" color="red">
              vyřazené — spam: {complained}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <MagnifyingGlass className="text-ui-fg-muted pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Hledat e-mail…"
              className="pl-9"
              size="small"
              aria-label="Hledat odběratele"
            />
          </div>
          <Button
            size="small"
            variant="secondary"
            onClick={() => exportCsv(data.subscribers)}
            disabled={!data.subscribers.length}
          >
            Export CSV
          </Button>
        </div>
      </div>

      <Text size="xsmall" className="text-ui-fg-subtle px-6 pb-3">
        Kampaně chodí jen potvrzeným — těm, kdo po přihlášení klikli na
        potvrzovací odkaz v e-mailu. Odhlášeným už nikdy nic nepřijde. Adresy,
        které se dlouhodobě nedají doručit nebo označily zprávu jako spam, se
        z odběru vyřazují samy.
      </Text>

      {!filtered.length && (
        <EmptyState
          title={search ? "Nikdo takový tu není" : "Zatím žádní odběratelé"}
          description={
            search
              ? "Zkuste hledání zkrátit."
              : "Odběratelé se přihlašují formulářem v patičce e-shopu."
          }
        />
      )}

      <div className="divide-y border-t">
        {filtered.map((subscriber) => (
          <article
            key={subscriber.id}
            className="grid gap-2 px-6 py-3 lg:grid-cols-[minmax(0,1.4fr)_220px_minmax(0,1fr)_minmax(0,1fr)] lg:items-center"
          >
            <Text size="small" weight="plus" className="truncate">
              {subscriber.email}
            </Text>
            <div>
              <Badge size="2xsmall" color={subscriberStateColor(subscriber)}>
                {subscriberStateLabel(subscriber)}
              </Badge>
            </div>
            <Text size="xsmall" className="text-ui-fg-subtle">
              přihlášen {formatDateTime(subscriber.subscribed_at)}
              {subscriber.source ? ` · ${subscriber.source}` : ""}
            </Text>
            <Text size="xsmall" className="text-ui-fg-subtle">
              {subscriber.state === "confirmed" &&
                subscriber.confirmed_at &&
                `potvrzen ${formatDateTime(subscriber.confirmed_at)}`}
              {subscriber.state === "unsubscribed" &&
                subscriber.unsubscribed_at &&
                `${
                  isSuppressed(subscriber) ? "vyřazen" : "odhlášen"
                } ${formatDateTime(subscriber.unsubscribed_at)}`}
            </Text>
          </article>
        ))}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Napsat — rich paragraph editor                                      */
/* ------------------------------------------------------------------ */

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Runs → the editor's inner HTML. The exact inverse of `serializeEditor`. */
const runsToHtml = (runs: Run[]): string =>
  runs
    .map((run) => {
      let html = escapeHtml(run.text).replace(/\n/g, "<br>");
      if (run.bold) {
        html = `<strong>${html}</strong>`;
      }
      if (run.url) {
        html = `<a href="${escapeHtml(run.url)}">${html}</a>`;
      }
      return html;
    })
    .join("");

/**
 * Whatever the contentEditable holds → runs. Only three things are read:
 * text, boldness (`<strong>`/`<b>`/`font-weight`), and `<a href>` with a web
 * URL; every other tag contributes nothing but its text. `<br>` and block
 * elements become newlines, `&nbsp;` becomes a plain space. This is the
 * whole reason pasted Word/web content cannot smuggle formatting in.
 */
const serializeEditor = (root: HTMLElement): Run[] => {
  const runs: Run[] = [];

  const push = (text: string, bold: boolean, url: string | null) => {
    const cleaned = text.replace(/\u00A0/g, " ");
    if (!cleaned) return;
    const previous = runs[runs.length - 1];
    if (
      previous &&
      Boolean(previous.bold) === bold &&
      (previous.url ?? null) === url
    ) {
      previous.text += cleaned;
    } else {
      runs.push({
        text: cleaned,
        ...(bold ? { bold: true } : {}),
        ...(url ? { url } : {}),
      });
    }
  };

  const walk = (node: Node, bold: boolean, url: string | null) => {
    if (node.nodeType === Node.TEXT_NODE) {
      push(node.textContent ?? "", bold, url);
      return;
    }
    if (!(node instanceof HTMLElement)) {
      return;
    }
    const tag = node.tagName;
    if (tag === "BR") {
      push("\n", bold, url);
      return;
    }
    const style = node.style.fontWeight;
    const nextBold =
      bold || tag === "B" || tag === "STRONG" || /^(bold|[5-9]00)$/.test(style);
    let nextUrl = url;
    if (tag === "A") {
      const href = node.getAttribute("href") ?? "";
      if (/^https?:\/\//i.test(href)) {
        nextUrl = href;
      }
    }
    // Browsers wrap each visual line in a <div> (or <p>) as she types —
    // entering one after existing content is a line break.
    if (
      (tag === "DIV" || tag === "P") &&
      runs.length &&
      !runs[runs.length - 1].text.endsWith("\n")
    ) {
      push("\n", bold, url);
    }
    for (const child of Array.from(node.childNodes)) {
      walk(child, nextBold, nextUrl);
    }
  };

  for (const child of Array.from(root.childNodes)) {
    walk(child, false, null);
  }
  return runs;
};

const elementOf = (node: Node | null | undefined): HTMLElement | null =>
  !node ? null : node instanceof HTMLElement ? node : node.parentElement;

/**
 * The paragraph editor: a small contentEditable with a floating toolbar
 * (Tučně · Odkaz · Zrušit odkaz) that appears over a selection. Bold works
 * with Ctrl/Cmd+B too. The DOM is only rewritten when the value changes from
 * the *outside* (draft loaded, campaign sent) — while she types, the browser
 * owns the DOM and we merely serialise it, so the cursor never jumps.
 */
const RichParagraphEditor = ({
  runs,
  onChange,
}: {
  runs: Run[];
  onChange: (runs: Run[]) => void;
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef<string | null>(null);
  const [toolbar, setToolbar] = useState<{
    top: number;
    left: number;
    hasLink: boolean;
  } | null>(null);

  useEffect(() => {
    const json = JSON.stringify(runs);
    if (json !== lastEmitted.current && editorRef.current) {
      editorRef.current.innerHTML = runsToHtml(runs);
      lastEmitted.current = json;
    }
  }, [runs]);

  const emit = () => {
    if (!editorRef.current) return;
    const next = serializeEditor(editorRef.current);
    lastEmitted.current = JSON.stringify(next);
    onChange(next);
  };

  const updateToolbar = () => {
    const selection = window.getSelection();
    const wrapper = wrapperRef.current;
    const editor = editorRef.current;
    if (
      !selection ||
      !selection.rangeCount ||
      selection.isCollapsed ||
      !wrapper ||
      !editor
    ) {
      setToolbar(null);
      return;
    }
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) {
      setToolbar(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    const wrapRect = wrapper.getBoundingClientRect();
    const hasLink = Boolean(
      elementOf(selection.anchorNode)?.closest("a") ||
        elementOf(selection.focusNode)?.closest("a")
    );
    setToolbar({
      top: rect.top - wrapRect.top - 40,
      left: Math.max(
        0,
        Math.min(rect.left - wrapRect.left, Math.max(0, wrapRect.width - 240))
      ),
      hasLink,
    });
  };

  const applyBold = () => {
    document.execCommand("bold");
    emit();
    updateToolbar();
  };

  const applyLink = () => {
    const url = window.prompt("Adresa odkazu (musí začínat https://)", "https://");
    if (url === null) return;
    const trimmed = url.trim();
    if (!isWebUrl(trimmed)) {
      toast.error("Odkaz musí být úplná adresa začínající https://.");
      return;
    }
    document.execCommand("createLink", false, trimmed);
    emit();
    updateToolbar();
  };

  const removeLink = () => {
    document.execCommand("unlink");
    emit();
    updateToolbar();
  };

  return (
    <div ref={wrapperRef} className="relative">
      {toolbar && (
        <div
          className="bg-ui-bg-base shadow-elevation-flyout absolute z-10 flex items-center gap-1 rounded-md border p-1"
          style={{ top: toolbar.top, left: toolbar.left }}
          role="toolbar"
          aria-label="Formátování textu"
        >
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={applyBold}
            className="hover:bg-ui-bg-base-hover rounded px-2 py-1 text-xs font-bold"
            aria-label="Tučně (Ctrl+B)"
            title="Tučně (Ctrl+B)"
          >
            B
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={applyLink}
            className="hover:bg-ui-bg-base-hover rounded px-2 py-1 text-xs underline"
          >
            Odkaz
          </button>
          {toolbar.hasLink && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={removeLink}
              className="hover:bg-ui-bg-base-hover text-ui-fg-subtle rounded px-2 py-1 text-xs"
            >
              Zrušit odkaz
            </button>
          )}
        </div>
      )}
      <div
        ref={editorRef}
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label="Text odstavce. Označením textu se objeví nabídka Tučně a Odkaz."
        data-placeholder="Text odstavce. Nový řádek zůstane novým řádkem i v e-mailu. Označte text a můžete ho ztučnit nebo z něj udělat odkaz."
        className={clx(
          "bg-ui-bg-field txt-small min-h-[92px] w-full rounded-md border px-3 py-2",
          "focus:shadow-borders-interactive-with-active focus:outline-none",
          "empty:before:text-ui-fg-muted empty:before:content-[attr(data-placeholder)]",
          "[&_a]:text-ui-fg-interactive [&_a]:underline [&_strong]:font-semibold"
        )}
        onInput={() => {
          emit();
          updateToolbar();
        }}
        onKeyUp={updateToolbar}
        onMouseUp={updateToolbar}
        onBlur={(event) => {
          if (!wrapperRef.current?.contains(event.relatedTarget as Node)) {
            setToolbar(null);
          }
        }}
        onPaste={(event) => {
          // Formatting never survives a paste — plain text only, the run
          // model is the sole way formatting can exist here.
          event.preventDefault();
          const text = event.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
          emit();
        }}
      />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Napsat — image block                                                */
/* ------------------------------------------------------------------ */

const ImageBlockEditor = ({
  block,
  onChange,
}: {
  block: Extract<EditorBlock, { type: "image" }>;
  onChange: (next: EditorBlock) => void;
}) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Vyberte prosím obrázek — jiný typ souboru do e-mailu vložit nejde.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Fotka je moc velká — nahrajte prosím soubor do 5 MB.");
      return;
    }
    setUploading(true);
    try {
      /* Same proven path as the production diary: Medusa's own photo
         storage, multipart, admin session cookie. */
      const formData = new FormData();
      formData.append("files", file);
      const response = await fetch(`/admin/uploads`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) {
        throw new Error("Fotku se nepodařilo nahrát.");
      }
      const payload = await response.json();
      const url: string | undefined = payload?.files?.[0]?.url;
      if (!url) {
        throw new Error("Úložiště nevrátilo adresu fotky.");
      }
      onChange({ ...block, src: url });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Fotku se nepodařilo nahrát."
      );
    } finally {
      setUploading(false);
      if (fileInput.current) {
        fileInput.current.value = "";
      }
    }
  };

  return (
    <div className="flex flex-col gap-y-3">
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void handleFile(event.target.files?.[0])}
        aria-label="Vybrat fotku z počítače"
      />

      {block.src ? (
        <div className="flex items-center gap-3">
          <img
            src={block.src}
            alt={block.alt || ""}
            className="bg-ui-bg-subtle h-24 max-w-40 rounded-md border object-cover"
          />
          <Button
            size="small"
            variant="secondary"
            isLoading={uploading}
            onClick={() => fileInput.current?.click()}
          >
            Vyměnit fotku
          </Button>
        </div>
      ) : (
        <div>
          <Button
            size="small"
            variant="secondary"
            isLoading={uploading}
            onClick={() => fileInput.current?.click()}
          >
            Nahrát fotku z počítače
          </Button>
          <Text size="xsmall" className="text-ui-fg-subtle mt-1">
            JPG nebo PNG do 5 MB. V e-mailu se zobrazí na celou šířku.
          </Text>
        </div>
      )}

      <div>
        <Label htmlFor={`img-alt-${block.uid}`} size="xsmall">
          Popis obrázku{" "}
          <span className="text-ui-fg-muted font-normal">
            (pro nevidomé a když se obrázek nenačte)
          </span>
        </Label>
        <Input
          id={`img-alt-${block.uid}`}
          value={block.alt}
          onChange={(event) => onChange({ ...block, alt: event.target.value })}
          placeholder="Např. Zahradní plastika Strážce mezi trvalkami"
        />
      </div>

      <div>
        <Label htmlFor={`img-link-${block.uid}`} size="xsmall">
          Odkaz po kliknutí{" "}
          <span className="text-ui-fg-muted font-normal">
            (nepovinné, https://…)
          </span>
        </Label>
        <Input
          id={`img-link-${block.uid}`}
          value={block.link}
          onChange={(event) => onChange({ ...block, link: event.target.value })}
          placeholder="https://keramickazahrada.cz/cz/store"
        />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Napsat — product picker (unchanged behaviour)                       */
/* ------------------------------------------------------------------ */

type AdminProductHit = {
  id: string;
  title: string;
  handle: string | null;
  thumbnail: string | null;
  variants?: Array<{
    prices?: Array<{ amount: number; currency_code: string }>;
  }>;
};

const priceTextOf = (product: AdminProductHit): string | null => {
  const amounts = (product.variants ?? [])
    .flatMap((variant) => variant.prices ?? [])
    .filter((price) => price.currency_code?.toLowerCase() === "czk")
    .map((price) => Number(price.amount))
    .filter((amount) => Number.isFinite(amount) && amount > 0);

  if (!amounts.length) return null;
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  return min === max ? formatAmount(min) : `od ${formatAmount(min)}`;
};

const ProductPicker = ({
  onPick,
}: {
  onPick: (snapshot: ProductSnapshot) => void;
}) => {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const canSearch = debounced.length >= 2;

  const { data, isFetching } = useQuery({
    queryKey: ["newsletter-product-search", debounced],
    queryFn: () =>
      sdk.client.fetch<{ products: AdminProductHit[] }>("/admin/products", {
        query: {
          q: debounced,
          limit: 8,
          status: ["published"],
          fields:
            "id,title,handle,thumbnail,variants.id,variants.prices.amount,variants.prices.currency_code",
        },
      }),
    enabled: canSearch,
    staleTime: 30_000,
  });

  const products = (data?.products ?? []).filter((product) => product.handle);

  return (
    <div className="flex flex-col gap-y-2">
      <div className="relative">
        <MagnifyingGlass className="text-ui-fg-muted pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Začněte psát název produktu…"
          className="pl-9"
          size="small"
          aria-label="Vyhledat produkt do e-mailu"
        />
      </div>
      {canSearch && (
        <div className="bg-ui-bg-subtle divide-y overflow-hidden rounded-lg border">
          {isFetching && (
            <Text size="xsmall" className="text-ui-fg-muted block px-3 py-2">
              Hledám…
            </Text>
          )}
          {!isFetching && !products.length && (
            <Text size="xsmall" className="text-ui-fg-muted block px-3 py-2">
              Nic nenalezeno. Do e-mailu jdou jen publikované produkty.
            </Text>
          )}
          {products.map((product) => (
            <button
              key={product.id}
              type="button"
              className="hover:bg-ui-bg-base-hover flex w-full items-center gap-3 px-3 py-2 text-left"
              onClick={() =>
                onPick({
                  product_id: product.id,
                  title: product.title,
                  handle: product.handle as string,
                  thumbnail: product.thumbnail,
                  price_text: priceTextOf(product),
                })
              }
            >
              <span className="bg-ui-bg-base flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border">
                {product.thumbnail ? (
                  <img
                    src={product.thumbnail}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="text-ui-fg-muted text-xs">
                    {product.title.slice(0, 1).toLocaleUpperCase("cs")}
                  </span>
                )}
              </span>
              <span className="min-w-0">
                <Text size="small" weight="plus" className="truncate">
                  {product.title}
                </Text>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {priceTextOf(product) ?? "bez ceny v Kč"}
                </Text>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Napsat — block cards + drag & drop                                  */
/* ------------------------------------------------------------------ */

const BlockCard = ({
  block,
  index,
  total,
  dragHandle,
  onChange,
  onMove,
  onDelete,
}: {
  block: EditorBlock;
  index: number;
  total: number;
  dragHandle?: ReactNode;
  onChange: (next: EditorBlock) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) => (
  <section className="bg-ui-bg-base rounded-lg border">
    <header className="border-ui-border-base flex items-center justify-between gap-2 border-b px-3 py-1.5">
      <div className="flex min-w-0 items-center gap-1.5">
        {dragHandle}
        <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
          {BLOCK_LABELS[block.type]}
        </Text>
      </div>
      <div className="flex items-center gap-1">
        <IconButton
          size="small"
          variant="transparent"
          disabled={index === 0}
          onClick={() => onMove(-1)}
          aria-label="Posunout blok nahoru"
        >
          <ArrowUpMini />
        </IconButton>
        <IconButton
          size="small"
          variant="transparent"
          disabled={index === total - 1}
          onClick={() => onMove(1)}
          aria-label="Posunout blok dolů"
        >
          <ArrowDownMini />
        </IconButton>
        <IconButton
          size="small"
          variant="transparent"
          onClick={onDelete}
          aria-label="Smazat blok"
        >
          <Trash />
        </IconButton>
      </div>
    </header>

    <div className="px-3 py-3">
      {block.type === "heading" && (
        <div className="flex flex-col gap-y-2">
          <Input
            value={block.text}
            onChange={(event) => onChange({ ...block, text: event.target.value })}
            placeholder="Např. Nové objekty z pece"
            aria-label="Text nadpisu"
          />
          <div
            className="flex items-center gap-1"
            role="radiogroup"
            aria-label="Velikost nadpisu"
          >
            {([1, 2, 3] as const).map((level) => (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={block.level === level}
                onClick={() => onChange({ ...block, level })}
                className={clx(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  block.level === level
                    ? "border-ui-border-interactive bg-ui-bg-base-pressed font-medium"
                    : "border-ui-border-base hover:bg-ui-bg-base-hover text-ui-fg-subtle"
                )}
              >
                {HEADING_LEVEL_LABELS[level]}
              </button>
            ))}
          </div>
        </div>
      )}

      {block.type === "paragraph" && (
        <RichParagraphEditor
          runs={block.runs}
          onChange={(runs) => onChange({ ...block, runs })}
        />
      )}

      {block.type === "button" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label htmlFor={`btn-label-${block.uid}`} size="xsmall">
              Text tlačítka
            </Label>
            <Input
              id={`btn-label-${block.uid}`}
              value={block.label}
              onChange={(event) =>
                onChange({ ...block, label: event.target.value })
              }
              placeholder="Prohlédnout objekty"
            />
          </div>
          <div>
            <Label htmlFor={`btn-url-${block.uid}`} size="xsmall">
              Odkaz (https://…)
            </Label>
            <Input
              id={`btn-url-${block.uid}`}
              value={block.url}
              onChange={(event) =>
                onChange({ ...block, url: event.target.value })
              }
              placeholder="https://keramickazahrada.cz/cz/store"
            />
          </div>
        </div>
      )}

      {block.type === "product" &&
        (block.product ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="bg-ui-bg-subtle flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border">
                {block.product.thumbnail ? (
                  <img
                    src={block.product.thumbnail}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="text-ui-fg-muted text-xs">
                    {block.product.title.slice(0, 1).toLocaleUpperCase("cs")}
                  </span>
                )}
              </span>
              <div className="min-w-0">
                <Text size="small" weight="plus" className="truncate">
                  {block.product.title}
                </Text>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {block.product.price_text ?? "bez ceny"} · odkaz povede na
                  stránku produktu
                </Text>
              </div>
            </div>
            <Button
              size="small"
              variant="secondary"
              onClick={() => onChange({ ...block, product: null })}
            >
              Vyměnit
            </Button>
          </div>
        ) : (
          <ProductPicker
            onPick={(snapshot) => onChange({ ...block, product: snapshot })}
          />
        ))}

      {block.type === "image" && (
        <ImageBlockEditor block={block} onChange={onChange} />
      )}

      {block.type === "catalog" && (
        <div className="flex flex-col gap-y-2">
          {block.products.length > 0 && (
            <div className="flex flex-col gap-y-1.5">
              {block.products.map((product, productIndex) => (
                <div
                  key={product.product_id}
                  className="border-ui-border-base flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {product.thumbnail ? (
                      <img
                        src={product.thumbnail}
                        alt=""
                        className="size-8 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <span className="bg-ui-bg-subtle size-8 shrink-0 rounded" />
                    )}
                    <Text size="small" className="truncate">
                      {product.title}
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-muted shrink-0">
                      {product.price_text ?? ""}
                    </Text>
                  </div>
                  <IconButton
                    size="small"
                    variant="transparent"
                    aria-label={`Odebrat ${product.title} z katalogu`}
                    onClick={() =>
                      onChange({
                        ...block,
                        products: block.products.filter(
                          (_, i) => i !== productIndex
                        ),
                      })
                    }
                  >
                    <XMarkMini />
                  </IconButton>
                </div>
              ))}
            </div>
          )}
          {block.products.length < MAX_CATALOG_PRODUCTS ? (
            <ProductPicker
              onPick={(snapshot) =>
                onChange({
                  ...block,
                  products: block.products.some(
                    (product) => product.product_id === snapshot.product_id
                  )
                    ? block.products
                    : [...block.products, snapshot],
                })
              }
            />
          ) : (
            <Text size="xsmall" className="text-ui-fg-subtle">
              Katalog je plný — víc než {MAX_CATALOG_PRODUCTS} kusů už v
              e-mailu nevypadá jako pozvánka, ale jako celý obchod.
            </Text>
          )}
          <Text size="xsmall" className="text-ui-fg-subtle">
            Kusy se v e-mailu poskládají do mřížky po dvou, každý s fotkou,
            cenou a odkazem na svou stránku.
          </Text>
        </div>
      )}

      {block.type === "promo" && (
        <div className="flex flex-col gap-y-2">
          <div>
            <Label htmlFor={`promo-title-${block.uid}`} size="xsmall">
              Titulek akce
            </Label>
            <Input
              id={`promo-title-${block.uid}`}
              value={block.title}
              onChange={(event) =>
                onChange({ ...block, title: event.target.value })
              }
              placeholder="Např. Podzimní sleva 15 % na všechny hrnky"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label htmlFor={`promo-code-${block.uid}`} size="xsmall">
                Slevový kód (nepovinné)
              </Label>
              <Input
                id={`promo-code-${block.uid}`}
                value={block.code}
                onChange={(event) =>
                  onChange({ ...block, code: event.target.value })
                }
                placeholder="PODZIM15"
              />
            </div>
            <div>
              <Label htmlFor={`promo-note-${block.uid}`} size="xsmall">
                Podmínky jednou větou (nepovinné)
              </Label>
              <Input
                id={`promo-note-${block.uid}`}
                value={block.note}
                onChange={(event) =>
                  onChange({ ...block, note: event.target.value })
                }
                placeholder="Platí do konce října."
              />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label htmlFor={`promo-label-${block.uid}`} size="xsmall">
                Text tlačítka (nepovinné)
              </Label>
              <Input
                id={`promo-label-${block.uid}`}
                value={block.label}
                onChange={(event) =>
                  onChange({ ...block, label: event.target.value })
                }
                placeholder="Vybrat hrnek"
              />
            </div>
            <div>
              <Label htmlFor={`promo-url-${block.uid}`} size="xsmall">
                Kam tlačítko vede
              </Label>
              <Input
                id={`promo-url-${block.uid}`}
                value={block.url}
                onChange={(event) =>
                  onChange({ ...block, url: event.target.value })
                }
                placeholder="https://…"
                type="url"
              />
            </div>
          </div>
          <Text size="xsmall" className="text-ui-fg-subtle">
            Akce se zarámuje a vycentruje; kód dostane vlastní čárkovaný
            rámeček, aby se dal snadno opsat. Samotný kód slevu nevyrobí —
            založte ji i ve Slevách, ať u pokladny opravdu platí.
          </Text>
        </div>
      )}

      {block.type === "divider" && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          Tenká vodorovná linka mezi částmi e-mailu.
        </Text>
      )}
    </div>
  </section>
);

/** One block, made sortable — the ⠿ handle is the drag activator. */
const SortableBlockCard = (props: {
  block: EditorBlock;
  index: number;
  total: number;
  onChange: (next: EditorBlock) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.block.uid });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clx(isDragging && "relative z-10 opacity-75")}
    >
      <BlockCard
        {...props}
        dragHandle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className="text-ui-fg-muted hover:bg-ui-bg-base-hover hover:text-ui-fg-base -ml-1 cursor-grab rounded p-1 active:cursor-grabbing"
            // dnd-kit's default roledescription is the English "sortable".
            aria-roledescription="přesouvatelný blok"
            aria-label={`Přesunout blok ${BLOCK_LABELS[props.block.type]}`}
          >
            <DotsSix />
          </button>
        }
      />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Napsat                                                              */
/* ------------------------------------------------------------------ */

type SaveState = "idle" | "saving" | "saved" | "error";

const SAVE_STATE_TEXT: Record<SaveState, string> = {
  idle: "",
  saving: "Ukládám…",
  saved: "Uloženo ✓",
  error: "Uložení se nepovedlo — s další změnou to zkusím znovu",
};

const ComposeTab = ({
  subscribers,
}: {
  subscribers: SubscribersResponse | undefined;
}) => {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [blocks, setBlocks] = useState<EditorBlock[]>(defaultBlocks);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [testEmail, setTestEmail] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedTick, setSavedTick] = useState(0);
  const [deleteDraftTarget, setDeleteDraftTarget] = useState<DraftRow | null>(
    null
  );
  const lastSavedJson = useRef<string>("");
  /**
   * Which composer "session" (draft being edited) the world is in. Bumped by
   * `resetComposer` and `openDraft`; an autosave that started under an older
   * session must never apply its result — otherwise a save still in flight
   * when she clicks „Pokračovat" would stamp the *previous* draft's id onto
   * the newly opened one and route her next keystrokes into the wrong row.
   */
  const sessionRef = useRef(0);
  /** Synchronous "a save is in flight" truth + the promise to await it. */
  const savingRef = useRef(false);
  const pendingSave = useRef<Promise<void> | null>(null);

  const unsubscribeReady = subscribers?.unsubscribe_ready ?? false;
  const confirmedCount = subscribers?.counts.confirmed ?? 0;

  // Prefill „poslat test" with the signed-in admin's address.
  const { data: me } = useQuery({
    queryKey: ["newsletter-me"],
    queryFn: () =>
      sdk.client.fetch<{ user?: { email?: string } }>("/admin/users/me"),
    staleTime: Infinity,
  });
  useEffect(() => {
    if (!testEmail && me?.user?.email) {
      setTestEmail(me.user.email);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  const problems = compositionProblems(subject, blocks);

  const preview = useMutation({
    mutationFn: (payload: {
      subject: string;
      preheader?: string;
      blocks: Record<string, unknown>[];
    }) =>
      sdk.client.fetch<{ html: string }>("/admin/newsletter/preview", {
        method: "POST",
        body: payload,
      }),
    onSuccess: (result) => setPreviewHtml(result.html),
  });

  // Live preview: re-render the real e-mail HTML a moment after she stops
  // typing. The mutation reference is stable enough for this effect.
  const blocksJson = JSON.stringify(toApiBlocks(blocks));
  const previewMutate = useRef(preview.mutate);
  previewMutate.current = preview.mutate;
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      previewMutate.current({
        subject,
        preheader: preheader || undefined,
        blocks: JSON.parse(blocksJson),
      });
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [subject, preheader, blocksJson]);

  /* ---------------- drafts: list, autosave, load, delete ---------------- */

  const draftsQuery = useQuery<{ drafts: DraftRow[] }>({
    queryKey: ["newsletter-drafts"],
    queryFn: () => sdk.client.fetch("/admin/newsletter/drafts"),
  });

  const saveDraft = useMutation({
    mutationFn: (payload: {
      id?: string;
      subject: string;
      preheader?: string;
      blocks: Record<string, unknown>[];
    }) =>
      sdk.client.fetch<{ draft: DraftRow }>("/admin/newsletter/drafts", {
        method: "POST",
        body: payload,
      }),
  });

  const draftJson = JSON.stringify({
    subject,
    preheader,
    blocks: toDraftBlocks(blocks),
  });
  const blankComposition = isBlankComposition(subject, preheader, blocks);

  const persistDraft = async () => {
    if (savingRef.current) {
      return;
    }
    const payloadJson = JSON.stringify({
      subject,
      preheader,
      blocks: toDraftBlocks(blocks),
    });
    if (payloadJson === lastSavedJson.current) {
      return;
    }
    const session = sessionRef.current;
    savingRef.current = true;
    setSaveState("saving");
    const task = (async () => {
      try {
        const result = await saveDraft.mutateAsync({
          id: draftId ?? undefined,
          subject,
          preheader: preheader || undefined,
          blocks: toDraftBlocks(blocks),
        });
        if (session !== sessionRef.current) {
          // The composer moved on to another draft while this save was in
          // flight — the result belongs to a world that no longer exists.
          return;
        }
        lastSavedJson.current = payloadJson;
        setDraftId(result.draft.id);
        setSaveState("saved");
        void queryClient.invalidateQueries({ queryKey: ["newsletter-drafts"] });
      } catch (error) {
        if (session !== sessionRef.current) {
          return;
        }
        // Sent or deleted from another tab: the next change starts a new draft.
        if (error instanceof Error && /neexistuje/.test(error.message)) {
          setDraftId(null);
        }
        setSaveState("error");
      } finally {
        savingRef.current = false;
        // Re-run the autosave effect: she may have typed during the request.
        setSavedTick((tick) => tick + 1);
      }
    })();
    pendingSave.current = task;
    await task;
  };
  const persistRef = useRef(persistDraft);
  persistRef.current = persistDraft;

  const sendPending = useRef(false);
  useEffect(() => {
    if (sendPending.current) return;
    if (!draftId && blankComposition) return;
    if (draftJson === lastSavedJson.current) return;
    const timeout = window.setTimeout(() => {
      void persistRef.current();
    }, 2000);
    return () => window.clearTimeout(timeout);
  }, [draftJson, draftId, blankComposition, savedTick]);

  const resetComposer = () => {
    sessionRef.current += 1;
    setSubject("");
    setPreheader("");
    setBlocks(defaultBlocks());
    setPreviewHtml("");
    setDraftId(null);
    lastSavedJson.current = "";
    setSaveState("idle");
  };

  const openDraft = async (row: DraftRow) => {
    // Whatever is in the composer right now is saved first — switching
    // drafts must never cost her the two sentences she just wrote. An
    // in-flight autosave is awaited so the flush below actually flushes
    // (and its result lands before the session changes underneath it).
    await pendingSave.current?.catch(() => undefined);
    if (draftId || !blankComposition) {
      await persistRef.current();
      await pendingSave.current?.catch(() => undefined);
    }
    sessionRef.current += 1;
    const loaded = fromDraftBlocks(row.blocks);
    const nextBlocks = loaded.length ? loaded : defaultBlocks();
    setSubject(row.subject ?? "");
    setPreheader(row.preheader ?? "");
    setBlocks(nextBlocks);
    setDraftId(row.id);
    lastSavedJson.current = JSON.stringify({
      subject: row.subject ?? "",
      preheader: row.preheader ?? "",
      blocks: toDraftBlocks(nextBlocks),
    });
    setSaveState("saved");
  };

  const deleteDraft = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch<{ ok: boolean }>(`/admin/newsletter/drafts/${id}`, {
        method: "DELETE",
      }),
    onSuccess: async (_result, id) => {
      setDeleteDraftTarget(null);
      if (id === draftId) {
        resetComposer();
      }
      toast.success("Rozepsaný e-mail smazán.");
      await queryClient.invalidateQueries({ queryKey: ["newsletter-drafts"] });
    },
    onError: (error) => {
      setDeleteDraftTarget(null);
      toast.error(
        error instanceof Error ? error.message : "Smazání se nepodařilo."
      );
      void queryClient.invalidateQueries({ queryKey: ["newsletter-drafts"] });
    },
  });

  /* ---------------- test send & campaign send ---------------- */

  const sendTest = useMutation({
    mutationFn: () =>
      sdk.client.fetch("/admin/newsletter/test", {
        method: "POST",
        body: {
          to: testEmail.trim(),
          subject: subject.trim(),
          preheader: preheader || undefined,
          blocks: toApiBlocks(blocks),
        },
      }),
    onSuccess: () => toast.success(`Zkušební e-mail odeslán na ${testEmail.trim()}.`),
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Zkušební e-mail se nepodařilo odeslat."
      ),
  });

  const sendCampaign = useMutation({
    mutationFn: () => {
      sendPending.current = true;
      return sdk.client.fetch<{ ok: boolean; sent: number; failed?: number }>(
        "/admin/newsletter/campaigns",
        {
          method: "POST",
          body: {
            subject: subject.trim(),
            preheader: preheader || undefined,
            blocks: toApiBlocks(blocks),
            ...(draftId ? { draft_id: draftId } : {}),
          },
        }
      );
    },
    onSuccess: async (result) => {
      sendPending.current = false;
      setConfirmOpen(false);
      toast.success(`Kampaň odeslána ${czechRecipients(result.sent)}.`);
      if (result.failed) {
        toast.warning(
          `${result.failed} ${result.failed === 1 ? "adresa se nepodařila" : result.failed <= 4 ? "adresy se nepodařily" : "adres se nepodařilo"} doručit.`
        );
      }
      resetComposer();
      await queryClient.invalidateQueries({ queryKey: ["newsletter-campaigns"] });
      await queryClient.invalidateQueries({ queryKey: ["newsletter-subscribers"] });
      await queryClient.invalidateQueries({ queryKey: ["newsletter-drafts"] });
    },
    onError: (error) => {
      sendPending.current = false;
      setConfirmOpen(false);
      toast.error(
        error instanceof Error ? error.message : "Kampaň se nepodařilo odeslat."
      );
    },
  });

  /* ---------------- blocks: add & drag ---------------- */

  const addBlock = (type: EditorBlock["type"]) => {
    const uid = newUid();
    const block: EditorBlock =
      type === "heading"
        ? { uid, type, text: "", level: 2 }
        : type === "paragraph"
          ? { uid, type, runs: [] }
          : type === "button"
            ? { uid, type, label: "", url: "" }
            : type === "product"
              ? { uid, type, product: null }
              : type === "image"
                ? { uid, type, src: "", alt: "", link: "" }
                : type === "catalog"
                  ? { uid, type, products: [] }
                  : type === "promo"
                    ? { uid, type, title: "", code: "", note: "", label: "", url: "" }
                    : { uid, type: "divider" };
    setBlocks((current) => [...current, block]);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setBlocks((current) => {
        const from = current.findIndex((block) => block.uid === active.id);
        const to = current.findIndex((block) => block.uid === over.id);
        if (from < 0 || to < 0) return current;
        return arrayMove(current, from, to);
      });
    }
  };

  const drafts = (draftsQuery.data?.drafts ?? []).filter(
    (row) => row.id !== draftId
  );

  const canSend =
    !problems.length && unsubscribeReady && !sendCampaign.isPending;

  return (
    <div className="grid gap-6 px-6 py-5 xl:grid-cols-2">
      {/* Jak to funguje — the whole flow in one line, before any field. */}
      <div className="bg-ui-bg-subtle rounded-lg border px-4 py-3 xl:col-span-2">
        <Text size="small">
          <span className="font-medium">Jak na to:</span> 1. poskládejte
          zprávu z bloků · 2. vpravo průběžně vidíte, jak bude vypadat ·
          3. pošlete si zkušební e-mail na sebe · 4. teprve pak odešlete všem
          potvrzeným odběratelům. Rozepsaná zpráva se sama průběžně ukládá.
        </Text>
      </div>

      {/* Rozepsané e-maily */}
      {drafts.length > 0 && (
        <div className="rounded-lg border xl:col-span-2">
          <header className="border-b px-4 py-2.5">
            <Text size="small" weight="plus">
              Rozepsané e-maily
            </Text>
          </header>
          <div className="divide-y">
            {drafts.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <Text size="small" className="truncate">
                    {row.subject?.trim() || "Bez předmětu"}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    naposledy upraveno {formatDateTime(row.updated_at)}
                  </Text>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={() => void openDraft(row)}
                  >
                    Pokračovat
                  </Button>
                  <Button
                    size="small"
                    variant="transparent"
                    onClick={() => setDeleteDraftTarget(row)}
                  >
                    Smazat
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Prompt
        open={!!deleteDraftTarget}
        onOpenChange={(open) => !open && setDeleteDraftTarget(null)}
      >
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Smazat rozepsaný e-mail?</Prompt.Title>
            <Prompt.Description>
              „{deleteDraftTarget?.subject?.trim() || "Bez předmětu"}" zmizí
              nadobro. Odeslaných kampaní se to nijak nedotkne.
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel>Zrušit</Prompt.Cancel>
            <Prompt.Action
              disabled={deleteDraft.isPending}
              onClick={() =>
                deleteDraftTarget && deleteDraft.mutate(deleteDraftTarget.id)
              }
            >
              Smazat
            </Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>

      {/* Editor */}
      <div className="flex flex-col gap-y-4">
        <div className="flex items-center justify-between">
          <Text size="small" weight="plus">
            Obsah e-mailu
          </Text>
          <Text
            size="xsmall"
            aria-live="polite"
            className={clx(
              "text-ui-fg-muted",
              saveState === "error" && "text-ui-tag-orange-text"
            )}
          >
            {SAVE_STATE_TEXT[saveState]}
          </Text>
        </div>

        <div>
          <Label htmlFor="nl-subject">Předmět</Label>
          <Input
            id="nl-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Např. Nové objekty z pece"
          />
        </div>
        <div>
          <Label htmlFor="nl-preheader">
            Náhledová věta{" "}
            <span className="text-ui-fg-muted font-normal">
              (zobrazí se v doručené poště za předmětem)
            </span>
          </Label>
          <Input
            id="nl-preheader"
            value={preheader}
            onChange={(event) => setPreheader(event.target.value)}
            placeholder="Krátká věta, která doplní předmět."
          />
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          accessibility={{
            screenReaderInstructions: {
              draggable:
                "Blok zvednete mezerníkem nebo klávesou Enter. Šipkami nahoru a dolů ho přesunete, mezerníkem položíte, klávesou Escape přesun zrušíte.",
            },
            announcements: {
              onDragStart: () =>
                "Blok zvednut. Šipkami ho přesuňte, mezerníkem položte.",
              onDragOver: () => undefined,
              onDragEnd: () => "Blok položen.",
              onDragCancel: () => "Přesun zrušen.",
            },
          }}
        >
          <SortableContext
            items={blocks.map((block) => block.uid)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-y-3">
              {blocks.map((block, index) => (
                <SortableBlockCard
                  key={block.uid}
                  block={block}
                  index={index}
                  total={blocks.length}
                  onChange={(next) =>
                    setBlocks((current) =>
                      current.map((candidate) =>
                        candidate.uid === block.uid ? next : candidate
                      )
                    )
                  }
                  onMove={(direction) =>
                    setBlocks((current) => {
                      const from = current.findIndex(
                        (candidate) => candidate.uid === block.uid
                      );
                      const to = from + direction;
                      if (to < 0 || to >= current.length) return current;
                      const next = [...current];
                      const [moved] = next.splice(from, 1);
                      next.splice(to, 0, moved);
                      return next;
                    })
                  }
                  onDelete={() =>
                    setBlocks((current) =>
                      current.filter((candidate) => candidate.uid !== block.uid)
                    )
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <Text size="xsmall" className="text-ui-fg-muted">
          Bloky přeuspořádáte tažením za úchyt ⠿ (jde to i klávesnicí — na
          úchytu stiskněte mezerník a šipky), nebo šipkami v rohu bloku.
        </Text>

        <div className="flex flex-wrap items-center gap-2">
          <Text size="xsmall" className="text-ui-fg-muted">
            Přidat část e-mailu:
          </Text>
          {(
            [
              "heading",
              "paragraph",
              "image",
              "button",
              "product",
              "catalog",
              "promo",
              "divider",
            ] as const
          ).map((type) => (
            <Button
              key={type}
              size="small"
              variant="secondary"
              onClick={() => addBlock(type)}
            >
              + {BLOCK_LABELS[type]}
            </Button>
          ))}
        </div>

        <Text size="xsmall" className="text-ui-fg-subtle">
          Patičku s odhlašovacím odkazem doplní každý e-mail sám — vyžaduje ji
          zákon, vy ji psát nemusíte. V náhledu vpravo ji uvidíte.
        </Text>

        {/* Test send */}
        <div className="bg-ui-bg-subtle flex flex-col gap-y-2 rounded-lg border p-3">
          <Text size="small" weight="plus">
            Zkušební e-mail
          </Text>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={testEmail}
              onChange={(event) => setTestEmail(event.target.value)}
              placeholder="vas@email.cz"
              size="small"
              className="max-w-64"
              aria-label="Adresa pro zkušební e-mail"
            />
            <Button
              size="small"
              variant="secondary"
              isLoading={sendTest.isPending}
              disabled={
                !!problems.length || !/\S+@\S+\.\S+/.test(testEmail.trim())
              }
              onClick={() => sendTest.mutate()}
            >
              Poslat test na můj e-mail
            </Button>
          </div>
          <Text size="xsmall" className="text-ui-fg-subtle">
            Odešle jeden skutečný e-mail jen na tuto adresu — kampani se nic
            neodečítá.
          </Text>
        </div>

        {/* Problems + send */}
        {!!problems.length && (
          <div className="flex flex-col gap-y-1">
            {problems.map((problem) => (
              <Text key={problem} size="xsmall" className="text-ui-fg-subtle">
                · {problem}
              </Text>
            ))}
          </div>
        )}

        {subscribers && !unsubscribeReady && (
          <Text size="xsmall" className="text-ui-tag-red-text">
            Odeslání je zatím vypnuté: e-shopu chybí nastavení veřejné adresy,
            takže by odhlašovací odkaz v patičce nefungoval. Bez funkčního
            odhlášení se newsletter posílat nesmí — napište správci webu, dá to
            do pořádku.
          </Text>
        )}

        <div>
          <Prompt open={confirmOpen} onOpenChange={setConfirmOpen}>
            <Prompt.Trigger asChild>
              <Button size="base" disabled={!canSend}>
                Odeslat kampaň
              </Button>
            </Prompt.Trigger>
            <Prompt.Content>
              <Prompt.Header>
                <Prompt.Title>Odeslat kampaň?</Prompt.Title>
                <Prompt.Description>
                  E-mail „{subject.trim() || "bez předmětu"}" odejde{" "}
                  {czechRecipients(confirmedCount)} s potvrzeným odběrem.
                  Odeslanou kampaň nejde vzít zpět.
                </Prompt.Description>
              </Prompt.Header>
              <Prompt.Footer>
                <Prompt.Cancel>Zrušit</Prompt.Cancel>
                <Prompt.Action
                  disabled={sendCampaign.isPending}
                  onClick={() => sendCampaign.mutate()}
                >
                  Odeslat
                </Prompt.Action>
              </Prompt.Footer>
            </Prompt.Content>
          </Prompt>
          {confirmedCount === 0 && (
            <Text size="xsmall" className="text-ui-fg-subtle mt-2">
              Zatím není komu poslat — žádný odběratel nemá potvrzený odběr.
            </Text>
          )}
        </div>
      </div>

      {/* Live preview */}
      <div className="flex flex-col gap-y-2">
        <div className="flex items-center justify-between">
          <Text size="small" weight="plus">
            Náhled e-mailu
          </Text>
          <Text size="xsmall" className="text-ui-fg-muted">
            {preview.isPending
              ? "Obnovuji…"
              : "Takhle přesně e-mail dorazí do schránky"}
          </Text>
        </div>
        {previewHtml ? (
          <iframe
            title="Náhled newsletteru"
            srcDoc={previewHtml}
            sandbox=""
            className="bg-ui-bg-base h-[680px] w-full rounded-lg border"
          />
        ) : (
          <Skeleton className="h-[680px] w-full rounded-lg" />
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Historie + statistiky                                               */
/* ------------------------------------------------------------------ */

/**
 * One measure („how far did the mail get"), one hue: the bars share the
 * interactive fill and identity lives in the row labels — values stay in
 * text tokens beside them.
 */
const StatBar = ({
  label,
  value,
  total,
  totalLabel,
}: {
  label: string;
  value: number;
  /** What 100 % means; null renders the count without a bar. */
  total: number | null;
  totalLabel?: string;
}) => {
  const pct =
    total && total > 0 ? Math.round((value / total) * 100) : null;
  return (
    <div className="grid grid-cols-[130px_minmax(0,1fr)_110px] items-center gap-3">
      <Text size="xsmall" className="text-ui-fg-subtle">
        {label}
      </Text>
      <div
        className="bg-ui-bg-subtle h-1.5 overflow-hidden rounded-full"
        role="img"
        aria-label={
          pct === null
            ? `${label}: ${value}`
            : `${label}: ${value} (${pct} % ${totalLabel ?? ""})`.trim()
        }
      >
        {pct !== null && (
          <div
            className="bg-ui-fg-interactive h-full rounded-full"
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        )}
      </div>
      <Text size="xsmall" className="text-right tabular-nums">
        {value}
        {pct !== null ? ` (${pct} %)` : ""}
      </Text>
    </div>
  );
};

const CampaignStats = ({ campaignKey }: { campaignKey: string }) => {
  const { data, isLoading, isError } = useQuery<CampaignStatsResponse>({
    queryKey: ["newsletter-campaign-stats", campaignKey],
    queryFn: () =>
      sdk.client.fetch(
        `/admin/newsletter/campaigns/${encodeURIComponent(campaignKey)}/stats`
      ),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="px-6 pb-4">
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <Text size="xsmall" className="text-ui-fg-subtle px-6 pb-4">
        Čísla se nepodařilo načíst. Zkuste to za chvíli znovu.
      </Text>
    );
  }

  const { stats } = data;

  if (!data.measurement_ready) {
    return (
      <Text size="xsmall" className="text-ui-fg-subtle px-6 pb-4">
        Měření otevření a prokliků zatím není propojené. Požádejte správce
        webu o propojení s poštovní službou — čísla se pak začnou sbírat u
        nově odeslaných kampaní.
      </Text>
    );
  }

  const anyEvent =
    stats.delivered + stats.opened + stats.clicked + stats.bounced + stats.complained >
    0;

  if (!anyEvent) {
    return (
      <Text size="xsmall" className="text-ui-fg-subtle px-6 pb-4">
        Čísla se objeví, jakmile poštovní služba začne hlásit doručení — bývá
        to pár minut až hodin po odeslání.
      </Text>
    );
  }

  return (
    <div className="flex flex-col gap-y-4 px-6 pb-5">
      <div className="flex flex-col gap-y-2">
        <StatBar label="Odesláno" value={stats.sent} total={null} />
        <StatBar
          label="Doručeno"
          value={stats.delivered}
          total={stats.sent || null}
          totalLabel="z odeslaných"
        />
        <StatBar
          label="Otevřeno"
          value={stats.opened}
          total={stats.delivered || null}
          totalLabel="z doručených"
        />
        <StatBar
          label="Kliknuto"
          value={stats.clicked}
          total={stats.delivered || null}
          totalLabel="z doručených"
        />
        <StatBar
          label="Nedoručitelné"
          value={stats.bounced}
          total={stats.sent || null}
          totalLabel="z odeslaných"
        />
        <StatBar
          label="Stížnosti na spam"
          value={stats.complained}
          total={stats.sent || null}
          totalLabel="z odeslaných"
        />
      </div>
      <Text size="xsmall" className="text-ui-fg-muted">
        Otevření a kliknutí se počítají podle adres — kdo e-mail otevřel
        pětkrát, počítá se jednou. Ne každé otevření jde poznat, skutečná
        čísla proto bývají o něco vyšší.
      </Text>

      {stats.links.length > 0 && (
        <div className="flex flex-col gap-y-1.5">
          <Text size="xsmall" weight="plus">
            Prokliky podle odkazu
          </Text>
          {stats.links.map((link) => (
            <div
              key={link.url}
              className="grid grid-cols-[minmax(0,1fr)_170px] items-center gap-3"
            >
              <Text size="xsmall" className="truncate" title={link.url}>
                {link.url}
              </Text>
              <Text size="xsmall" className="text-ui-fg-subtle text-right tabular-nums">
                {link.clicks}× · {link.addresses}{" "}
                {link.addresses === 1
                  ? "adresa"
                  : link.addresses <= 4
                    ? "adresy"
                    : "adres"}
              </Text>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const HistoryTab = ({ campaigns }: { campaigns: CampaignRow[] }) => {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div className="divide-y">
      {!campaigns.length && (
        <EmptyState
          title="Zatím žádná kampaň"
          description="První odeslaná kampaň se objeví tady — s datem, počtem příjemců a čísly o doručení."
        />
      )}
      {campaigns.map((campaign) => {
        const recipients = campaign.recipients ?? 0;
        const isOpen = openKey === campaign.campaign_key;
        return (
          <div key={campaign.id}>
            <button
              type="button"
              onClick={() =>
                setOpenKey(isOpen ? null : campaign.campaign_key)
              }
              aria-expanded={isOpen}
              className="hover:bg-ui-bg-base-hover grid w-full gap-2 px-6 py-4 text-left lg:grid-cols-[minmax(0,1.6fr)_220px_minmax(0,1fr)] lg:items-center"
            >
              <div className="min-w-0">
                <Text size="small" weight="plus" className="truncate">
                  {campaign.subject}
                </Text>
                {campaign.preheader && (
                  <Text size="xsmall" className="text-ui-fg-subtle mt-0.5 truncate">
                    {campaign.preheader}
                  </Text>
                )}
              </div>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {formatDateTime(campaign.sent_at)}
              </Text>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {recipients === 1
                  ? "1 příjemce"
                  : recipients >= 2 && recipients <= 4
                    ? `${recipients} příjemci`
                    : `${recipients} příjemců`}
                <span className="text-ui-fg-muted">
                  {" "}
                  · {isOpen ? "skrýt čísla" : "zobrazit čísla"}
                </span>
              </Text>
            </button>
            {isOpen && <CampaignStats campaignKey={campaign.campaign_key} />}
          </div>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ */

const tabs = [
  { key: "napsat", label: "Napsat" },
  { key: "odberatele", label: "Odběratelé" },
  { key: "historie", label: "Historie" },
];

const NewsletterInner = () => {
  const [active, setActive] = useState("napsat");

  const subscribersQuery = useQuery<SubscribersResponse>({
    queryKey: ["newsletter-subscribers"],
    queryFn: () => sdk.client.fetch("/admin/newsletter/subscribers"),
    refetchOnWindowFocus: true,
  });

  const campaignsQuery = useQuery<{ campaigns: CampaignRow[] }>({
    queryKey: ["newsletter-campaigns"],
    queryFn: () => sdk.client.fetch("/admin/newsletter/campaigns"),
  });

  return (
    <Container className="divide-y p-0">
      <Toaster />
      <header className="flex flex-wrap items-start justify-between gap-3 px-6 pb-4 pt-6">
        <div>
          <Heading>Newsletter</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
            Napište zprávu z bloků, pošlete si zkušební e-mail a potom kampaň
            všem potvrzeným odběratelům. Odběratelé se hlásí formulářem
            v patičce e-shopu a odběr potvrzují kliknutím v e-mailu.
          </Text>
        </div>
      </header>

      <SubTabs
        tabs={tabs.map((tab) => ({
          ...tab,
          count:
            tab.key === "odberatele"
              ? subscribersQuery.data?.total
              : tab.key === "historie"
                ? campaignsQuery.data?.campaigns.length
                : undefined,
        }))}
        active={active}
        onSelect={setActive}
      />

      {active === "napsat" && (
        <ComposeTab subscribers={subscribersQuery.data} />
      )}

      {active === "odberatele" &&
        (subscribersQuery.isLoading ? (
          <div className="flex flex-col gap-y-3 px-6 py-5">
            <Skeleton className="h-12 rounded-lg" />
            <Skeleton className="h-12 rounded-lg" />
          </div>
        ) : subscribersQuery.isError || !subscribersQuery.data ? (
          <EmptyState
            title="Odběratele se nepodařilo načíst"
            description="Zkuste stránku obnovit."
          />
        ) : (
          <SubscribersTab data={subscribersQuery.data} />
        ))}

      {active === "historie" &&
        (campaignsQuery.isLoading ? (
          <div className="flex flex-col gap-y-3 px-6 py-5">
            <Skeleton className="h-12 rounded-lg" />
          </div>
        ) : (
          <HistoryTab campaigns={campaignsQuery.data?.campaigns ?? []} />
        ))}
    </Container>
  );
};

const queryClient = new QueryClient();

const NewsletterPage = () => (
  <QueryClientProvider client={queryClient}>
    <NewsletterInner />
  </QueryClientProvider>
);

export const config = defineRouteConfig({
  label: "Newsletter",
  icon: EnvelopeSolid,
  rank: 80,
});

export default NewsletterPage;
