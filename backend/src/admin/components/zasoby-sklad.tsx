import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Select,
  Skeleton,
  Text,
  clx,
  toast,
  usePrompt,
} from "@medusajs/ui";
import {
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useScrollMemory } from "../lib/scroll-memory";
import { useUrlState } from "../lib/url-state";
import { EmptyState, pieces } from "./empty-state";
import { SubTabs, WorkTabs } from "./work-tabs";
import { CopyId, ExpertToggle, useExpertMode } from "../lib/expert-mode";
import { formatCount, formatCzk } from "../lib/workbench";
import { sdk } from "../lib/sdk";
import { ViewSwitcher, useViewMode } from "../lib/view-mode";
import { adminQueryClient } from "../lib/query-client";
import { ceskaChyba } from "../lib/ceska-chyba";
import { pushUndo, undoById, useUndoHotkey } from "../lib/undo";
import {
  noveIdDavky,
  odpovidaHledani,
  pocetProduktu,
  precistPocet,
  seradit,
  uProduktu,
  type Razeni,
  type SkladRadek,
} from "../lib/naskladneni";

/**
 * Zásoby — jedna stránka skladu (3. 11. 2026: sloučeno se Sklad+).
 *
 * Dřív byly dvě: Přehled › Zásoby („co dochází, přidat kusy") a Sklad+ („co
 * lidé chtějí" — čekající zákazníci a oblíbené). Ukazovaly tytéž řádky ze
 * stejného pravidla (`lib/inventory-alerts.ts`) a obě uměly přidat kusy, jen
 * každá trochu jinak. Teď je to jedna stránka; pořadí Sklad+ je řazení
 * „Nejdřív o co je zájem", statistiky jsou záložka. `/sklad-workbench`
 * přesměrovává sem.
 *
 * Kusy se PŘIČÍTAJÍ: po výpalu drží šest hrnků a myslí „šest navíc", ne
 * „celkem čtrnáct". Na jeden výrobek stačí pole u řádku; po vyložení pece je
 * tu režim „Naskladnit po výpalu" — vyplní počty u víc výrobků a uloží je
 * jedním tlačítkem, s možností to hned vrátit.
 */

type Stav = "out" | "low" | "ok";
type Radek = SkladRadek & { stav: Stav };

type SkladOdpoved = {
  out: SkladRadek[];
  low: SkladRadek[];
  ok: SkladRadek[];
  default_threshold: number;
  waiting_total: number;
};

// Ploché tvary (ne sjednocení): admin se nepřekládá se strictNullChecks a `ok`
// by typ nezúžilo. Pravdu drží `lib/add-stock.ts` na serveru.
type DavkaOdpoved = {
  request_id: string;
  results: Array<{
    inventory_item_id: string;
    ok: boolean;
    added?: number;
    quantity?: number;
    error?: string;
  }>;
  added_total: number;
  ok_count: number;
  failed_count: number;
};

type VraceniOdpoved = {
  request_id: string;
  results: Array<{ inventory_item_id: string; ok: boolean; removed: number; error?: string }>;
  removed_total: number;
  ok_count: number;
  skipped_count: number;
};

type Zalozka = {
  key: "dochazi" | "vyprodano" | "naskladnene" | "statistiky";
  stav: Stav | null;
  label: string;
  empty: string;
  emptyWhy: string;
};

// Pořadí a klíče v adrese zůstaly z Přehled › Zásoby — dlaždice na Přehledu na ně odkazují.
const zalozky: Zalozka[] = [
  {
    key: "dochazi",
    stav: "low",
    label: "Dochází",
    empty: "Zásoby jsou v pořádku",
    emptyWhy: "Jakmile něčeho začne ubývat, objeví se to tady.",
  },
  {
    key: "vyprodano",
    stav: "out",
    label: "Vyprodáno",
    empty: "Nic není vyprodané",
    emptyWhy: "Jakmile něčeho zbude nula kusů, objeví se to tady.",
  },
  {
    key: "naskladnene",
    stav: "ok",
    label: "Naskladněné",
    empty: "Zatím nic naskladněného",
    emptyWhy: "Kusy, kterých máte dost, se objeví tady.",
  },
  { key: "statistiky", stav: null, label: "Statistiky", empty: "", emptyWhy: "" },
];

const stavSlovy: Record<Stav, string> = {
  out: "Vyprodáno",
  low: "Dochází",
  ok: "Skladem",
};

