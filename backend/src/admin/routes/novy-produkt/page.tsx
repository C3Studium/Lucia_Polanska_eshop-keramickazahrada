import { Button, Container, Heading, Input, Label, Text, Toaster, toast } from "@medusajs/ui";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import CreateBundledProduct from "../../components/create-bundled-product";
import { sdk } from "../../lib/sdk";

/**
 * „Nový produkt" — the single front door for creating anything sellable.
 *
 * ## Composition, not a replacement
 *
 * The native product editor is good and already Czech through the locale, so
 * nothing here rebuilds it. What the native flow cannot do is *start* somewhere
 * sensible: the blank create form asks the same twenty questions whether she is
 * listing a vase or commissioning work, and the answers that differ are exactly
 * the ones easy to get wrong — stock tracking on a made-to-order piece, the
 * clearance mark on a damaged one.
 *
 * ## One panel, four kinds
 *
 * Earlier this page split „one piece" from „a product with variants", but the
 * native editor grows variants either way — the split only added a decision
 * that changed nothing. And balíčky pointed at a page with no sidebar entry,
 * which in practice meant they could not be created at all. Now every kind the
 * shop sells starts here: pick a card, name the thing, go. Every „Přidat
 * produkt" button in the admin lands on this panel, so the answer to „where do
 * I create X" never depends on where she is standing.
 *
 * A zakázka gets its production profile switched on immediately (deposit 25 %,
 * 14–42 days — the PATCH route's defaults), so it classifies as a zakázka the
 * moment it exists instead of hiding among běžné until someone remembers the
 * second step.
 *
 * Everything is created as a **draft**. Nothing reaches the shop because
 * somebody clicked a card.
 */

type Kind = "produkt" | "zakazka" | "poskozeny" | "balicek";

type Card = {
  id: Kind;
  title: string;
  description: string;
  defaultName: string;
  toast: string;
};

const cards: Card[] = [
  {
    id: "produkt",
    title: "Produkt",
    description:
      "Váza, hrnek i sada ve třech barvách. Sleduje se skladem, takže po prodeji zmizí z nabídky; varianty (barvy, velikosti) doplníte v dalším kroku.",
    defaultName: "Nový produkt",
    toast: "Produkt založen — teď mu přidejte fotku a cenu.",
  },
  {
    id: "zakazka",
    title: "Na zakázku",
    description:
      "Vyrábí se až po objednávce. Rovnou nastavíme zálohu 25 % a termín 14–42 dní — obojí pak upravíte v Podmínkách.",
    defaultName: "Nová zakázka",
    toast: "Zakázka založena — zálohu a termín upravíte v Podmínkách.",
  },
  {
    id: "poskozeny",
    title: "Výprodej / poškozený kus",
    description:
      "Poslední nebo lehce poškozený kus. Až se prodá, sami ho schováme a odebereme z akcí.",
    defaultName: "Kus ve výprodeji",
    toast: "Kus založen a zařazen do výprodeje poškozených.",
  },
  {
    id: "balicek",
    title: "Balíček",
    description:
      "Několik produktů prodávaných dohromady — třeba snídaňový set. Složení a cenu sestavíte rovnou tady.",
    defaultName: "",
    toast: "",
  },
];

const isKind = (value: string | null): value is Kind =>
  value === "produkt" ||
  value === "zakazka" ||
  value === "poskozeny" ||
  value === "balicek";

