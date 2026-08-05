import { SquaresPlus } from "@medusajs/icons";
import { Container, Heading, Text, Toaster, toast } from "@medusajs/ui";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { sdk } from "../../lib/sdk";

/**
 * „Nový produkt" — four starting points instead of a blank form (§8.1, P8-1).
 *
 * ## Composition, not a replacement
 *
 * The native product editor is good and already Czech through the locale, so
 * nothing here rebuilds it. What the native flow cannot do is *start* somewhere
 * sensible: the blank create form asks the same twenty questions whether she is
 * listing one vase or a mug in three colours, and the answers that differ are
 * exactly the ones easy to get wrong — stock tracking on a made-to-order piece,
 * or forgetting a one-off will never come back.
 *
 * Each card creates a real product through the native admin API with the right
 * defaults, then hands straight over to the native editor. The create page
 * cannot be pre-filled by URL, which is why the product is made first.
 *
 * Everything is created as a **draft**. Nothing reaches the shop because
 * somebody clicked a card.
 */

type Template = {
  id: string;
  title: string;
  description: string;
  build: () => Record<string, unknown>;
};

const base = (title: string) => ({
  title,
  status: "draft" as const,
  options: [{ title: "Provedení", values: ["Standardní"] }],
});

const templates: Template[] = [
  {
    id: "unique",
    title: "Jedinečný kus",
    description:
      "Jedna váza, jeden kus. Sleduje se skladem, takže po prodeji zmizí z nabídky.",
    build: () => ({
      ...base("Nový kus"),
      variants: [
        {
          title: "Standardní",
          manage_inventory: true,
          options: { Provedení: "Standardní" },
        },
      ],
    }),
  },
  {
    id: "variants",
    title: "Produkt s variantami",
    description:
      "Např. hrnek ve třech barvách. Barvy a počty doplníte v dalším kroku.",
    build: () => ({
      title: "Nový produkt s variantami",
      status: "draft" as const,
      options: [{ title: "Barva", values: ["Modrá"] }],
      variants: [
        {
          title: "Modrá",
          manage_inventory: true,
          options: { Barva: "Modrá" },
        },
      ],
    }),
  },
  {
    id: "made-to-order",
    title: "Na zakázku",
    description:
      "Vyrábí se až po objednávce. Zálohu a termíny nastavíte v Produktech na zakázku.",
    build: () => ({
      ...base("Nová zakázková výroba"),
      variants: [
        {
          title: "Standardní",
          // Made to order is never in stock — that is the point, and it keeps
          // the piece out of the sold-out alerts.
          manage_inventory: false,
          options: { Provedení: "Standardní" },
        },
      ],
    }),
  },
  {
    id: "clearance",
    title: "Výprodej / poškozený kus",
    description:
      "Poslední nebo lehce poškozený kus. Až se prodá, sami ho schováme a odebereme z akcí.",
    build: () => ({
      ...base("Kus ve výprodeji"),
      metadata: { clearance: true },
      variants: [
        {
          title: "Standardní",
          manage_inventory: true,
          options: { Provedení: "Standardní" },
        },
      ],
    }),
  },
];

const NovyProduktInner = () => {
  const navigate = useNavigate();

  const create = useMutation({
    mutationFn: (template: Template) =>
      sdk.admin.product.create(template.build() as never),
    onSuccess: (result: any) => {
      toast.success("Produkt založen — teď mu přidejte fotku a cenu");
      navigate(`/products/${result.product.id}`);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Produkt se nepodařilo založit"
      );
    },
  });

  return (
    <Container className="divide-y p-0">
      <header className="px-6 pb-4 pt-6">
        <Heading>Nový produkt</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
          Vyberte, co zakládáte. Vyplníme za vás nastavení, které se u toho typu
          skoro nikdy nemění, a pustíme vás rovnou k fotkám a ceně.
        </Text>
      </header>

      <div className="grid gap-px bg-ui-border-base sm:grid-cols-2">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            disabled={create.isPending}
            onClick={() => create.mutate(template)}
            className="bg-ui-bg-base hover:bg-ui-bg-base-hover transition-fg flex flex-col gap-y-2 px-6 py-6 text-left outline-none focus-visible:shadow-borders-focus disabled:opacity-60"
          >
            <Heading level="h2">{template.title}</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              {template.description}
            </Text>
          </button>
        ))}
      </div>

      <div className="px-6 py-4">
        <Text size="small" className="text-ui-fg-subtle">
          Balíček z několika produktů se zakládá v Balíčcích — ať je na to jedno
          místo.
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
 * **No sidebar entry.** Reached from Přehled → Produkty. The sidebar is down
 * to the five places she navigates *to*; everything she works *in* lives
 * under Přehled.
 */

export default NovyProduktPage;
