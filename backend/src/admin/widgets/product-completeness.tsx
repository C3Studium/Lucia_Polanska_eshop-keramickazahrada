import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type { AdminProduct, DetailWidgetProps } from "@medusajs/framework/types";
import { Badge, Container, Heading, Text } from "@medusajs/ui";

/**
 * „Než publikujete" — the checklist (§8.2, P8-2).
 *
 * ## Warnings, never a block
 *
 * Medusa already refuses to publish a product with no price, and that is the
 * only hard rule. Everything else here is a judgement she is allowed to make:
 * a piece can go live without a description if she wants it live tonight.
 *
 * Blocking on any of it would be the admin telling a professional how to do her
 * job. Saying „this has no photo" and letting her decide is the whole
 * difference.
 *
 * Weight earns its place on the list for a non-obvious reason: it is what the
 * carrier price is calculated from, so a product without one quietly costs her
 * money on every parcel.
 */
type Check = {
  label: string;
  ok: boolean;
  why: string;
};

const buildChecks = (product: AdminProduct): Check[] => {
  const variants = product.variants ?? [];
  const hasPrice = variants.some(
    (variant: any) => (variant.prices ?? []).length > 0
  );
  const hasWeight = Boolean(
    (product as any).weight ||
      variants.some((variant: any) => variant.weight)
  );

  return [
    {
      label: "Fotografie",
      ok: Boolean(product.thumbnail || (product.images ?? []).length),
      why: "Bez fotky si kousek nikdo nekoupí.",
    },
    {
      label: "Cena",
      ok: hasPrice,
      why: "Bez ceny produkt nepůjde publikovat.",
    },
    {
      label: "Popis",
      ok: Boolean(product.description?.trim()),
      why: "Pár vět o kousku pomáhá i ve vyhledávání.",
    },
    {
      label: "Kategorie nebo kolekce",
      ok: Boolean(
        (product.categories ?? []).length || (product as any).collection_id
      ),
      why: "Jinak ho zákazníci najdou jen přes vyhledávání.",
    },
    {
      label: "Hmotnost",
      ok: hasWeight,
      why: "Podle hmotnosti se počítá doprava — bez ní může být špatně.",
    },
  ];
};

const ProductCompletenessWidget = ({
  data: product,
}: DetailWidgetProps<AdminProduct>) => {
  const checks = buildChecks(product);
  const missing = checks.filter((check) => !check.ok);

  // Nothing to say once everything is filled in and the product is live —
  // a green checklist on every product page is furniture.
  if (!missing.length && product.status === "published") {
    return null;
  }

  return (
    <Container className="p-0">
      <header className="px-6 pb-3 pt-4">
        <div className="flex items-center gap-x-2">
          <Heading level="h2">Než publikujete</Heading>
          {missing.length > 0 && (
            <Badge size="2xsmall" color="orange">
              {missing.length}
            </Badge>
          )}
        </div>
        <Text size="small" className="text-ui-fg-subtle mt-1">
          {missing.length
            ? "Tohle ještě chybí. Publikovat můžete i tak — je to jen upozornění."
            : "Všechno je vyplněné. Produkt můžete publikovat."}
        </Text>
      </header>

      <div className="divide-y">
        {checks.map((check) => (
          <div
            key={check.label}
            className="flex items-start justify-between gap-3 px-6 py-3"
          >
            <div>
              <Text size="small" weight="plus">
                {check.label}
              </Text>
              {!check.ok && (
                <Text size="small" className="text-ui-fg-subtle mt-1">
                  {check.why}
                </Text>
              )}
            </div>
            <Badge size="2xsmall" color={check.ok ? "green" : "orange"}>
              {check.ok ? "Hotovo" : "Chybí"}
            </Badge>
          </div>
        ))}
      </div>
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: "product.details.side.before",
  id: "keramicka-zahrada:product-completeness",
});

export default ProductCompletenessWidget;
