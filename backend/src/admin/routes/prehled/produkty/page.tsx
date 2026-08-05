import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Prompt,
  Skeleton,
  Text,
  Toaster,
  toast,
} from "@medusajs/ui";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { EmptyState } from "../../../components/empty-state";
import { SubTabs, WorkTabs } from "../../../components/work-tabs";
import { sdk } from "../../../lib/sdk";

/**
 * Produkty — the catalogue, sorted the way she thinks about it.
 *
 * ## What this is and is not
 *
 * It is a **list**: search, the four kinds she actually distinguishes, and the
 * two facts that are otherwise two clicks deep — which collection and which
 * categories a product sits in. Those are what she checks when something is not
 * selling.
 *
 * It is **not a second product editor**. Editing opens the native one, which
 * handles variants, options, prices and media properly; a worse copy of it
 * would be weeks of work that makes the admin less capable, not more. Creating
 * goes through the launcher, which sets the defaults per kind.
 *
 * Deleting lives here because it is a list operation — you delete the thing you
 * just found, and making her open a product to remove it is a step for nothing.
 */

type ProductRow = {
  id: string;
  title: string;
  handle: string;
  status: string;
  thumbnail: string | null;
  kind: string;
  collection: string | null;
  categories: string[];
  variant_count: number;
};

type ProductsResponse = {
  products: ProductRow[];
  count: number;
  counts: Record<string, number>;
};

/**
 * The first four filter the catalogue; the last two are management screens that
 * used to be their own sidebar entries. They sit here because they answer
 * questions about the same thing — what am I selling, and how is it arranged —
 * and a separate sidebar item for each made them look like separate jobs.
 *
 * „Na zakázku" is the *product setting*, not the commissions queue. That lives
 * on the Zakázky tab, and the two are deliberately named differently.
 */
const tabs = [
  { key: "standard", label: "Produkty", empty: "Zatím žádné produkty" },
  { key: "made-to-order", label: "Na zakázku", empty: "Žádný produkt na zakázku" },
  { key: "bundle", label: "Balíčky", empty: "Žádné balíčky" },
  { key: "clearance", label: "Poškozené", empty: "Nic ve výprodeji" },
];

/** Reached from the sub-bar but rendered as their own screens. */
const managedTabs = [
  { key: "balicky", label: "Spravovat balíčky", to: "/bundled-products" },
  { key: "kolekce", label: "Kolekce a kategorie", to: "/merchant-catalog" },
  { key: "profily", label: "Nastavení zakázkové výroby", to: "/zakazkova-vyroba" },
];

const emptyWhy: Record<string, string> = {
  standard: "Nový produkt založíte tlačítkem vpravo nahoře.",
  "made-to-order":
    "Označte produkt jako vyráběný na zakázku v Produktech na zakázku.",
  bundle: "Balíček spojí více produktů do jedné nabídky — zakládá se v Balíčcích.",
  clearance:
    "Poškozený nebo poslední kus označíte přepínačem Výprodej u produktu.",
};

const DeleteProduct = ({ product }: { product: ProductRow }) => {
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: () => sdk.admin.product.delete(product.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["catalog-products"] });
      toast.success(`„${product.title}" byl smazán`);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Produkt se nepodařilo smazat"
      ),
  });

  return (
    <Prompt>
      <Prompt.Trigger asChild>
        <Button size="small" variant="transparent">
          Smazat
        </Button>
      </Prompt.Trigger>
      <Prompt.Content>
        <Prompt.Header>
          <Prompt.Title>Smazat „{product.title}"?</Prompt.Title>
          <Prompt.Description>
            Produkt zmizí z e-shopu i z administrace. Objednávek, ve kterých už
            je, se to nedotkne. Vrátit to nejde — pokud ho chcete jen dočasně
            skrýt, přepněte ho v editaci na koncept.
          </Prompt.Description>
        </Prompt.Header>
        <Prompt.Footer>
          <Prompt.Cancel>Zpět</Prompt.Cancel>
          <Prompt.Action onClick={() => remove.mutate()}>Smazat</Prompt.Action>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  );
};

