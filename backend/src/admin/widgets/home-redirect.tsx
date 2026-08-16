import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Přehled as the home page (Matěj, 2026-08-16).
 *
 * The dashboard's own home route is hardcoded: `/` does
 * `navigate("/orders")` (dashboard `src/routes/home/home.tsx`), so every
 * login landed the merchant on the native order list instead of her Přehled.
 * There is no supported way to change that target — but the landing always
 * *passes through* the order list, and widgets mount there.
 *
 * So: at bundle load we remember where the browser actually entered the app.
 * If the entry was the app root or the login screen, the first mount of the
 * order list is the landing — redirect to Přehled, once. A deliberate visit
 * (sidebar click, deep link straight to /orders, a reload while there)
 * entered elsewhere, so it stays untouched.
 */

const entryPath = window.location.pathname.replace(/\/+$/, "");
let shouldRedirect =
  entryPath === "" ||
  entryPath === "/" ||
  entryPath === "/app" ||
  entryPath.endsWith("/login");

const HomeRedirectWidget = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (shouldRedirect) {
      shouldRedirect = false;
      navigate("/prehled", { replace: true });
    }
  }, [navigate]);

  return null;
};

export const config = defineWidgetConfig({
  zone: "order.list.before",
  id: "keramicka-zahrada:home-redirect",
});

export default HomeRedirectWidget;
