import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type { AdminProduct, DetailWidgetProps } from "@medusajs/framework/types";
import { Container, Text } from "@medusajs/ui";
import { StorefrontBridgeButton } from "../components/storefront-bridge-button";

/**
 * The door from a product onto its own page on the live site.
 *
 * Straight to that product, not the home page — seeing the thing you are
 * editing is the whole point, and the bar waiting on the other side carries
 * the way back to this screen.
 */
const ProductStorefrontBridge = ({ data }: DetailWidgetProps<AdminProduct>) => {
  if (!data?.handle) {
    return null;
  }

  return (
    <Container className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
      <Text size="small" className="text-ui-fg-subtle">
        Podívejte se, jak produkt vypadá zákazníkovi. Na webu vám zůstane lišta
        s cestou zpátky sem.
      </Text>
      <StorefrontBridgeButton
        path={`/cz/products/${data.handle}`}
        label="Otevřít na webu"
      />
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: "product.details.before",
  id: "keramicka-zahrada:storefront-bridge-product",
});

export default ProductStorefrontBridge;