const nazev = (radek: SkladRadek) =>
  `${radek.product_title ?? "Produkt"}${radek.variant_title ? ` · ${radek.variant_title}` : ""}`;

/** Po naskladnění se mění dlaždice Přehledu i statistiky — obnovit všechno, co čte sklad. */
const useObnovitSklad = () => {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["workbench-inventory"] }),
      queryClient.invalidateQueries({ queryKey: ["workbench-inventory-statistics"] }),
      queryClient.invalidateQueries({ queryKey: ["operations-summary"] }),
    ]);
};

/**
 * Jeden výrobek: „+ ks" a tlačítko. Je to úkon, ne údaj — uložení „samo" při
 * opuštění pole by při každém kliknutí jinam přidalo další kusy.
 */
const PridatKusy = ({ radek }: { radek: SkladRadek }) => {
  const obnovit = useObnovitSklad();
  const [text, setText] = useState("");
  const pocet = precistPocet(text);

  const pridat = useMutation({
    mutationFn: (kusy: number) =>
      sdk.client.fetch(`/admin/workbench/inventory/add-stock`, {
        method: "POST",
        body: { inventory_item_id: radek.inventory_item_id, quantity: kusy },
      }),
    onSuccess: async (_vysledek, kusy) => {
      setText("");
      await obnovit();
      toast.success(
        `Přidáno ${pieces(kusy)} — ${radek.product_title ?? "produkt"}${
          radek.waiting_customers > 0
            ? ". Čekajícím zákazníkům odejde e-mail nejpozději do rána."
            : ""
        }`
      );
    },
    onError: (error) => toast.error(ceskaChyba(error, "Zásoby se nepodařilo upravit")),
  });

  if (!radek.inventory_item_id) {
    return (
      <Text size="xsmall" className="text-ui-fg-muted">
        Upravit lze ve skladu
      </Text>
    );
  }

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (pocet.druh === "ok") pridat.mutate(pocet.kusy);
      }}
    >
      {/* Text, ne number: kolečko myši nad číselným polem tiše mění číslo. */}
      <Input
        size="small"
        type="text"
        inputMode="numeric"
        placeholder="+ ks"
        aria-label={`Přidat kusy — ${nazev(radek)}`}
        aria-invalid={pocet.druh === "chyba"}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="w-20"
      />
      <Button
        size="small"
        variant="secondary"
        type="submit"
        isLoading={pridat.isPending}
        disabled={pocet.druh !== "ok"}
      >
        Přidat
      </Button>
    </form>
  );
};

/**
 * Hranice upozornění u výrobku. Uložená na skladové položce — jediné místo,
 * které čte `inventory-alerts.ts`, takže stránka, dlaždice i ranní úloha
 * mají jednu definici „dochází". Je to údaj: ukládá se při opuštění pole.
 */
const HraniceUpozorneni = ({ radek }: { radek: SkladRadek }) => {
  const obnovit = useObnovitSklad();
  const [upravuje, setUpravuje] = useState(false);
  const [hodnota, setHodnota] = useState(String(radek.threshold));

  const ulozit = useMutation({
    mutationFn: (threshold: number) =>
      sdk.client.fetch(`/admin/inventory-items/${radek.inventory_item_id}`, {
        method: "POST",
        body: { metadata: { low_stock_threshold: threshold } },
      }),
    onSuccess: async () => {
      setUpravuje(false);
      await obnovit();
      toast.success("Hranice upozornění uložena.");
    },
    onError: (error) => toast.error(ceskaChyba(error, "Hranici se nepodařilo uložit")),
  });

  if (!radek.inventory_item_id) return null;

  const potvrdit = () => {
    setUpravuje(false);
    const threshold = Number(hodnota);
    if (!Number.isInteger(threshold) || threshold < 0) {
      setHodnota(String(radek.threshold));
      return;
    }
    if (threshold === radek.threshold) return; // Nezměněná hodnota nezapisuje.
    ulozit.mutate(threshold);
  };

  if (!upravuje) {
    return (
      <button
        type="button"
        className="text-ui-fg-subtle txt-xsmall hover:text-ui-fg-base text-left"
        onClick={() => {
          setHodnota(String(radek.threshold));
          setUpravuje(true);
        }}
      >
        hlásí se při {radek.threshold} a méně
        {radek.has_custom_threshold ? " (vlastní)" : ""}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Text size="xsmall" className="text-ui-fg-subtle">
        hlásí se při
      </Text>
      <Input
        size="small"
        type="number"
        min={0}
        value={hodnota}
        onChange={(event) => setHodnota(event.target.value)}
        onBlur={potvrdit}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
          if (event.key === "Escape") {
            setHodnota(String(radek.threshold));
            setUpravuje(false);
          }
        }}
        disabled={ulozit.isPending}
        className="w-16"
        autoFocus
      />
      <Text size="xsmall" className="text-ui-fg-subtle">
        a méně
      </Text>
    </div>
  );
};

