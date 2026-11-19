import { Button, Container, Heading, Input, Label, Text, toast } from "@medusajs/ui";
import {
  QueryClientProvider,
  useMutation,

} from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import CreateBundledProduct from "../../components/create-bundled-product";
import CreateDamagedProduct from "../../components/create-damaged-product";
import { sdk } from "../../lib/sdk";
import { ClassificationPicker } from "../../components/classification-picker";
import { NavodTip } from "../../components/navod-tip";
import { adminQueryClient } from "../../lib/query-client"
import { ceskaChyba } from "../../lib/ceska-chyba";

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
    // Jen poškozený kus, samostatně — ne „výprodej" (Matěj, 3. 11. 2026).
    title: "Poškozený kus",
    description:
      "Kus s vadou, prodává se levněji. Až se prodá, sami ho schováme a odebereme z akcí.",
    defaultName: "Poškozený kus",
    toast: "Poškozený kus založen.",
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

/*
 * Profil dopravy hned při založení. Bez něj objednávka spadne až po
 * zaplacení. Subscriber default-shipping-profile ho doplní taky, ale až
 * z události po vzniku; tady je kus v pořádku od první vteřiny. Výběr je
 * stejný jako v lib/shipping-profile-default.ts (výchozí, jinak jediný);
 * když se určit nedá, nepošle se nic a zbytek nechá na subscriberu.
 */
const defaultShippingProfileId = async (): Promise<string | undefined> => {
  try {
    const { shipping_profiles } = await sdk.client.fetch<{
      shipping_profiles: { id: string; type?: string | null }[];
    }>("/admin/shipping-profiles?limit=100");
    const vychozi = shipping_profiles.find((profile) => profile.type === "default");
    if (vychozi) return vychozi.id;
    return shipping_profiles.length === 1 ? shipping_profiles[0].id : undefined;
  } catch {
    return undefined;
  }
};