const NovyProduktInner = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  /* `?druh=` lets the buttons in Produkty+ preselect the tab's kind, so the
     card she came for is already chosen when the page opens. */
  const preselect = searchParams.get("druh");
  const [selected, setSelected] = useState<Kind | null>(
    isKind(preselect) ? preselect : null
  );
  const [name, setName] = useState(() =>
    isKind(preselect)
      ? cards.find((card) => card.id === preselect)?.defaultName ?? ""
      : ""
  );
  const [nameTouched, setNameTouched] = useState(false);

  const selectedCard = cards.find((card) => card.id === selected) ?? null;

  const choose = (card: Card) => {
    setSelected(card.id);
    // A name she typed survives switching cards; the placeholder does not.
    if (!nameTouched) {
      setName(card.defaultName);
    }
  };

  const create = useMutation({
    mutationFn: async ({ kind, title }: { kind: Kind; title: string }) => {
      const created: any = await sdk.admin.product.create({
        title,
        status: "draft",
        ...(kind === "poskozeny" ? { metadata: { clearance: true } } : {}),
        options: [{ title: "Provedení", values: ["Standardní"] }],
        variants: [
          {
            title: "Standardní",
            // Made to order is never in stock — that is the point, and it
            // keeps the piece out of the sold-out alerts.
            manage_inventory: kind !== "zakazka",
            options: { Provedení: "Standardní" },
          },
        ],
      } as never);

      const productId = created?.product?.id;
      if (!productId) {
        throw new Error("Produkt se založil, ale nevrátil ID.");
      }

      /*
       * The mark that makes it a zakázka. Deliberately a second call: if it
       * fails the product still exists as an ordinary draft, which is
       * recoverable — whereas a rolled-back create would lose everything.
       */
      if (kind === "zakazka") {
        await sdk.client.fetch(`/admin/made-to-order/products/${productId}`, {
          method: "PATCH",
          body: { enabled: true },
        });
      }

      return productId as string;
    },
    onSuccess: (productId, { kind }) => {
      toast.success(cards.find((card) => card.id === kind)?.toast ?? "Založeno.");
      navigate(`/products/${productId}`);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Produkt se nepodařilo založit"
      );
    },
  });

  const canCreate =
    selectedCard !== null &&
    selectedCard.id !== "balicek" &&
    name.trim().length > 0 &&
    !create.isPending;

  const submit = () => {
    if (!canCreate || !selectedCard) return;
    create.mutate({ kind: selectedCard.id, title: name.trim() });
  };

  return (
    <Container className="divide-y p-0">
      <header className="px-6 pb-4 pt-6">
        <Heading>Nový produkt</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
          Vyberte, co zakládáte, a pojmenujte to. Nastavení, které se u toho
          typu skoro nikdy nemění, vyplníme za vás.
        </Text>
      </header>

      <div className="grid gap-3 p-6 sm:grid-cols-2">
        {cards.map((card) => {
          const isActive = selected === card.id;
          return (
            <button
              key={card.id}
              type="button"
              disabled={create.isPending}
              onClick={() => choose(card)}
              className={`transition-fg flex flex-col gap-y-2 rounded-lg px-5 py-5 text-left outline-none focus-visible:shadow-borders-focus disabled:opacity-60 ${
                isActive
                  ? "bg-ui-bg-base-hover shadow-borders-interactive-with-active"
                  : "bg-ui-bg-base shadow-borders-base hover:bg-ui-bg-base-hover"
              }`}
            >
              <Heading level="h2">{card.title}</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                {card.description}
              </Text>
            </button>
          );
        })}
      </div>

      {selectedCard && selectedCard.id !== "balicek" && (
        <div className="flex flex-wrap items-end gap-3 px-6 py-5">
          <div className="min-w-64 flex-1">
            <Label htmlFor="new-product-name">Název</Label>
            <Input
              id="new-product-name"
              className="mt-1"
              value={name}
              autoFocus
              onChange={(event) => {
                setName(event.target.value);
                setNameTouched(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") submit();
              }}
              placeholder={selectedCard.defaultName}
            />
          </div>
          <Button
            onClick={submit}
            disabled={!canCreate}
            isLoading={create.isPending}
          >
            Založit a otevřít
          </Button>
          <Text size="xsmall" className="text-ui-fg-subtle w-full">
            Fotky, cenu a případné varianty doplníte hned potom v editoru
            produktu.
          </Text>
        </div>
      )}

      {selectedCard?.id === "balicek" && (
        <div className="flex flex-wrap items-center gap-3 px-6 py-5">
          <CreateBundledProduct
            trigger={<Button>Sestavit balíček</Button>}
            onCreated={(productId) => {
              if (productId) {
                navigate(`/products/${productId}`);
              }
            }}
          />
          <Text size="xsmall" className="text-ui-fg-subtle">
            Vyberete produkty, jejich počty a jak se má počítat cena — balíček
            se pak v obchodě prodává jako jeden kus.
          </Text>
        </div>
      )}

      <div className="px-6 py-4">
        <Text size="small" className="text-ui-fg-subtle">
          Vše se zakládá jako koncept — do obchodu se nic nedostane, dokud
          produkt sami nezveřejníte.
        </Text>
      </div>

      <Toaster />
    </Container>
  );
};

const queryClient = new QueryClient();

const NovyProduktPage = () => (
  <QueryClientProvider client={queryClient}>
    <NovyProduktInner />
  </QueryClientProvider>
);

/**
 * **No sidebar entry.** Reached from every „Přidat produkt" button — Přehled →
 * Produkty, Produkty+, Rozdělení. The sidebar is down to the places she
 * navigates *to*; everything she works *in* lives behind them.
 */

export default NovyProduktPage;
