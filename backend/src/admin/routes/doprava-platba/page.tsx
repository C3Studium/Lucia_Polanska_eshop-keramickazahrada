import { defineRouteConfig } from "@medusajs/admin-sdk";
import { TruckFast } from "@medusajs/icons";
import {
  Button, Container, Heading, Input, Text, Toaster, toast,
} from "@medusajs/ui";
import {
  QueryClientProvider, useMutation, useQuery, useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { sdk } from "../../lib/sdk";
import { adminQueryClient } from "../../lib/query-client"

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
  prices?: ShippingPrice[];
};

const czkOf = (option: ShippingOption): number | null => {
  const price = (option.prices ?? []).find(
    (entry) => String(entry.currency_code).toLowerCase() === "czk"
  );
  return price ? Number(price.amount) : null;
};

const ShippingPriceRow = ({ option }: { option: ShippingOption }) => {
  const queryClient = useQueryClient();
  const current = czkOf(option);
  const [value, setValue] = useState(current === null ? "" : String(current));
  useEffect(() => {
    setValue(current === null ? "" : String(current));
  }, [current]);

  const parsed = Math.round(Number(value.replace(",", ".")));
  const valid = value.trim() !== "" && Number.isFinite(parsed) && parsed >= 0 && parsed <= 5000;
  const changed = valid && parsed !== current;

  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/shipping-options/${option.id}`, {
        method: "POST",
        body: {
          // Všechny stávající ceny (jinak by je Medusa smazala); korunové na
          // novou částku, ostatní měny beze změny.
          prices: (option.prices ?? []).map((price) => pricePayload(price, parsed)),
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["shipping-prices"] });
      toast.success(`${option.name}: ${parsed} Kč — platí hned pro nové objednávky.`);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Uložení se nepodařilo."),
  });

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
          onChange={(event) => setValue(event.target.value)}
        />
        <Text size="small" className="text-ui-fg-subtle">Kč</Text>
        <Button
          size="small"
          variant="secondary"
          disabled={!changed || save.isPending}
          isLoading={save.isPending}
          onClick={() => save.mutate()}
        >
          Uložit
        </Button>
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
        "/admin/shipping-options?fields=id,name,price_type,*prices,*prices.price_rules&limit=50"
      ),
  });
  const { data } = useQuery<{ settings: any }>({
    queryKey: ["merchant-settings"],
    queryFn: () => sdk.client.fetch("/admin/merchant-settings"),
  });

  /* Text, ne číslo: prázdné pole při psaní nesmí skákat na nulu. */
  const [codFee, setCodFee] = useState("39");
  useEffect(() => {
    const s = data?.settings;
    if (!s) return;
    setCodFee(String(s.dobirka_fee_czk ?? 39));
  }, [data]);

  /* Sevřené do mezí backendového schématu (0–2000). */
  const codFeeParsed = Math.min(
    2000,
    Math.max(0, Math.round(Number(codFee.replace(",", ".")) || 0))
  );

  const saveFee = useMutation({
    mutationFn: () =>
      sdk.client.fetch("/admin/merchant-settings", {
        method: "POST",
        body: { dobirka_fee_czk: codFeeParsed },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["merchant-settings"] });
      toast.success("Doběrečné uloženo — platí hned pro nové objednávky.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Uložení se nepodařilo."),
  });

  const shippingOptions = (options?.shipping_options ?? []).sort((a, b) =>
    a.name.localeCompare(b.name, "cs")
  );

  return (
    <Container className="divide-y p-0">
      <Toaster />
      <header className="px-6 pb-4 pt-6">
        <Heading>Doprava a platba</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
          Ceny dopravy a příplatek za dobírku. Platí hned pro nové objednávky —
          už vytvořené objednávky se nemění. Balné se nastavuje u každého
          výrobku (Balení).
        </Text>
      </header>

      <section className="flex flex-col gap-y-1 px-6 py-5">
        <Text size="small" weight="plus">Ceny dopravy</Text>
        <Text size="xsmall" className="text-ui-fg-subtle mb-2">
          Kolik zákazník zaplatí za doručení (v Kč). Balné se k tomu připočítá
          zvlášť u každého výrobku.
        </Text>
        {isLoading ? (
          <Text size="small" className="text-ui-fg-muted">Načítám…</Text>
        ) : shippingOptions.length ? (
          <div className="divide-y">
            {shippingOptions.map((option) => (
              <ShippingPriceRow key={option.id} option={option} />
            ))}
          </div>
        ) : (
          <Text size="small" className="text-ui-fg-muted">Žádné volby dopravy.</Text>
        )}
      </section>

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
              onChange={(e) => setCodFee(e.target.value)}
            />
            <Text size="small" className="text-ui-fg-subtle">Kč</Text>
            <Button
              size="small"
              variant="secondary"
              isLoading={saveFee.isPending}
              onClick={() => saveFee.mutate()}
            >
              Uložit
            </Button>
          </div>
        </div>
      </section>
    </Container>
  );
};

const queryClient = adminQueryClient;
const Page = () => (
  <QueryClientProvider client={queryClient}><Inner /></QueryClientProvider>
);
export const config = defineRouteConfig({
  label: "Doprava a platba",
  icon: TruckFast,
  rank: 105,
});
export default Page;
