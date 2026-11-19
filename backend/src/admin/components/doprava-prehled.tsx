import {
  BuildingStorefront,
  Cash,
  Envelope,
  ExclamationCircle,
  HandTruck,
  House,
  MapPin,
} from "@medusajs/icons";
import { Text } from "@medusajs/ui";
import type { ReactNode } from "react";

/**
 * Jak se dá výrobek poslat — jen přehled ikonami, NEDÁ se na něj klikat
 * (19. 11. 2026, Matěj: „ať klientka vidí, jaká doprava je povolená").
 * Mění se nastavením nad ním (velikost zásilky, křehké, dobírka) a na
 * stránce Doprava a platba.
 *
 * Pravidla jsou tatáž jako v pokladně (storefront lib/util/shipping-kinds,
 * fragile, commission; backend validate-dobirka) pro košík s tímhle kusem:
 * - osobní odběr vždy,
 * - pošta a Balíkovna na adresu vždy, jen poukaz jde dopisem,
 * - Balíkovna výdejní místo / box jen malá zásilka bez křehkého kusu,
 *   zakázky a ceny po domluvě,
 * - dopis jen poukaz,
 * - dobírka jen na adresu a jen když ji výrobek dovolí (zakázka nikdy).
 */
export type DopravaVstup = {
  trida: "male" | "velke" | "poukaz";
  krehke: boolean;
  dobirka: boolean;
  zakazka: boolean;
  cenaPoDomluve: boolean;
};

type Polozka = { klic: string; ikona: ReactNode; nazev: string; jde: boolean; proc: string };

export const dopravaVyrobku = (v: DopravaVstup): Polozka[] => {
  const poukaz = v.trida === "poukaz";
  const omezeni = v.krehke || v.zakazka || v.cenaPoDomluve;
  const boxNe = poukaz
    ? "Poukaz jde dopisem, ne do Balíkovny."
    : v.trida === "velke"
      ? "Velká zásilka se do výdejního místa ani boxu nevejde."
      : v.krehke
        ? "Křehký kus nejde do výdejního místa ani boxu."
        : v.zakazka || v.cenaPoDomluve
          ? "Zakázka jde jen na adresu nebo osobně."
          : "";
  const dobirkaNe = v.zakazka
    ? "Zakázka se na dobírku neposílá (platí se záloha)."
    : !v.dobirka
      ? "U výrobku je dobírka vypnutá — jen platba předem."
      : "";
  return [
    { klic: "posta", ikona: <House />, nazev: "Pošta na adresu", jde: !poukaz, proc: poukaz ? "Poukaz jde dopisem." : "Česká pošta až domů." },
    { klic: "balikovna-adresa", ikona: <HandTruck />, nazev: "Balíkovna na adresu", jde: !poukaz, proc: poukaz ? "Poukaz jde dopisem." : "Balíkovna doručí až domů." },
    { klic: "balikovna", ikona: <MapPin />, nazev: "Výdejní místo / box", jde: !poukaz && v.trida !== "velke" && !omezeni, proc: boxNe || "Zákazník si vyzvedne na poště nebo v boxu." },
    ...(poukaz ? [{ klic: "dopis", ikona: <Envelope />, nazev: "Dopis", jde: true, proc: "Vytištěný poukaz jde doporučeným dopisem." }] : []),
    { klic: "odber", ikona: <BuildingStorefront />, nazev: "Osobní odběr", jde: true, proc: "V ateliéru v Putimi — vždy." },
    { klic: "dobirka", ikona: <Cash />, nazev: "Dobírka", jde: !dobirkaNe && !poukaz, proc: dobirkaNe || (poukaz ? "Poukaz se platí předem." : "Jen při doručení na adresu.") },
  ];
};

export const DopravaPrehled = (props: DopravaVstup) => {
  const polozky = dopravaVyrobku(props);
  return (
    <div className="flex flex-col gap-2" aria-label="Jak se dá výrobek poslat (jen přehled)">
      <div className="flex flex-wrap gap-1.5">
        {polozky.map((p) => (
          <span
            key={p.klic}
            title={p.proc}
            className={`txt-compact-xsmall-plus inline-flex min-h-[30px] cursor-default select-none items-center gap-1.5 rounded-full border px-2.5 ${
              p.jde
                ? "border-ui-tag-green-border bg-ui-tag-green-bg text-ui-tag-green-text"
                : "border-ui-border-base bg-ui-bg-subtle text-ui-fg-muted line-through decoration-1"
            }`}
          >
            <span className="shrink-0 [&_svg]:size-4">{p.ikona}</span>
            {p.nazev}
          </span>
        ))}
        {props.krehke && (
          <span
            title="Celá zásilka pojede jako křehká (příplatek k poštovnému)."
            className="txt-compact-xsmall-plus border-ui-tag-orange-border bg-ui-tag-orange-bg text-ui-tag-orange-text inline-flex min-h-[30px] cursor-default select-none items-center gap-1.5 rounded-full border px-2.5"
          >
            <span className="shrink-0 [&_svg]:size-4">
              <ExclamationCircle />
            </span>
            Křehké — opatrně
          </span>
        )}
      </div>
      <Text size="xsmall" className="text-ui-fg-muted">
        Jen přehled — mění se nastavením výš. Najeďte myší na štítek a uvidíte proč.
      </Text>
    </div>
  );
};
