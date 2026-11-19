import { Badge, Button, Text, toast } from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { sdk } from "../lib/sdk";
import { ceskaChyba } from "../lib/ceska-chyba";

/**
 * Česká pošta – na adresu zahraničí (19. 11. 2026, docs/cp-kalkulacka/PLAN.md §9).
 *
 * Cena se počítá v pokladně z ceníku České pošty (kalkulačka postaonline.cz,
 * stažená tabulka) podle země, služby a hmotnosti balíku:
 * - mají-li hmotnost všechny výrobky v košíku, sečte se (+ obal),
 * - jinak se vezme průměrná váha balíku odsud.
 * Zákazník platí v eurech, převod kurzem ČNB každý den sám. Dobírka ani
 * Balíkovna do zahraničí nejsou; balík se podává ručně na poště.
 */

type Quote = {
  price_czk: number;
  service: string | null;
  up_to_kg: number | null;
  fallback: boolean;
  manual: boolean;
  currency_code: string;
  amount: number;
};

type Country = {
  country_code: string;
  currency_code: string;
  region: string;
  display_name: string;
  enabled: boolean;
  cp_ships: boolean;
  override_czk: number | null;
  quote: Quote | null;
  /** Ceník ČP v Kč pro průměrnou váhu (i před uložením a bez kurzu). */
  cp: { price_czk: number; service: string; up_to_kg: number; fallback: boolean } | null;
};

type State = {
  option_id: string | null;
  rates_date: string | null;
  fetched_at: string;
  /** `zive` = stažený z kalkulačky ČP (každou noc v 1:00), `tabulka` = záloha z 19. 11. 2026. */
  cenik_zdroj: "zive" | "tabulka";
  cenik_stav: { checked_at: string; ok: boolean; chyby: Array<{ country: string; chyba: string }> } | null;
  /** Všechny služby v ceníku ČP. */
  all_services: string[];
  /** Povolené služby — pokladna z nich vybírá nejlevnější. */
  services: string[];
  parcel_weight_kg: number;
  packaging_kg: number;
  countries: Country[];
};

type CalcRow = { service: string; price_czk: number | null; up_to_kg: number | null; max_kg: number };

const kc = (value: number) => `${new Intl.NumberFormat("cs-CZ").format(value)} Kč`;
const money = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat("cs-CZ", { style: "currency", currency: currency.toUpperCase() }).format(amount);
  } catch {
    return `${amount} ${currency.toUpperCase()}`;
  }
};
const kg = (value: number) => `${String(value).replace(".", ",")} kg`;
const cislo = (text: string) => Number(text.trim().replace(/\s/g, "").replace(",", "."));
const kratce = (service: string) => service.replace(" do zahraničí", "").replace("Standardní balík - ", "Std. ");
const datum = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("cs-CZ");
  } catch {
    return iso;
  }
};
const casDatum = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
};

const pole =
  "bg-ui-bg-field txt-compact-small min-h-[32px] rounded-md border px-2 text-right tabular-nums";

