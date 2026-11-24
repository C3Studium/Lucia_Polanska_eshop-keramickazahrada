import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { sdk } from "./sdk";
import { parujRadky } from "./souhrn-odkazy";

type Odkaz = { id: string; title: string; product_id: string | null; store_url: string | null };

/**
 * Výrobky v nativním Souhrnu objednávky jako odkazy (24. 11. 2026, Lucie:
 * „aby název produktu v objednávce byl aktivní — hodil mě na ten produkt
 * do e-shopu").
 *
 * - Celý řádek výrobku otevře výrobek v e-shopu (nové okno) — klik i Enter.
 * - Vedle tlačítko „Upravit výrobek" → detail výrobku v adminu.
 * - Balné, doběrečné a výrobek, který v obchodě není vidět, odkaz nedostanou.
 *
 * Karta Souhrn je Medusy, ne naše: řádky se hledají v DOM
 * (`data-kz-card="souhrn"`, viz lib/native-cards) a párují podle názvu
 * (lib/souhrn-odkazy). MutationObserver, protože Medusa kartu dokresluje
 * a překresluje; hotový řádek nese `data-kz-odkaz` a znovu se nezpracuje.
 */
export const useSouhrnOdkazy = (orderId: string) => {
  const navigate = useNavigate();
  const { data } = useQuery<{ items: Odkaz[] }>({
    queryKey: ["order-product-links", orderId],
    queryFn: () => sdk.client.fetch(`/admin/merchant-orders/${orderId}/product-links`),
    staleTime: 60_000,
  });

  useEffect(() => {
    const polozky = data?.items ?? [];
    if (!polozky.some((p) => p.product_id)) return;
    const podleId = new Map(polozky.map((p) => [p.id, p]));

    const oprav = () => {
      const karta = document.querySelector<HTMLElement>('[data-kz-card="souhrn"]');
      if (!karta) return;
      const radky = Array.from(
        karta.querySelectorAll<HTMLElement>("div.grid.grid-cols-2.px-6")
      );
      const nazvy = radky.map((radek) => radek.querySelector(".text-ui-fg-base")?.textContent ?? "");
      const parovani = parujRadky(nazvy, polozky);

      radky.forEach((radek, index) => {
        const polozka = parovani[index] ? podleId.get(parovani[index]!) : undefined;
        if (!polozka?.product_id || radek.dataset.kzOdkaz) return;
        radek.dataset.kzOdkaz = polozka.store_url ? "obchod" : "admin";

        if (polozka.store_url) {
          const url = polozka.store_url;
          radek.setAttribute("role", "link");
          radek.tabIndex = 0;
          radek.title = "Otevřít výrobek v e-shopu (nové okno)";
          radek.addEventListener("click", (event) => {
            /* Tlačítka a odkazy v řádku (kopírovat SKU, Upravit výrobek) mají vlastní akci. */
            if ((event.target as HTMLElement).closest("button, a, [role=button]")) return;
            window.open(url, "_blank", "noopener");
          });
          radek.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && event.target === radek) window.open(url, "_blank", "noopener");
          });
        }

        /* „Upravit výrobek" za název — do levé části řádku (výrobek a jeho údaje). */
        const levaCast = radek.firstElementChild as HTMLElement | null;
        if (levaCast && !levaCast.querySelector("[data-kz-upravit]")) {
          const tlacitko = document.createElement("button");
          tlacitko.type = "button";
          tlacitko.dataset.kzUpravit = "1";
          tlacitko.textContent = "Upravit výrobek";
          tlacitko.title = "Detail výrobku v adminu";
          tlacitko.className =
            "txt-compact-small-plus shrink-0 self-center rounded-md border border-ui-border-base bg-ui-bg-base px-2.5 py-1 text-ui-fg-base hover:bg-ui-bg-base-hover";
          tlacitko.addEventListener("click", (event) => {
            event.stopPropagation();
            navigate(`/produkt/${polozka.product_id}`);
          });
          levaCast.appendChild(tlacitko);
        }
      });
    };

    oprav();
    const observer = new MutationObserver(oprav);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [data, navigate]);
};
