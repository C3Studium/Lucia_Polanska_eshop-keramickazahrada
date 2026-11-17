import { useEffect, useRef } from "react";

/**
 * Nativní karty Medusy na detailu objednávky (17. 11. 2026).
 *
 * Medusa skládá nativní karty i naše widgety jako sourozence jednoho flex
 * sloupce. V JAKÉM pořadí, se ale liší: v sandboxu nativní první, na
 * produkci (admin.keramickazahrada.cz) widgety první a nativní za nimi —
 * naměřeno 17. 11. 2026 na #77/#79. První verze hledala nativní karty jen
 * PŘED widgetem, takže na produkci Platby a Nesplněné zůstaly vidět a Souhrn
 * spadl až pod Historii.
 *
 * Proto se teď prochází CELÝ sloupec a pořadí se nastavuje výslovně přes
 * CSS `order`. Naše vlastní bloky nesou `data-kz-own` a přeskakují se;
 * všechno ostatní je nativní.
 */

/** Atribut pro vlastní bloky widgetu — hooky je nepovažují za nativní. */
export const OWN = { "data-kz-own": "1" } as const;

const nativeChildren = (column: Element): HTMLElement[] =>
  Array.from(column.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.dataset.kzOwn !== "1"
  );

/**
 * Bez expertního režimu schová nativní karty přes `data-kz-tech`
 * (pravidlo v lib/citelnost.css), s ním jsou zpátky.
 *
 * `ref` patří na vlastní blok widgetu (s `{...OWN}`); hook pracuje s jeho
 * sloupcem.
 *
 * @param headings jen karty s tímhle nadpisem (h2); bez něj všechny.
 */
export const useHideNativeCards = <T extends HTMLElement>(headings?: string[]) => {
  const ref = useRef<T>(null);
  const key = headings?.join("|") ?? "";
  useEffect(() => {
    const column = ref.current?.parentElement;
    if (!column) return;
    const wanted = key ? new Set(key.split("|")) : null;
    const tag = () => {
      for (const child of nativeChildren(column)) {
        // Některé sekce (zásilky) obalují své karty ještě jedním divem.
        const cards = child.className.includes("shadow-elevation-card")
          ? [child]
          : Array.from(child.querySelectorAll<HTMLElement>("[class*='shadow-elevation-card']"));
        for (const card of cards) {
          const title = (card.querySelector("h2")?.textContent ?? "").trim();
          if ((!wanted || wanted.has(title)) && card.dataset.kzTech !== "1") {
            card.dataset.kzTech = "1";
          }
        }
      }
    };
    tag();
    // Karty se dokreslují postupně (a nadpisy překládá admin-cestina).
    const observer = new MutationObserver(tag);
    observer.observe(column, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [key]);
  return ref;
};

/**
 * Nativní karta, jejíž nadpis (h1/h2) projde testem, dostane `order` —
 * tak se dá dát kamkoli mezi naše bloky bez ohledu na pořadí v DOM.
 */
export const useRaiseNativeCard = (
  anchor: { current: HTMLElement | null },
  test: (title: string) => boolean,
  order: number,
  /** Jméno karty do `data-kz-card` — pro CSS (např. zalomení na telefonu). */
  name?: string
) => {
  useEffect(() => {
    const column = anchor.current?.parentElement;
    if (!column) return;
    const raise = () => {
      for (const child of nativeChildren(column)) {
        const title = (child.querySelector("h1, h2")?.textContent ?? "").trim();
        if (test(title)) {
          if (child.style.order !== String(order)) child.style.order = String(order);
          if (name && child.dataset.kzCard !== name) child.dataset.kzCard = name;
          return;
        }
      }
    };
    raise();
    const observer = new MutationObserver(raise);
    observer.observe(column, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [order]);
};
