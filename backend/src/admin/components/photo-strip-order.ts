/**
 * Pořadí fotek při přetažení (18. 11. 2026) — čistá funkce, ať jde otestovat
 * bez prohlížeče. Fotka z `from` se vloží na místo `to` (ostatní se posunou).
 */
export const movePhoto = <T,>(list: T[], from: number, to: number): T[] => {
  if (from === to || from < 0 || from >= list.length || to < 0 || to >= list.length) {
    return list;
  }
  const next = list.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

/** Hlavní fotka na začátek — v obchodě se galerie ukazuje v tomhle pořadí. */
export const mainFirst = <T,>(list: T[], main: T): T[] => {
  const index = list.indexOf(main);
  return index > 0 ? movePhoto(list, index, 0) : list;
};
