import { useEffect, useRef } from "react";

/**
 * Nativní karty Medusy, které na detailu objednávky jen opakují naše
 * (17. 11. 2026): bez expertního režimu se schovají přes `data-kz-tech`
 * (pravidlo v lib/citelnost.css), s ním jsou zpátky.
 *
 * Medusa skládá nativní karty i widgety jako sourozence jednoho sloupce,
 * nativní první — hook proto prochází sourozence PŘED prvkem s `ref`.
 *
 * @param headings jen karty s tímhle nadpisem (h2); bez něj všechny.
 */
export const useHideNativeCardsBefore = <T extends HTMLElement>(headings?: string[]) => {
  const ref = useRef<T>(null);
  const key = headings?.join("|") ?? "";
  useEffect(() => {
    const root = ref.current;
    const column = root?.parentElement;
    if (!root || !column) return;
    const wanted = key ? new Set(key.split("|")) : null;
    const tag = () => {
      for (const child of Array.from(column.children)) {
        if (child === root) break;
        if (!(child instanceof HTMLElement)) continue;
        // Některé sekce (zásilky) obalují své karty ještě jedním divem.
        const cards = child.className.includes("shadow-elevation-card")
          ? [child]
          : Array.from(child.querySelectorAll<HTMLElement>("[class*='shadow-elevation-card']"));
        for (const card of cards) {
          const title = (card.querySelector("h2")?.textContent ?? "").trim();
          if (!wanted || wanted.has(title)) card.dataset.kzTech = "1";
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
 * Posune nativní kartu před naše bloky přes CSS `order` (17. 11. 2026:
 * číslo objednávky „#52" nad Zákazníkem). Hledá mezi sourozenci PŘED
 * prvkem `anchor` první kartu, jejíž nadpis splní `test`.
 */
export const useRaiseNativeCard = (
  anchor: { current: HTMLElement | null },
  test: (title: string) => boolean,
  order: number
) => {
  useEffect(() => {
    const root = anchor.current;
    const column = root?.parentElement;
    if (!root || !column) return;
    const raise = () => {
      for (const child of Array.from(column.children)) {
        if (child === root) break;
        if (!(child instanceof HTMLElement)) continue;
        if (!child.className.includes("shadow-elevation-card")) continue;
        const title = (child.querySelector("h1, h2")?.textContent ?? "").trim();
        if (test(title)) {
          if (child.style.order !== String(order)) child.style.order = String(order);
          return;
        }
      }
    };
    raise();
    const observer = new MutationObserver(raise);
    observer.observe(column, { childList: true });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);
};