/** Výchozí prodejní kanál obchodu — ten, ve kterém web hledá výrobky. */
const defaultSalesChannelId = async (): Promise<string | undefined> => {
  try {
    const { stores } = await sdk.client.fetch<{
      stores: { default_sales_channel_id?: string | null }[];
    }>("/admin/stores?fields=id,default_sales_channel_id");
    return stores?.[0]?.default_sales_channel_id ?? undefined;
  } catch {
    return undefined;
  }
};

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
  /*
   * Zařazení a cena už při založení (18. 11. 2026). Dřív se zakládal jen
   * název: výrobek byl „bez zařazení", bez ceny a bez kanálu obchodu —
   * po publikování ho obchod nenašel („Stránka nenalezena") a v adminu ho
   * Lucie v kategorii neviděla. Teď se vybere kolekce, kategorie a cena
   * hned tady a výrobek vznikne rovnou v kanálu obchodu.
   */
  const [collectionId, setCollectionId] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [price, setPrice] = useState("");
  const priceNumber = Number(price.replace(/\s/g, "").replace(",", "."));
  const priceOk = price.trim() === "" || (Number.isFinite(priceNumber) && priceNumber > 0);

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
      const [shippingProfileId, shopChannelId] = await Promise.all([
        defaultShippingProfileId(),
        defaultSalesChannelId(),
      ]);
      const czk = price.trim() && priceOk ? Math.round(priceNumber * 100) / 100 : null;
      const created: any = await sdk.admin.product.create({
        title,
        status: "draft",
        ...(shippingProfileId ? { shipping_profile_id: shippingProfileId } : {}),
        // Kanál obchodu hned — bez něj ho obchod nenajde (pojistkou je i
        // subscriber product-shop-defaults na backendu).
        ...(shopChannelId ? { sales_channels: [{ id: shopChannelId }] } : {}),
        ...(collectionId ? { collection_id: collectionId } : {}),
        ...(categoryIds.length ? { categories: categoryIds.map((id) => ({ id })) } : {}),
        ...(kind === "poskozeny" ? { metadata: { clearance: true } } : {}),
        options: [{ title: "Provedení", values: ["Standardní"] }],
        variants: [
          {
            title: "Standardní",
            // Made to order is never in stock — that is the point, and it
            // keeps the piece out of the sold-out alerts.
            manage_inventory: kind !== "zakazka",
            // Shop default: an ordinary piece keeps selling after sell-out
            // (stock goes negative). Not for zakázka (the production profile
            // owns that flow) and not for a damaged one-off — there is no
            // second piece to make.
            allow_backorder: kind === "produkt" || kind === "balicek",
            options: { Provedení: "Standardní" },
            // The 2.18 validator REQUIRES the field; an empty list is the
            // honest value — a price belongs to Lucia, and the product page's
            // readiness card says „chybí cena" until she fills it. Prefilling
            // 0 Kč instead would be a real price a published product can sell
            // for. Vyplněná cena (Kč) jde rovnou; eura a zloté dopočítá
            // denní úloha z kurzu ČNB.
            prices: czk ? [{ currency_code: "czk", amount: czk }] : [],
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
      navigate(`/produkt/${productId}`);
    },
    onError: (error) => {
      toast.error(
        ceskaChyba(error, "Produkt se nepodařilo založit")
      );
    },
  });

  /* Kategorie je povinná — výrobek „bez zařazení" není v obchodě k nalezení
     v žádné kategorii a v adminu ho Lucie hledala marně. */
  const canCreate =
    selectedCard !== null &&
    selectedCard.id !== "balicek" &&
    name.trim().length > 0 &&
    categoryIds.length > 0 &&
    priceOk &&
    !create.isPending;

  const submit = () => {
    if (!canCreate || !selectedCard) return;
    create.mutate({ kind: selectedCard.id, title: name.trim() });
  };

  return (
    <Container className="divide-y p-0">
      <header className="px-6 pb-4 pt-6">
        <div className="flex items-center gap-1">
          <Heading>Nový produkt</Heading>
          <NavodTip tema="produkty.novy" />
        </div>
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

      {(selectedCard?.id === "produkt" || selectedCard?.id === "zakazka") && (
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
          <div className="w-40">
            <Label htmlFor="new-product-price">
              Cena (Kč){selectedCard.id === "zakazka" ? " — nepovinná" : ""}
            </Label>
            <Input
              id="new-product-price"
              className="mt-1"
              type="text"
              inputMode="decimal"
              value={price}
              aria-invalid={!priceOk}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="např. 580"
            />
          </div>
          <ClassificationPicker
            collectionId={collectionId}
            categoryIds={categoryIds}
            onChange={(next) => {
              setCollectionId(next.collectionId);
              setCategoryIds(next.categoryIds);
            }}
          />
          <div className="flex w-full flex-wrap items-center gap-3">
            <Button
              onClick={submit}
              disabled={!canCreate}
              isLoading={create.isPending}
            >
              Založit a otevřít
            </Button>
            <Text size="xsmall" className="text-ui-fg-subtle">
              {!collectionId
                ? "Vyberte kolekci a kategorii — podle nich výrobek najdete v obchodě i tady."
                : categoryIds.length === 0
                  ? "Vyberte aspoň jednu kategorii."
                  : !priceOk
                    ? "Cena musí být kladné číslo."
                    : "Fotky a případné varianty doplníte hned potom v editoru produktu."}
            </Text>
          </div>
        </div>
      )}

      {selectedCard?.id === "poskozeny" && (
        <div className="px-6 py-5">
          <CreateDamagedProduct
            onCreated={(productId) => {
              if (productId) {
                navigate(`/produkt/${productId}`);
              }
            }}
          />
          <Text size="xsmall" className="text-ui-fg-subtle mt-3">
            Vyberte původní produkt — fotky, popis, materiál a rozměry se
            zkopírují. Dodáte jen akční cenu, fotky vady a popis poškození.
          </Text>
        </div>
      )}

      {selectedCard?.id === "balicek" && (
        <div className="flex flex-wrap items-center gap-3 px-6 py-5">
          <CreateBundledProduct
            trigger={<Button>Sestavit balíček</Button>}
            onCreated={(productId) => {
              if (productId) {
                navigate(`/produkt/${productId}`);
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

    </Container>
  );
};

const queryClient = adminQueryClient;

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
