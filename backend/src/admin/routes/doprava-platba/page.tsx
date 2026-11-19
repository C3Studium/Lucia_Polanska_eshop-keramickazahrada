import {
  Container,
  Heading,
  Input,
  Text,
  toast,
} from "@medusajs/ui";
import {
  QueryClientProvider, useMutation, useQuery, useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { sdk } from "../../lib/sdk";
import { adminQueryClient } from "../../lib/query-client"
import { ceskaChyba } from "../../lib/ceska-chyba";
import { SaveBar } from "../../components/save-bar";
import { movedTo } from "../../components/section-tabs";
import { NavodTip } from "../../components/navod-tip";
import { DopravaZahranici } from "../../components/doprava-zahranici";

/**
 * Doprava a platba — ceny dopravy a doběrečné na jednom místě (Matěj,
 * 12. 10. 2026: „dobírka patří do nastavení k ceně dopravného, ať jsou
 * vlastní věci u sebe"). Doběrečné se sem přestěhovalo ze stránky Dovolená
 * a oznámení; ukládá se dál do merchant-settings (`dobirka_fee_czk`).
 *
 * Ceny dopravy jsou pevné ceny voleb dopravy v Kč. Každá volba má cenu
 * dvakrát (obecnou a pro region Česká republika) — uložení přepíše obě
 * korunové a ostatní měny nechá být, ať se nic nerozjede.
 *
 * Tvar ceny MUSÍ být jako v nativním adminu: cena v měně
 * `{ id, currency_code, amount }`, cena regionu `{ id, region_id, amount }`.
 * Holé `{ id, amount }` Medusa nespáruje a obecnou cenu SMAŽE (změřeno
 * 12. 10. 2026 na Balíkovně — obnoveno).
 */

type ShippingPrice = {
  id: string;
  amount: number;
  currency_code: string;
  price_rules?: Array<{ attribute: string; value: string }> | null;
};

/** Cena pro POST /admin/shipping-options/:id — tvar podle toho, k čemu patří. */
const pricePayload = (price: ShippingPrice, czk: number) => {
  const amount = String(price.currency_code).toLowerCase() === "czk" ? czk : Number(price.amount);
  const region = (price.price_rules ?? []).find((rule) => rule.attribute === "region_id");
  return region
    ? { id: price.id, region_id: region.value, amount }
    : { id: price.id, currency_code: price.currency_code, amount };
};

type ShippingOption = {
  id: string;
  name: string;
  price_type: "flat" | "calculated";
  data?: Record<string, unknown> | null;
  prices?: ShippingPrice[];
};

const czkOf = (option: ShippingOption): number | null => {
  const price = (option.prices ?? []).find(
    (entry) => String(entry.currency_code).toLowerCase() === "czk"
  );
  return price ? Number(price.amount) : null;
};

/** Text z pole → celé koruny; null = nedá se uložit (prázdné, mimo 0–5000). */
const parsePrice = (value: string): number | null => {
  const parsed = Math.round(Number(value.replace(",", ".")));
  return value.trim() !== "" && Number.isFinite(parsed) && parsed >= 0 && parsed <= 5000
    ? parsed
    : null;
};

/*
 * Ceny dopravy podle druhu (17. 11. 2026, Matěj). Čtyři samostatné volby:
 * Česká pošta a Balíkovna na adresu (malá / velká + příplatek za křehké),
 * Balíkovna BOX / výdejní místo (jedna cena, bez velké zásilky a křehkého)
 * a dopis České pošty jen s poukazy (jedna cena). Ukládá se do voleb
 * dopravy přes /admin/shipping-rates (tam je čte výpočet ceny); první
 * uložení zároveň volby založí / přepne (backend lib/shipping-setup).
 */
type RateGroupKey = "posta" | "balikovna_adresa" | "balikovna_box" | "dopis";
type RateKey = "small" | "large" | "fragile" | "price";
type RatesTable = Record<RateGroupKey, Partial<Record<RateKey, number>>>;

const RATE_SECTIONS: Array<{
  title: string;
  hint: string;
  rows: Array<{ group: RateGroupKey; key: RateKey; label: string }>;
}> = [
  {
    title: "Česká pošta",
    hint: "Na adresu. Velká zásilka = aspoň jeden velký výrobek. Jde na dobírku.",
    rows: [
      { group: "posta", key: "small", label: "Malá zásilka" },
      { group: "posta", key: "large", label: "Velká zásilka" },
      { group: "posta", key: "fragile", label: "Příplatek za křehké" },
    ],
  },
  {
    title: "Balíkovna na adresu",
    hint: "Doručení na adresu zákazníka. Malá / velká, křehké i dobírka.",
    rows: [
      { group: "balikovna_adresa", key: "small", label: "Malá zásilka" },
      { group: "balikovna_adresa", key: "large", label: "Velká zásilka" },
      { group: "balikovna_adresa", key: "fragile", label: "Příplatek za křehké" },
    ],
  },
  {
    title: "Balíkovna — výdejní místo / BOX",
    hint: "Zákazník vybírá místo ve widgetu. Jen malá zásilka — velký ani křehký výrobek sem nejde, dobírka taky ne.",
    rows: [{ group: "balikovna_box", key: "price", label: "Cena" }],
  },
  {
    title: "Česká pošta — dopis (jen poukazy)",
    hint: "Nabízí se jen košíku, ve kterém jsou samé tištěné poukazy.",
    rows: [{ group: "dopis", key: "price", label: "Cena" }],
  },
];
const RATE_ROWS = RATE_SECTIONS.flatMap((section) =>
  section.rows.map((row) => ({ ...row, label: section.title + " — " + row.label }))
);

const rateFieldKey = (group: RateGroupKey, key: RateKey) => group + "." + key;

const ShippingPriceRow = ({
  option,
  value,
  onChange,
}: {
  option: ShippingOption;
  value: string;
  onChange: (value: string) => void;
}) => {
  /* Bez korunové ceny (Slovensko je v eurech) by se napsaná částka neměla
     kam uložit — pricePayload mění jen korunovou cenu. Pole by lhalo. */
  const czk = czkOf(option);
  if (option.price_type === "flat" && czk === null) {
    const currencies = [
      ...new Set((option.prices ?? []).map((price) => price.currency_code.toUpperCase())),
    ].join(", ");
    return (
      <div className="flex items-center justify-between gap-3 py-2">
        <Text size="small">{option.name}</Text>
        <Text size="xsmall" className="text-ui-fg-subtle">
          {currencies ? `cena v ${currencies} — tady se nemění` : "bez ceny"}
        </Text>
      </div>
    );
  }

  if (option.price_type !== "flat") {
    return (
      <div className="flex items-center justify-between gap-3 py-2">
        <Text size="small">{option.name}</Text>
        <Text size="xsmall" className="text-ui-fg-subtle">počítaná cena</Text>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2">
      <Text size="small">{option.name}</Text>
      <div className="flex items-center gap-2">
        <Input
          size="small"
          type="number"
          min={0}
          max={5000}
          className="w-24"
          value={value}
          aria-invalid={value !== String(czk) && parsePrice(value) === null ? true : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        <Text size="small" className="text-ui-fg-subtle">Kč</Text>
      </div>
    </div>
  );
};

const Inner = () => {
  const queryClient = useQueryClient();
  const { data: options, isLoading } = useQuery<{ shipping_options: ShippingOption[] }>({
    queryKey: ["shipping-prices"],
    queryFn: () =>
      sdk.client.fetch(
        "/admin/shipping-options?fields=id,name,price_type,data,*prices,*prices.price_rules&limit=50"
      ),
  });
  const { data: ratesData } = useQuery<{ rates: RatesTable; setup_done?: boolean }>({
    queryKey: ["shipping-rates"],
    queryFn: () => sdk.client.fetch("/admin/shipping-rates"),
  });
  const [rateEdits, setRateEdits] = useState<Record<string, string>>({});
  const savedRate = (group: RateGroupKey, key: RateKey): number | null => {
    const value = ratesData?.rates?.[group]?.[key];
    return typeof value === "number" ? value : null;
  };
  const rateValue = (group: RateGroupKey, key: RateKey) =>
    rateEdits[rateFieldKey(group, key)] ?? String(savedRate(group, key) ?? "");
  const changedRates = RATE_ROWS.filter((row) => {
    const edit = rateEdits[rateFieldKey(row.group, row.key)];
    return edit !== undefined && parsePrice(edit) !== savedRate(row.group, row.key);
  });
  const invalidRates = changedRates.filter(
    (row) => parsePrice(rateEdits[rateFieldKey(row.group, row.key)]) === null
  );
  const { data } = useQuery<{ settings: any }>({
    queryKey: ["merchant-settings"],
    queryFn: () => sdk.client.fetch("/admin/merchant-settings"),
  });

  /* Volby s vypočtenou cenou (Česká pošta, Balíkovna) se nastavují cenami
     podle velikosti výš; tady zbývají jen pevné ceny (osobní odběr). */
  const shippingOptions = (options?.shipping_options ?? [])
    .filter((option) => option.price_type === "flat")
    .sort((a, b) => a.name.localeCompare(b.name, "cs"));

  /* Drží se jen rozepsaná pole (text, ne číslo: prázdné pole při psaní
     nesmí skákat na nulu). Co je změněné, se počítá proti uloženým cenám —
     po uložení a obnově se tak uložené samo přestane hlásit jako změna,
     i kdyby některý zápis z několika selhal. */
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [feeEdit, setFeeEdit] = useState<string | null>(null);

  const priceValue = (option: ShippingOption) =>
    priceEdits[option.id] ?? String(czkOf(option) ?? "");
  const changedPrices = shippingOptions.filter(
    (option) =>
      option.price_type === "flat" &&
      priceEdits[option.id] !== undefined &&
      parsePrice(priceEdits[option.id]) !== czkOf(option)
  );
  const invalidPrices = changedPrices.filter(
    (option) => parsePrice(priceEdits[option.id]) === null
  );

  const savedFee = data?.settings ? Number(data.settings.dobirka_fee_czk ?? 39) : null;
  const codFee = feeEdit ?? (savedFee === null ? "" : String(savedFee));
  /* Sevřené do mezí backendového schématu (0–2000). */
  const codFeeParsed = Math.min(
    2000,
    Math.max(0, Math.round(Number(codFee.replace(",", ".")) || 0))
  );
  const feeChanged = feeEdit !== null && savedFee !== null && codFeeParsed !== savedFee;
  /* Volby dopravy ještě nejsou nastavené → uložení je potřeba i bez změny cen. */
  const setupPending = ratesData ? ratesData.setup_done === false : false;
  const changes =
    changedPrices.length + (feeChanged ? 1 : 0) + changedRates.length + (setupPending && !changedRates.length ? 1 : 0);

  const save = useMutation({
    mutationFn: async () => {
      for (const option of changedPrices) {
        const czk = parsePrice(priceEdits[option.id]) as number;
        await sdk.client.fetch(`/admin/shipping-options/${option.id}`, {
          method: "POST",
          body: {
            // Všechny stávající ceny (jinak by je Medusa smazala); korunové na
            // novou částku, ostatní měny beze změny.
            prices: (option.prices ?? []).map((price) => pricePayload(price, czk)),
          },
        });
      }
      if ((changedRates.length || setupPending) && ratesData?.rates) {
        const table = {} as RatesTable;
        for (const row of RATE_ROWS) {
          const edit = rateEdits[rateFieldKey(row.group, row.key)];
          const parsed = edit !== undefined ? parsePrice(edit) : null;
          table[row.group] = {
            ...(table[row.group] ?? {}),
            [row.key]: parsed !== null ? parsed : savedRate(row.group, row.key) ?? 0,
          };
        }
        await sdk.client.fetch("/admin/shipping-rates", { method: "POST", body: table });
      }
      if (feeChanged) {
        await sdk.client.fetch("/admin/merchant-settings", {
          method: "POST",
          body: { dobirka_fee_czk: codFeeParsed },
        });
      }
    },
    onSuccess: async () => {
      setPriceEdits({});
      setFeeEdit(null);
      setRateEdits({});
      toast.success("Uloženo — platí hned pro nové objednávky.");
    },
    onError: (error) =>
      toast.error(ceskaChyba(error, "Uložení se nepodařilo.")),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["shipping-prices"] });
      await queryClient.invalidateQueries({ queryKey: ["shipping-rates"] });
      await queryClient.invalidateQueries({ queryKey: ["merchant-settings"] });
    },
  });

  const discard = () => {
    setPriceEdits({});
    setFeeEdit(null);
    setRateEdits({});
  };

  return (
    <Container className="divide-y p-0">
      <header className="px-6 pb-4 pt-6">
        <span className="inline-flex items-center gap-1">
          <Heading>Doprava a platba</Heading>
          <NavodTip tema="nastaveni.doprava" />
        </span>
        <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
          Ceny dopravy a příplatek za dobírku. Platí hned pro nové objednávky —
          už vytvořené objednávky se nemění. Balné se nastavuje u každého
          výrobku (Balení).
        </Text>
      </header>

      <section className="flex flex-col gap-y-1 px-6 py-5">
        <Text size="small" weight="plus">Ceny dopravy</Text>
        <Text size="xsmall" className="text-ui-fg-subtle mb-2 max-w-2xl">
          Velikost zásilky se nastavuje u výrobku (Produkty+ nebo detail
          výrobku › Vlastnosti prodeje); stačí jeden velký kus a celá zásilka
          je velká. Když je v košíku cokoli křehkého, přičte se příplatek za
          křehké. Dobírka se přičítá zvlášť (níž).
        </Text>
        {setupPending && (
          <Text size="xsmall" className="text-ui-fg-interactive mb-2 max-w-2xl">
            Uložením se volby dopravy nastaví: přibude Balíkovna na adresu
            a dopis pro poukazy, zmizí stará „Česká Pošta - Křehké" a ceny se
            začnou počítat podle velikosti.
          </Text>
        )}
        {ratesData?.rates ? (
          <div className="flex flex-col gap-y-4">
            {RATE_SECTIONS.map((section) => (
              <div key={section.title}>
                <Text size="small" weight="plus">{section.title}</Text>
                <Text size="xsmall" className="text-ui-fg-subtle">{section.hint}</Text>
                <div className="divide-y">
            {section.rows.map((row) => {
              const field = rateFieldKey(row.group, row.key);
              const value = rateValue(row.group, row.key);
              return (
                <div key={field} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <div>
                    <Text size="small">{row.label}</Text>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      size="small"
                      type="number"
                      min={0}
                      max={5000}
                      className="w-24"
                      value={value}
                      aria-invalid={rateEdits[field] !== undefined && parsePrice(value) === null ? true : undefined}
                      onChange={(event) =>
                        setRateEdits((current) => ({ ...current, [field]: event.target.value }))
                      }
                    />
                    <Text size="small" className="text-ui-fg-subtle">Kč</Text>
                  </div>
                </div>
              );
            })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Text size="small" className="text-ui-fg-muted">Načítám…</Text>
        )}
      </section>

      <section className="flex flex-col gap-y-1 px-6 py-5">
        <Text size="small" weight="plus">Ostatní volby dopravy</Text>
        <Text size="xsmall" className="text-ui-fg-subtle mb-2">
          Kolik zákazník zaplatí za doručení (v Kč). Balné se k tomu připočítá
          zvlášť u každého výrobku.
        </Text>
        {isLoading ? (
          <Text size="small" className="text-ui-fg-muted">Načítám…</Text>
        ) : shippingOptions.length ? (
          <div className="divide-y">
            {shippingOptions.map((option) => (
              <ShippingPriceRow
                key={option.id}
                option={option}
                value={priceValue(option)}
                onChange={(value) =>
                  setPriceEdits((current) => ({ ...current, [option.id]: value }))
                }
              />
            ))}
          </div>
        ) : (
          <Text size="small" className="text-ui-fg-muted">Žádné volby dopravy.</Text>
        )}
      </section>

      <DopravaZahranici />

      <section className="flex flex-col gap-y-4 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-xl">
            <Text size="small" weight="plus">Doběrečné</Text>
            <Text size="xsmall" className="text-ui-fg-subtle mt-0.5">
              Příplatek, který se přičte k objednávce, když si zákazník zvolí
              platbu na dobírku (jen Česká pošta na adresu). Vybírá ho
              doručovatel spolu s cenou zboží a objeví se i na faktuře. Nula
              znamená dobírku bez příplatku.
            </Text>
          </div>
          <div className="flex items-center gap-2">
            <Input
              size="small"
              type="number"
              min={0}
              max={2000}
              className="w-24"
              value={codFee}
              onChange={(e) => setFeeEdit(e.target.value)}
            />
            <Text size="small" className="text-ui-fg-subtle">Kč</Text>
          </div>
        </div>
      </section>

      <SaveBar
        dirty={changes > 0}
        count={changes}
        saving={save.isPending}
        onSave={() => save.mutate()}
        onDiscard={discard}
        problem={
          invalidPrices.length || invalidRates.length
            ? `Cena dopravy musí být celé číslo od 0 do 5000 Kč (${[
                ...invalidPrices.map((option) => option.name),
                ...invalidRates.map((row) => row.label),
              ].join(", ")}).`
            : undefined
        }
      />
    </Container>
  );
};

const queryClient = adminQueryClient;
/** Obsah záložky Nastavení obchodu › Doprava a platba. */
export const DopravaPlatba = () => (
  <QueryClientProvider client={queryClient}><Inner /></QueryClientProvider>
);
/* Bez položky v menu — stránka je záložkou Nastavení obchodu; stará adresa
   tam přesměruje. */
export default movedTo("/nastaveni-obchodu/doprava");