export const DopravaZahranici = () => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<State>({
    queryKey: ["international-shipping"],
    queryFn: () => sdk.client.fetch("/admin/international-shipping"),
  });

  const [vaha, setVaha] = useState("");
  const [obal, setObal] = useState("");
  const [sluzby, setSluzby] = useState<string[]>([]);
  const [zapnuto, setZapnuto] = useState<Record<string, boolean>>({});
  const [vlastni, setVlastni] = useState<Record<string, string>>({});
  const reset = (state: State) => {
    setVaha(String(state.parcel_weight_kg).replace(".", ","));
    setObal(String(state.packaging_kg).replace(".", ","));
    setSluzby(state.services.length ? state.services : state.all_services);
    setZapnuto(Object.fromEntries(state.countries.map((c) => [c.country_code, c.enabled])));
    setVlastni(Object.fromEntries(state.countries.map((c) => [c.country_code, c.override_czk ? String(c.override_czk) : ""])));
  };
  useEffect(() => {
    if (data) reset(data);
  }, [data]);

  const vahaSpatne = !(cislo(vaha) > 0 && cislo(vaha) <= 30);
  /* Ceny v tabulce podle toho, co je právě napsané (ne až po uložení). */
  const nahledKg = vahaSpatne ? null : cislo(vaha);
  const nahled = useQuery<State>({
    queryKey: ["international-shipping", "nahled", nahledKg, sluzby.join("|")],
    queryFn: () =>
      sdk.client.fetch(
        `/admin/international-shipping?kg=${nahledKg}&sluzby=${encodeURIComponent(sluzby.join("|"))}`
      ),
    enabled: Boolean(data) && nahledKg !== null && sluzby.length > 0,
    placeholderData: (previous) => previous,
  });
  const radky = (nahled.data ?? data)?.countries ?? [];
  const tabulkaKg = nahled.data?.parcel_weight_kg ?? data?.parcel_weight_kg ?? 0;
  const obalSpatne = obal.trim() !== "" && !(cislo(obal) >= 0 && cislo(obal) <= 10);
  const vlastniSpatne = Object.values(vlastni).some((v) => v.trim() !== "" && !(cislo(v) > 0 && cislo(v) <= 20000));
  const zmeneno =
    !!data &&
    (cislo(vaha) !== data.parcel_weight_kg ||
      (cislo(obal) || 0) !== data.packaging_kg ||
      [...sluzby].sort().join("|") !== [...(data.services.length ? data.services : data.all_services)].sort().join("|") ||
      !data.option_id ||
      data.countries.some(
        (c) =>
          Boolean(zapnuto[c.country_code]) !== c.enabled ||
          (vlastni[c.country_code] ?? "").trim() !== (c.override_czk ? String(c.override_czk) : "")
      ));

  const ulozit = useMutation({
    mutationFn: () =>
      sdk.client.fetch<State>("/admin/international-shipping", {
        method: "POST",
        body: {
          services: sluzby,
          parcel_weight_kg: cislo(vaha),
          packaging_kg: cislo(obal) || 0,
          countries: Object.entries(zapnuto).filter(([, on]) => on).map(([code]) => code),
          overrides_czk: Object.fromEntries(
            Object.entries(vlastni).filter(([, v]) => v.trim() !== "").map(([code, v]) => [code, cislo(v)])
          ),
        },
      }),
    onSuccess: (next) => {
      queryClient.setQueryData(["international-shipping"], next);
      toast.success("Doprava do zahraničí uložena.");
    },
    onError: (error) => toast.error(ceskaChyba(error, "Uložení se nepodařilo.")),
  });

  /* Ceník ČP: stahuje se každou noc v 1:00; tady jde stáhnout hned. */
  const stahovani = useQuery<{ bezi: boolean }>({
    queryKey: ["international-cenik-bezi"],
    queryFn: () => sdk.client.fetch("/admin/international-shipping/cenik"),
    refetchInterval: (query) => (query.state.data?.bezi ? 5000 : false),
  });
  const bezi = Boolean(stahovani.data?.bezi);
  const byloBezi = useRef(false);
  useEffect(() => {
    if (byloBezi.current && !bezi) {
      queryClient.invalidateQueries({ queryKey: ["international-shipping"] });
      toast.success("Ceník České pošty je stažený.");
    }
    byloBezi.current = bezi;
  }, [bezi, queryClient]);
  const stahnout = useMutation({
    mutationFn: () => sdk.client.fetch<{ bezi: boolean; zprava: string }>("/admin/international-shipping/cenik", { method: "POST" }),
    onSuccess: (odpoved) => {
      toast.info(odpoved.zprava);
      queryClient.setQueryData(["international-cenik-bezi"], { bezi: true });
    },
    onError: (error) => toast.error(ceskaChyba(error, "Stažení se nepodařilo spustit.")),
  });

  /* Malá kalkulačka — jako na postaonline.cz, z téhož ceníku. */
  const [kZeme, setKZeme] = useState("de");
  const [kVaha, setKVaha] = useState("2");
  const kVahaOk = cislo(kVaha) > 0 && cislo(kVaha) <= 30;
  const kalkulacka = useQuery<{ name: string; kg: number; quotes: CalcRow[] }>({
    queryKey: ["international-calc", kZeme, kVaha],
    queryFn: () => sdk.client.fetch(`/admin/international-shipping?zeme=${kZeme}&kg=${cislo(kVaha)}`),
    enabled: kVahaOk && /^[a-z]{2}$/.test(kZeme),
  });

  if (isLoading || !data) {
    return (
      <section className="px-6 py-5">
        <Text size="small" className="text-ui-fg-subtle">Načítám dopravu do zahraničí…</Text>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-y-4 px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2">
            <Text size="small" weight="plus">Česká pošta – na adresu zahraničí</Text>
            {data.option_id ? (
              <Badge size="2xsmall" color="green">Zapnuto</Badge>
            ) : (
              <Badge size="2xsmall" color="orange">Ještě neuloženo — zákazníci ze zahraničí zatím nemají dopravu</Badge>
            )}
          </div>
          <Text size="xsmall" className="text-ui-fg-subtle mt-0.5">
            Pokladna vybere nejlevnější službu České pošty podle země a hmotnosti balíku. Mají-li hmotnost
            všechny výrobky v košíku, sečte se (+ obal). Jinak se použije průměrná váha balíku níž. Název
            služby uvidí zákazník v pokladně a vy v objednávce, e-mailu i na faktuře. Zákazník platí v eurech
            podle kurzu ČNB. Dobírka ani Balíkovna do zahraničí nejsou, balík se podává na poště.
          </Text>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <Text size="xsmall" weight="plus">Průměrná váha balíku</Text>
          <span className="flex items-center gap-1">
            <input aria-label="Průměrná váha balíku v kg" inputMode="decimal" value={vaha} onChange={(e) => setVaha(e.target.value)}
              className={`${pole} w-20 ${vahaSpatne ? "border-ui-border-error" : "border-ui-border-base"}`} />
            <Text size="small" className="text-ui-fg-muted">kg</Text>
          </span>
          <Text size="xsmall" className="text-ui-fg-subtle">Když některý výrobek v košíku nemá vyplněnou hmotnost.</Text>
        </label>
        <label className="flex flex-col gap-1">
          <Text size="xsmall" weight="plus">Obal (krabice a výplň)</Text>
          <span className="flex items-center gap-1">
            <input aria-label="Obal v kg" inputMode="decimal" value={obal} onChange={(e) => setObal(e.target.value)}
              className={`${pole} w-20 ${obalSpatne ? "border-ui-border-error" : "border-ui-border-base"}`} />
            <Text size="small" className="text-ui-fg-muted">kg</Text>
          </span>
          <Text size="xsmall" className="text-ui-fg-subtle">Přičte se k sečteným výrobkům. 0 = jen výrobky.</Text>
        </label>
        <div className="flex flex-col gap-1">
          <Text size="xsmall" weight="plus">Služby České pošty</Text>
          <div className="flex flex-col gap-1">
            {data.all_services.map((nazev) => (
              <label key={nazev} className="txt-compact-small flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sluzby.includes(nazev)}
                  onChange={(e) =>
                    setSluzby((prev) => (e.target.checked ? [...prev, nazev] : prev.filter((x) => x !== nazev)))
                  }
                />
                {kratce(nazev)}
              </label>
            ))}
          </div>
          <Text size="xsmall" className={sluzby.length ? "text-ui-fg-subtle" : "text-ui-fg-error"}>
            {sluzby.length
              ? "Pokladna pro každou zemi a hmotnost vybere nejlevnější z nich a zákazník uvidí její název."
              : "Zaškrtněte aspoň jednu službu."}
          </Text>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg shadow-borders-base">
        <table className="w-full min-w-[640px] text-left">
          <thead className="bg-ui-bg-subtle">
            <tr className="txt-compact-xsmall-plus text-ui-fg-subtle">
              <th className="px-3 py-2">Posílat</th>
              <th className="px-3 py-2">Země</th>
              <th className="px-3 py-2">Nejlevnější ČP pro {kg(tabulkaKg)}</th>
              <th className="px-3 py-2">Vlastní cena</th>
              <th className="px-3 py-2 text-right">Zákazník platí</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {radky.map((c) => {
              const q = c.quote;
              const vlastniCena = (vlastni[c.country_code] ?? "").trim();
              return (
                <tr key={c.country_code} className="txt-compact-small">
                  <td className="px-3 py-2">
                    <input type="checkbox" aria-label={`Posílat do ${c.display_name}`} checked={Boolean(zapnuto[c.country_code])}
                      disabled={!c.cp_ships && !(vlastni[c.country_code] ?? "").trim()}
                      onChange={(e) => setZapnuto((prev) => ({ ...prev, [c.country_code]: e.target.checked }))} />
                  </td>
                  <td className="px-3 py-2">
                    {c.display_name} <span className="text-ui-fg-muted">{c.country_code.toUpperCase()}</span>
                    {c.country_code === "gb" && (
                      <Text size="xsmall" className="text-ui-fg-subtle">Mimo EU — potřebuje celní prohlášení.</Text>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {!c.cp_ships ? (
                      <span className="text-ui-fg-muted">ČP sem balík nevozí</span>
                    ) : c.cp ? (
                      <span className={vlastniCena ? "text-ui-fg-muted line-through" : ""}>
                        {kc(c.cp.price_czk)}{" "}
                        <span className="text-ui-fg-muted">
                          · do {kg(c.cp.up_to_kg)} · {kratce(c.cp.service)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-ui-fg-muted">takhle těžký nevozí</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1">
                      <input aria-label={`Vlastní cena — ${c.display_name}`} inputMode="numeric" placeholder="z ceníku"
                        value={vlastni[c.country_code] ?? ""} onChange={(e) => setVlastni((prev) => ({ ...prev, [c.country_code]: e.target.value }))}
                        className={`${pole} w-24 border-ui-border-base`} />
                      <Text size="small" className="text-ui-fg-muted">Kč</Text>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {!zapnuto[c.country_code] ? (
                      <span className="text-ui-fg-muted">neposílá se</span>
                    ) : q && !vlastniCena ? (
                      money(q.amount, q.currency_code)
                    ) : (
                      <span className="text-ui-fg-muted">po uložení</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Text size="xsmall" className="text-ui-fg-subtle">
              {data.cenik_zdroj === "zive"
                ? `Ceník České pošty stažený ${casDatum(data.fetched_at)} — stahuje se znovu každou noc v 1:00`
                : `Ceník České pošty z ${datum(data.fetched_at)} (záloha) — každou noc v 1:00 se stáhne aktuální`}
              {data.rates_date ? ` · kurz ČNB z ${data.rates_date}` : ""}
            </Text>
            <Button size="small" variant="transparent" disabled={bezi || !data.option_id} isLoading={stahnout.isPending} onClick={() => stahnout.mutate()}>
              {bezi ? "Stahuje se… (pár minut)" : "Stáhnout ceník teď"}
            </Button>
          </div>
          {data.cenik_stav && !data.cenik_stav.ok && (
            <Text size="xsmall" className="text-ui-fg-error">
              Poslední stažení {casDatum(data.cenik_stav.checked_at)} se nepovedlo u{" "}
              {data.cenik_stav.chyby.map((c) => c.country.toUpperCase()).join(", ")} — počítá se z posledních dat.
            </Text>
          )}
        </div>
        <div className="flex items-center gap-2">
          {zmeneno && data.option_id && (
            <Button size="small" variant="secondary" disabled={ulozit.isPending} onClick={() => reset(data)}>
              Zrušit vše
            </Button>
          )}
          <Button size="small" disabled={!zmeneno || vahaSpatne || obalSpatne || vlastniSpatne || !sluzby.length} isLoading={ulozit.isPending} onClick={() => ulozit.mutate()}>
            {data.option_id ? "Uložit vše" : "Uložit a zapnout dopravu do zahraničí"}
          </Button>
        </div>
      </div>

      {/* Malá kalkulačka */}
      <div className="bg-ui-bg-subtle flex flex-col gap-3 rounded-lg p-3">
        <Text size="small" weight="plus">Kalkulačka České pošty</Text>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Země pro kalkulačku" value={kZeme} onChange={(e) => setKZeme(e.target.value)}
            className="bg-ui-bg-field txt-compact-small min-h-[32px] rounded-md border border-ui-border-base px-2">
            {data.countries.map((c) => (
              <option key={c.country_code} value={c.country_code}>{c.display_name}</option>
            ))}
          </select>
          <span className="flex items-center gap-1">
            <input aria-label="Váha pro kalkulačku v kg" inputMode="decimal" value={kVaha} onChange={(e) => setKVaha(e.target.value)}
              className={`${pole} w-20 ${kVahaOk ? "border-ui-border-base" : "border-ui-border-error"}`} />
            <Text size="small" className="text-ui-fg-muted">kg</Text>
          </span>
        </div>
        {kalkulacka.data && (
          <div className="flex flex-col divide-y rounded-md bg-ui-bg-base shadow-borders-base">
            {kalkulacka.data.quotes.map((row) => (
              <div key={row.service} className="flex items-center justify-between gap-3 px-3 py-2">
                <Text size="small" className={sluzby.includes(row.service) ? "" : "text-ui-fg-muted"}>{row.service}</Text>
                <Text size="small" className="tabular-nums">
                  {row.price_czk !== null ? (
                    <>
                      {kc(row.price_czk)} <span className="text-ui-fg-muted">· do {kg(row.up_to_kg ?? 0)}</span>
                    </>
                  ) : row.max_kg ? (
                    <span className="text-ui-fg-muted">jen do {kg(row.max_kg)}</span>
                  ) : (
                    <span className="text-ui-fg-muted">nejede</span>
                  )}
                </Text>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
