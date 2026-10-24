import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * 24. 10. 2026 (Matěj): výchozí seznam produktů Medusy se nepoužívá — stejně
 * jako detail produktu (product-open-editor.tsx) z něj obchod rovnou přejde
 * na vlastní seznam Produkty+ (/produkty-workbench), založení nového produktu
 * na /novy-produkt.
 *
 * Seznam Medusy hostí i vnořené stránky (/products/import, /products/export
 * …) jako okna nad sebou — ty se nepřesměrovávají, jen holý seznam a
 * založení. Původní stránka zůstává dostupná s `?puvodni=1`.
 */
const ProductListOpenWorkbenchWidget = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const stay = new URLSearchParams(location.search).get("puvodni") === "1";
  const path = location.pathname.replace(/\/+$/, "");

  useEffect(() => {
    if (stay) return;
    if (path === "/products") navigate("/produkty-workbench", { replace: true });
    else if (path === "/products/create") navigate("/novy-produkt", { replace: true });
  }, [stay, path, navigate]);

  return null;
};

export const config = defineWidgetConfig({
  zone: "product.list.before",
});

export default ProductListOpenWorkbenchWidget;