type Statistiky = {
  pieces_in_stock: number;
  stock_value_czk: number;
  unpriced_variants: number;
  default_threshold: number;
  variants: { out: number; low: number; ok: number };
  demand: { waiting_customers: number; wishlist_saves: number };
};

const SkladStatistiky = () => {
  const { data, isLoading } = useQuery<Statistiky>({
    queryKey: ["workbench-inventory-statistics"],
    queryFn: () => sdk.client.fetch("/admin/workbench/inventory/statistics"),
    refetchOnWindowFocus: true,
  });
  if (isLoading || !data) {
    return (
      <div className="px-6 py-5">
        <Skeleton className="h-20 rounded-lg" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-y-2 px-6 py-5">
      <Text size="small" weight="plus">
        {data.pieces_in_stock} kusů na skladě · hodnota{" "}
        {formatCzk(Math.round(data.stock_value_czk))}
      </Text>
      <Text size="xsmall" className="text-ui-fg-subtle">
        {data.variants.out} variant vyprodáno · {data.variants.low} dochází ·{" "}
        {data.variants.ok} v pořádku
        {data.unpriced_variants > 0
          ? ` · ${data.unpriced_variants} bez ceny (do hodnoty nepočítáno)`
          : ""}
      </Text>
      <Text size="xsmall" className="text-ui-fg-subtle">
        Poptávka: {data.demand.waiting_customers} zákazníků čeká na naskladnění ·{" "}
        {data.demand.wishlist_saves} uložení v oblíbených · hlásí se při{" "}
        {data.default_threshold} a méně
      </Text>
    </div>
  );
};

const NazevRadku = ({ radek, odkaz }: { radek: SkladRadek; odkaz: boolean }) => {
  const text = (
    <Text size="small" weight="plus" className="truncate">
      {radek.product_title || "—"}
    </Text>
  );
  return odkaz && radek.product_id ? (
    <Link
      to={`/produkt/${radek.product_id}`}
      className="block w-fit max-w-full hover:underline"
      title="Otevřít detail produktu"
    >
      {text}
    </Link>
  ) : (
    text
  );
};

const Cekajici = ({ radek }: { radek: SkladRadek }) =>
  radek.waiting_customers > 0 ? (
    <Badge size="2xsmall" color="orange">
      {formatCount(radek.waiting_customers, "zákazník čeká", "zákazníci čekají", "zákazníků čeká")}
    </Badge>
  ) : null;

type Vysledek = {
  requestId: string;
  kusy: number;
  produkty: number;
  polozky: { nazev: string; kusy: number }[];
  nepovedlo: number;
  cekajici: boolean;
  undoId: number | null;
  vraceno: (VraceniOdpoved & { nazvy: Record<string, string> }) | null;
};

/** Co se právě uložilo — zůstane na stránce, dokud ji nezavře, s „Vrátit zpět". */
const VysledekNaskladneni = ({
  vysledek,
  zavrit,
}: {
  vysledek: Vysledek;
  zavrit: () => void;
}) => {
  const [vracim, setVracim] = useState(false);
  const { vraceno } = vysledek;
  const preskocene = vraceno ? vraceno.results.filter((r) => !r.ok) : [];

  return (
    <div className="px-6 py-4">
      <div
        className={clx(
          "rounded-lg border px-4 py-3",
          vraceno ? "border-ui-border-base bg-ui-bg-subtle" : "border-ui-tag-green-border bg-ui-tag-green-bg"
        )}
        role="status"
      >
        {vraceno ? (
          <>
            <Text size="small" weight="plus">
              Vráceno zpět: {vraceno.removed_total} ks.
            </Text>
            {preskocene.length > 0 && (
              <ul className="mt-1 flex flex-col gap-y-0.5">
                {preskocene.map((r) => (
                  <li key={r.inventory_item_id}>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {vraceno.nazvy[r.inventory_item_id] ?? "Položka"}: {r.error ?? ""}
                    </Text>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <Text size="small" weight="plus">
              Naskladněno: {vysledek.kusy} ks {uProduktu(vysledek.produkty)}.
            </Text>
            <Text size="xsmall" className="text-ui-fg-subtle mt-1">
              {vysledek.polozky.map((p) => `${p.nazev} +${p.kusy}`).join(" · ")}
            </Text>
            {vysledek.cekajici && (
              <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                Zákazníkům, kteří na něco z toho čekali, odejde e-mail nejpozději do rána.
              </Text>
            )}
          </>
        )}
        {vysledek.nepovedlo > 0 && !vraceno && (
          <Text size="xsmall" className="text-ui-fg-error mt-1">
            U {formatCount(vysledek.nepovedlo, "položky", "položek", "položek")} se to nepovedlo —
            čísla zůstala vyplněná, zkuste je uložit znovu.
          </Text>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {vysledek.undoId !== null && !vraceno && (
            <Button
              size="small"
              variant="secondary"
              isLoading={vracim}
              onClick={async () => {
                setVracim(true);
                try {
                  await undoById(vysledek.undoId as number);
                } finally {
                  setVracim(false);
                }
              }}
            >
              Vrátit zpět
            </Button>
          )}
          <Button size="small" variant="transparent" onClick={zavrit}>
            Zavřít
          </Button>
        </div>
      </div>
    </div>
  );
};

const ZasobyInner = () => {
  /*
   * Návrat z produktu vrátí i tam, kde v seznamu byla.
   *
   * Tahle stránka to potřebuje ze všech nejvíc: 95 kusů dochází a 120 je
   * vyprodaných, seznam měří přes devět tisíc pixelů, a naskladňuje se kus
   * po kuse. Změřeno 11. 11. 2026 v ostré administraci: posun 1500 px se
   * návratem z produktu srovnal na nulu a dorolovat se muselo znovu.
   */
  useScrollMemory("zasoby");
  useUndoHotkey();
  const obnovit = useObnovitSklad();
  const prompt = usePrompt();
  const expert = useExpertMode();
  /*
     Záložka taky přes `useUrlState`, a je to oprava, ne kosmetika: dřív se
     psala celým `setSearchParams({ stav })`, což přepsalo CELÝ dotaz adresy.
     Dokud v něm nic jiného nebylo, nevadilo to — od chvíle, co tam stojí
     i hledání a řazení, by je přepnutí záložky smazalo. `useUrlState` mění
     jen svůj klíč a ostatní nechá být. */
  const [stav, setStav] = useUrlState<string>("stav", zalozky[0].key);
  const aktivni = zalozky.find((z) => z.key === stav) ?? zalozky[0];
  /* Hledání a řazení do adresy, ať je návrat z produktu nezahodí; `stav`
     (záložka) tam stál odjakživa, tyhle dvě k němu patří. */
  const [hledat, setHledat] = useUrlState<string>("hledat", "");
  const [razeni, setRazeni] = useUrlState<Razeni>("razeni", "zajem");
  /* Řádky / kompakt — mřížka tu není, skladová data nenesou fotky. Klíč zůstal po Sklad+. */
  const [view, changeView] = useViewMode("kz-view-sklad");

  // Režim „Naskladnit po výpalu": rozepsané počty podle skladové položky.
  const [poVypalu, setPoVypalu] = useState(false);
  const [rozepsano, setRozepsano] = useState<Record<string, string>>({});
  const [chybyRadku, setChybyRadku] = useState<Record<string, string>>({});
  const [vysledek, setVysledek] = useState<Vysledek | null>(null);
  // Jedno id na jednu vyplněnou dávku: dvojklik i opakování po výpadku sítě pošlou stejné.
  const idDavky = useRef<string | null>(null);
  const odesila = useRef(false);

  const { data, isLoading, isError } = useQuery<SkladOdpoved>({
    queryKey: ["workbench-inventory"],
    queryFn: () => sdk.client.fetch("/admin/workbench/inventory"),
    refetchOnWindowFocus: true,
  });

  const vsechny = useMemo<Radek[]>(
    () =>
      data
        ? [
            ...data.out.map((r) => ({ ...r, stav: "out" as const })),
            ...data.low.map((r) => ({ ...r, stav: "low" as const })),
            ...data.ok.map((r) => ({ ...r, stav: "ok" as const })),
          ]
        : [],
    [data]
  );
  const podleIdPolozky = useMemo(
    () =>
      new Map(
        vsechny
          .filter((r) => r.inventory_item_id)
          .map((r) => [r.inventory_item_id as string, r])
      ),
    [vsechny]
  );

  const nalezene = useMemo(
    () => vsechny.filter((r) => odpovidaHledani(r, hledat)),
    [vsechny, hledat]
  );
  const pocty: Record<Stav, number> = {
    out: nalezene.filter((r) => r.stav === "out").length,
    low: nalezene.filter((r) => r.stav === "low").length,
    ok: nalezene.filter((r) => r.stav === "ok").length,
  };
  const radky = aktivni.stav
    ? seradit(
        nalezene.filter((r) => r.stav === aktivni.stav),
        razeni
      )
    : [];

  // Vyplněné řádky zůstávají vidět i při jiném hledání — ať ví, co už napsala.
  const radkyPoVypalu = seradit(
    vsechny.filter(
      (r) =>
        odpovidaHledani(r, hledat) ||
        (r.inventory_item_id && (rozepsano[r.inventory_item_id] ?? "").trim())
    ),
    razeni
  );

  const zadane = Object.entries(rozepsano)
    .map(([id, text]) => ({ id, pocet: precistPocet(text), radek: podleIdPolozky.get(id) }))
    .filter((z) => z.pocet.druh !== "prazdne" && z.radek);
  const platne = zadane.flatMap((z) =>
    z.pocet.druh === "ok" && z.radek ? [{ radek: z.radek, kusy: z.pocet.kusy }] : []
  );
  const chybnych = zadane.filter((z) => z.pocet.druh === "chyba").length;
  const kusuCelkem = platne.reduce((sum, z) => sum + z.kusy, 0);

  const prepsat = (id: string, text: string) => {
    idDavky.current = null; // Jiná čísla = jiná dávka.
    setRozepsano((pred) => ({ ...pred, [id]: text }));
    setChybyRadku((pred) => {
      if (!(id in pred)) return pred;
      const { [id]: _pryc, ...zbytek } = pred;
      return zbytek;
    });
  };

  const naskladnit = useMutation({
    mutationFn: (davka: { request_id: string; items: { inventory_item_id: string; quantity: number }[] }) =>
      sdk.client.fetch<DavkaOdpoved>("/admin/workbench/inventory/add-stock-batch", {
        method: "POST",
        body: davka,
      }),
    onSuccess: async (odpoved) => {
      idDavky.current = null;
      const povedene = odpoved.results.filter((r) => r.ok);
      const nepovedene = odpoved.results.filter((r) => !r.ok);
      const povedeneRadky = povedene.flatMap((r) => {
        const radek = podleIdPolozky.get(r.inventory_item_id);
        return radek ? [{ radek, kusy: r.added ?? 0 }] : [];
      });
      const nazvy = Object.fromEntries(
        odpoved.results.map((r) => {
          const radek = podleIdPolozky.get(r.inventory_item_id);
          return [r.inventory_item_id, radek ? nazev(radek) : "Položka"];
        })
      );

      // Povedené z rozepsaných pryč, nepovedené zůstanou i s důvodem.
      setRozepsano((pred) => {
        const dal = { ...pred };
        for (const r of povedene) delete dal[r.inventory_item_id];
        return dal;
      });
      setChybyRadku(
        Object.fromEntries(
          nepovedene.map((r) => [r.inventory_item_id, r.error ?? "Nepodařilo se uložit."])
        )
      );

      const requestId = odpoved.request_id;
      const undoId =
        povedene.length > 0
          ? pushUndo(`Naskladnění ${pieces(odpoved.added_total)}`, async () => {
              const vraceni = await sdk.client.fetch<VraceniOdpoved>(
                "/admin/workbench/inventory/add-stock-batch/undo",
                { method: "POST", body: { request_id: requestId } }
              );
              setVysledek((v) =>
                v && v.requestId === requestId ? { ...v, vraceno: { ...vraceni, nazvy } } : v
              );
              await obnovit();
              if (vraceni.ok_count === 0) {
                const duvod = vraceni.results.find((r) => !r.ok)?.error;
                throw new Error(duvod ?? "Nic se nevrátilo.");
              }
              if (vraceni.skipped_count > 0) {
                toast.warning(
                  `U ${formatCount(vraceni.skipped_count, "položky", "položek", "položek")} počet zůstal — důvod je nahoře na stránce.`
                );
              }
            })
          : null;

      setVysledek({
        requestId,
        kusy: odpoved.added_total,
        produkty: pocetProduktu(povedeneRadky.map((p) => p.radek)),
        polozky: povedeneRadky.map((p) => ({ nazev: nazev(p.radek), kusy: p.kusy })),
        nepovedlo: nepovedene.length,
        cekajici: povedeneRadky.some((p) => p.radek.waiting_customers > 0),
        undoId,
        vraceno: null,
      });
      if (nepovedene.length === 0) {
        setPoVypalu(false);
        setHledat("");
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
      await obnovit();
    },
    // id dávky zůstává: když server uložil a jen nedošla odpověď, opakování nic nezdvojí.
    onError: (error) => toast.error(ceskaChyba(error, "Naskladnění se nepodařilo uložit")),
    onSettled: () => {
      odesila.current = false;
    },
  });

  const odeslat = () => {
    // `isPending` se projeví až po dalším vykreslení — druhé kliknutí dvojkliku ho ještě nevidí.
    if (odesila.current || platne.length === 0 || chybnych > 0) return;
    odesila.current = true;
    if (!idDavky.current) idDavky.current = noveIdDavky();
    naskladnit.mutate({
      request_id: idDavky.current,
      items: platne.map((z) => ({
        inventory_item_id: z.radek.inventory_item_id as string,
        quantity: z.kusy,
      })),
    });
  };

  const zrusitPoVypalu = async () => {
    if (zadane.length > 0) {
      const ano = await prompt({
        title: "Zahodit vyplněné počty?",
        description: "Nic se zatím neuložilo. Vyplněná čísla se smažou.",
        confirmText: "Zahodit",
        cancelText: "Pokračovat ve vyplňování",
      });
      if (!ano) return;
    }
    idDavky.current = null;
    setRozepsano({});
    setChybyRadku({});
    setPoVypalu(false);
  };

  const hledani = (
    <div className="flex flex-wrap items-center gap-3 px-6 py-4">
      <div className="w-full sm:w-96">
        <Input
          type="search"
          placeholder="Hledat název, provedení nebo SKU"
          aria-label="Hledat ve skladu"
          value={hledat}
          onChange={(event) => setHledat(event.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <Text size="small" className="text-ui-fg-subtle">
          Řadit
        </Text>
        <Select value={razeni} onValueChange={(v) => setRazeni(v as Razeni)} size="small">
          <Select.Trigger className="w-56" aria-label="Řazení">
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="zajem">Nejdřív o co je zájem</Select.Item>
            <Select.Item value="abeceda">Podle abecedy</Select.Item>
          </Select.Content>
        </Select>
      </div>
    </div>
  );

  const nacitani = isLoading && (
    <div className="flex flex-col gap-y-3 px-6 py-5">
      <Skeleton className="h-12 rounded-lg" />
      <Skeleton className="h-12 rounded-lg" />
    </div>
  );
  const chybaNacteni = isError && (
    <EmptyState title="Zásoby se nepodařilo načíst" description="Zkuste stránku obnovit." />
  );

  if (poVypalu) {
    return (
      <Container className="divide-y p-0">
        <WorkTabs active="zasoby" />
        <header className="flex flex-wrap items-start justify-between gap-3 px-6 pb-4 pt-6">
          <div className="min-w-0">
            <Heading>Naskladnit po výpalu</Heading>
            <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
              U každého výrobku, který vyšel z pece, napište, kolik kusů přibylo. Uložíte
              všechno najednou tlačítkem dole. Výrobek rychle najdete hledáním.
            </Text>
          </div>
        </header>
        {vysledek && <VysledekNaskladneni vysledek={vysledek} zavrit={() => setVysledek(null)} />}
        {hledani}
        {nacitani}
        {chybaNacteni}
        {!isLoading && !isError && radkyPoVypalu.length === 0 && (
          <EmptyState title="Nic takového tu není" description="Zkuste jiné slovo." />
        )}
        {!isLoading && !isError && radkyPoVypalu.length > 0 && (
          <div className="divide-y">
            {radkyPoVypalu.map((radek) => {
              const id = radek.inventory_item_id;
              const text = id ? (rozepsano[id] ?? "") : "";
              const pocet = precistPocet(text);
              const chyba = id ? chybyRadku[id] : undefined;
              return (
                <div key={radek.variant_id} className="flex items-center gap-3 px-6 py-3">
                  <div className="min-w-0 flex-1">
                    <NazevRadku radek={radek} odkaz={false} />
                    <Text size="xsmall" className="text-ui-fg-subtle truncate">
                      {[radek.variant_title, radek.sku].filter(Boolean).join(" · ") ||
                        "bez provedení"}
                    </Text>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Text size="xsmall" className="text-ui-fg-subtle tabular-nums">
                        teď {radek.available} k prodeji
                        {pocet.druh === "ok" ? ` → bude ${radek.available + pocet.kusy}` : ""}
                      </Text>
                      {radek.stav !== "ok" && (
                        <Badge size="2xsmall" color={radek.stav === "out" ? "red" : "orange"}>
                          {stavSlovy[radek.stav]}
                        </Badge>
                      )}
                      <Cekajici radek={radek} />
                    </div>
                    {pocet.druh === "chyba" && (
                      <Text size="xsmall" className="text-ui-fg-error mt-1">
                        Napište celé číslo, třeba 3.
                      </Text>
                    )}
                    {chyba && (
                      <Text size="xsmall" className="text-ui-fg-error mt-1">
                        {chyba}
                      </Text>
                    )}
                  </div>
                  {id ? (
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="+ ks"
                      aria-label={`Kolik kusů přibylo — ${nazev(radek)}`}
                      aria-invalid={pocet.druh === "chyba" || Boolean(chyba)}
                      value={text}
                      onChange={(event) => prepsat(id, event.target.value)}
                      className="w-24 shrink-0"
                    />
                  ) : (
                    <Text size="xsmall" className="text-ui-fg-muted">
                      Upravit lze ve skladu
                    </Text>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="bg-ui-bg-base sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-b-lg px-6 py-4">
          <Text size="small" className={chybnych > 0 ? "text-ui-fg-error" : "text-ui-fg-subtle"}>
            {chybnych > 0
              ? `Opravte čísla u ${formatCount(chybnych, "označené položky", "označených položek", "označených položek")}.`
              : platne.length > 0
                ? `Připraveno: ${kusuCelkem} ks ${uProduktu(pocetProduktu(platne.map((z) => z.radek)))}.`
                : "Zatím nic nevyplněno."}
          </Text>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={zrusitPoVypalu} disabled={naskladnit.isPending}>
              Zrušit
            </Button>
            <Button
              onClick={odeslat}
              isLoading={naskladnit.isPending}
              disabled={platne.length === 0 || chybnych > 0}
            >
              {platne.length > 0
                ? `Naskladnit (${formatCount(platne.length, "položku", "položky", "položek")})`
                : "Naskladnit"}
            </Button>
          </div>
        </div>
      </Container>
    );
  }

  const jinde = zalozky.filter(
    (z) => z.stav && z.stav !== aktivni.stav && pocty[z.stav] > 0
  );

  return (
    <Container className="divide-y p-0">
      {/* Vlastní <Toaster /> tu není: admin má jeden společný a druhý ukazoval každou hlášku dvakrát. */}
      <WorkTabs active="zasoby" />

      <header className="flex flex-wrap items-start justify-between gap-3 px-6 pb-4 pt-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2">
            <Heading>Zásoby</Heading>
            {data && data.waiting_total > 0 && (
              <Badge size="2xsmall" color="orange">
                {formatCount(data.waiting_total, "zákazník čeká", "zákazníci čekají", "zákazníků čeká")}
              </Badge>
            )}
          </div>
          <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
            Kolik čeho máte k prodeji. Napište, kolik kusů přibylo, a my to připočteme —
            celkový stav počítat nemusíte. Po vyložení pece vyplníte víc výrobků najednou
            v „Naskladnit po výpalu".
          </Text>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => {
              setChybyRadku({});
              setPoVypalu(true);
            }}
            disabled={isLoading || isError}
          >
            Naskladnit po výpalu
          </Button>
          <ViewSwitcher value={view} onChange={changeView} modes={["radky", "kompakt"]} />
          <ExpertToggle />
        </div>
      </header>

      {vysledek && <VysledekNaskladneni vysledek={vysledek} zavrit={() => setVysledek(null)} />}

      {aktivni.stav && hledani}

      <SubTabs
        active={aktivni.key}
        onSelect={setStav}
        tabs={zalozky.map((z) => ({
          key: z.key,
          label: z.label,
          count: z.stav ? pocty[z.stav] : undefined,
        }))}
      />

      {aktivni.key === "statistiky" && <SkladStatistiky />}

      {aktivni.stav && nacitani}
      {aktivni.stav && chybaNacteni}

      {aktivni.stav && !isLoading && !isError && radky.length === 0 && (
        hledat.trim() ? (
          <EmptyState
            title="V téhle záložce nic takového není"
            description={
              jinde.length
                ? `Najdete to v: ${jinde.map((z) => `${z.label} (${pocty[z.stav as Stav]})`).join(", ")}.`
                : "Zkuste jiné slovo."
            }
          />
        ) : (
          <EmptyState title={aktivni.empty} description={aktivni.emptyWhy} />
        )
      )}

      {/* Kompaktní — jen kus, stav a přidání; na telefonu u pece. */}
      {aktivni.stav && !isLoading && !isError && radky.length > 0 && view === "kompakt" && (
        <div className="divide-y">
          {radky.map((radek) => (
            <div key={radek.variant_id} className="flex flex-wrap items-center gap-2 px-6 py-1.5">
              <div className="min-w-0 flex-1">
                <Text size="small" className="truncate">
                  {radek.product_id ? (
                    <Link
                      to={`/produkt/${radek.product_id}`}
                      className="hover:underline"
                      title="Otevřít detail produktu"
                    >
                      {radek.product_title || "—"}
                    </Link>
                  ) : (
                    radek.product_title || "—"
                  )}
                  {radek.variant_title ? (
                    <span className="text-ui-fg-muted"> · {radek.variant_title}</span>
                  ) : null}
                </Text>
              </div>
              <Text size="xsmall" className="text-ui-fg-subtle tabular-nums">
                {radek.available} ks
              </Text>
              {radek.waiting_customers > 0 && (
                <Badge size="2xsmall" color="orange">
                  {radek.waiting_customers} čeká
                </Badge>
              )}
              <PridatKusy radek={radek} />
            </div>
          ))}
        </div>
      )}

      {aktivni.stav && !isLoading && !isError && radky.length > 0 && view !== "kompakt" && (
        <div className="divide-y">
          {radky.map((radek) => (
            <article
              key={radek.variant_id}
              className="grid gap-3 px-6 py-4 lg:grid-cols-[minmax(0,1.4fr)_200px_180px_auto] lg:items-center"
            >
              <div className="min-w-0">
                <NazevRadku radek={radek} odkaz />
                <Text size="xsmall" className="text-ui-fg-subtle mt-1 truncate">
                  {[radek.variant_title, radek.sku].filter(Boolean).join(" · ") ||
                    "bez provedení"}
                </Text>
                {expert && <CopyId value={radek.variant_id} />}
              </div>

              <div>
                <Text
                  size="small"
                  weight="plus"
                  className={radek.stav === "out" ? "text-ui-fg-error" : undefined}
                >
                  {radek.available} k prodeji
                </Text>
                {radek.reserved > 0 && (
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {radek.stocked} skladem · {radek.reserved} rezervováno
                  </Text>
                )}
                <div className="mt-1">
                  <HraniceUpozorneni radek={radek} />
                </div>
              </div>

              <div>
                {radek.waiting_customers > 0 ? (
                  <Cekajici radek={radek} />
                ) : (
                  <Text size="xsmall" className="text-ui-fg-muted">
                    nikdo nečeká
                  </Text>
                )}
                {radek.wishlist_count > 0 && (
                  <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                    {radek.wishlist_count}× v oblíbených
                  </Text>
                )}
              </div>

              <div className="flex justify-start lg:justify-end">
                <PridatKusy radek={radek} />
              </div>
            </article>
          ))}
        </div>
      )}
    </Container>
  );
};

/** Celá stránka i s vlastním QueryClientem (každá stránka adminu má svůj kořen). */
export const ZasobyStranka = () => (
  <QueryClientProvider client={adminQueryClient}>
    <ZasobyInner />
  </QueryClientProvider>
);
