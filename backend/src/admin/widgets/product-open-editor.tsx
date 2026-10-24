import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type { AdminProduct, DetailWidgetProps } from "@medusajs/framework/types";
import { ArrowUpRightOnBox } from "@medusajs/icons";
import { Button, Container, Text } from "@medusajs/ui";
import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

/**
 * The escape hatch FROM the native product page (Matěj, 2026-08-16).
 *
 * Every custom list already links to the simple editor at /produkt/:id; the
 * one way to still land here is the native Products list in the sidebar.
 * This banner offers the way over without taking the native page away —
 * it stays reachable for the corners the simple editor does not cover.
 */
/**
 * 24. 10. 2026 (Matěj): nativní stránka produktu má popis v řádku, ceny
 * variant schované v nabídkách a u produktu bez ceny se v ní nedalo
 * zorientovat. Proto z ní obchod rovnou přejde do jednoduché editace
 * (popis přes celou šířku, cena u každé varianty, ostatní měny podle ČNB).
 * Původní stránka zůstává dostupná s `?puvodni=1` — odkaz „Původní editace"
 * v jednoduché editaci — pro to málo, co jednoduchá neumí (možnosti, kanály).
 */
const ProductOpenEditorWidget = ({ data }: DetailWidgetProps<AdminProduct>) => {
  const navigate = useNavigate();
  const location = useLocation();
  const stay = new URLSearchParams(location.search).get("puvodni") === "1";
  useEffect(() => {
    if (!stay && data?.id) navigate(`/produkt/${data.id}`, { replace: true });
  }, [stay, data?.id, navigate]);
  return (
  <Container className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
    <Text size="small" className="text-ui-fg-subtle">
      Tohle je původní editace se skrytými nabídkami. Jednodušší stránka umí
      všechno běžné přímo v polích.
    </Text>
    <Button size="small" variant="secondary" asChild>
      <Link to={`/produkt/${data.id}`}>
        Otevřít jednoduchou editaci <ArrowUpRightOnBox />
      </Link>
    </Button>
  </Container>
  );
};

export const config = defineWidgetConfig({
  zone: "product.details.before",
  id: "keramicka-zahrada:product-open-editor",
});

export default ProductOpenEditorWidget;
