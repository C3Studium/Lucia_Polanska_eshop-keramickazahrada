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