const ProduktyInner = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeKey = searchParams.get("druh") ?? tabs[0].key;
  const active = tabs.find((tab) => tab.key === activeKey) ?? tabs[0];
  const [search, setSearch] = useState(searchParams.get("q") ?? "");

  const { data, isLoading, isError } = useQuery<ProductsResponse>({
    queryKey: ["catalog-products", active.key, search],
    queryFn: () =>
      sdk.client.fetch("/admin/operations/products", {
        query: { kind: active.key, q: search, limit: 200 },
      }),
  });

  const products = data?.products ?? [];

  return (
    <Container className="divide-y p-0">
      <WorkTabs active="produkty" />

      <header className="flex flex-wrap items-start justify-between gap-3 px-6 pb-2 pt-6">
        <div>
          <Heading>Produkty</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
            Co máte v nabídce, kde to zákazník najde a jestli je to zveřejněné.
            Úpravy se otevřou v editoru produktu.
          </Text>
        </div>
        <Button size="small" variant="secondary" asChild>
          <Link to="/novy-produkt">Nový produkt</Link>
        </Button>
      </header>

      <SubTabs
        active={active.key}
        onSelect={(key) => {
          const next = new URLSearchParams(searchParams);
          if (key === tabs[0].key) {
            next.delete("druh");
          } else {
            next.set("druh", key);
          }
          setSearchParams(next, { replace: true });
        }}
        tabs={tabs.map((tab) => ({
          key: tab.key,
          label: tab.label,
          count: data?.counts?.[tab.key],
        }))}
      />

      <div className="flex flex-wrap items-center gap-2 px-6 pb-2">
        {managedTabs.map((tab) => (
          <Button key={tab.key} size="small" variant="transparent" asChild>
            <Link to={tab.to}>{tab.label}</Link>
          </Button>
        ))}
      </div>

      <div className="px-6 pb-4">
        <Input
          type="search"
          placeholder="Hledat podle názvu nebo kódu…"
          aria-label="Hledat produkt"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-sm"
        />
      </div>

      {isLoading && (
        <div className="flex flex-col gap-y-3 px-6 py-5">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      )}

      {isError && (
        <EmptyState
          title="Produkty se nepodařilo načíst"
          description="Zkuste stránku obnovit."
        />
      )}

      {!isLoading && !isError && products.length === 0 && (
        <EmptyState
          title={search ? "Nic nenalezeno" : active.empty}
          description={
            search
              ? "Zkuste jiný název nebo kód."
              : emptyWhy[active.key] ?? ""
          }
        />
      )}

      {!isLoading && !isError && products.length > 0 && (
        <div className="divide-y">
          {products.map((product) => (
            <article
              key={product.id}
              className="grid gap-3 px-6 py-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_120px_auto] lg:items-center"
            >
              <div className="flex min-w-0 items-center gap-3">
                {product.thumbnail ? (
                  <img
                    src={product.thumbnail}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="bg-ui-bg-subtle h-10 w-10 shrink-0 rounded-md" />
                )}
                <div className="min-w-0">
                  <Text size="small" weight="plus" className="truncate">
                    {product.title}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {product.variant_count === 1
                      ? "1 provedení"
                      : `${product.variant_count} provedení`}
                  </Text>
                </div>
              </div>

              <div className="min-w-0">
                <Text size="small" className="text-ui-fg-subtle truncate">
                  {product.collection ?? "Bez kolekce"}
                </Text>
                <Text size="xsmall" className="text-ui-fg-muted truncate">
                  {product.categories.length
                    ? product.categories.join(", ")
                    : "Bez kategorie"}
                </Text>
              </div>

              <div>
                <Badge
                  size="2xsmall"
                  color={product.status === "published" ? "green" : "grey"}
                >
                  {product.status === "published" ? "Zveřejněno" : "Koncept"}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <Button size="small" variant="secondary" asChild>
                  <Link to={`/products/${product.id}`}>Upravit</Link>
                </Button>
                <DeleteProduct product={product} />
              </div>
            </article>
          ))}
        </div>
      )}

      <Toaster />
    </Container>
  );
};

const queryClient = new QueryClient();

const ProduktyPage = () => (
  <QueryClientProvider client={queryClient}>
    <ProduktyInner />
  </QueryClientProvider>
);

export default ProduktyPage;
