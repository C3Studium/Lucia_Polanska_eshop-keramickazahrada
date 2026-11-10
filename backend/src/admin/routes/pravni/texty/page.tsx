import {
  Badge,
  Container,
  Heading,
  Input,
  Switch,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui";
import {
  QueryClientProvider, useMutation, useQuery, useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { sdk } from "../../../lib/sdk";
import { adminQueryClient } from "../../../lib/query-client";
import { ceskaChyba } from "../../../lib/ceska-chyba";
import { formatDateTime } from "../../../lib/format";
import { SaveBar } from "../../../components/save-bar";
import { SectionPage } from "../../../components/section-tabs";
import { useUrlState } from "../../../lib/url-state";
/* `lib/shop-texty` je schválně bez jediného importu — jen tak smí do
   prohlížečového bundlu (viz `obsah/page.tsx`). Popisky, nápovědy i výchozí
   znění jsou tak na jednom místě se schématem, které hlídá zápis. */
import {
  SHOP_TEXT_DEFAULTS,
  SHOP_TEXT_GROUPS,
  SHOP_TEXT_KEYS,
  SHOP_TEXT_META,
  SHOP_TEXT_OBLASTI,
  oblastSkupiny,
  shopTextProblem,
  skupinyOblasti,
  type ShopTextKey,
  type ShopTextOblast,
  type ShopTextValues,
  type StoredShopTexts,
} from "../../../../lib/shop-texty";

/**
 * Texty — věty, které zákazník čte u výrobku, v košíku, v pokladně a na
 * hotové objednávce.
 *
 * ## Proč vznikla
 *
 * „Tyhle informace je třeba mít všechny v adminu, aby se to dalo upravit."
 * (9. 11. 2026.) Věta o zakázkové výrobě i lhůta, která je na plastiky
 * krátká, stály napevno v kódu obchodu — změnit je znamenalo nasadit novou
 * verzi.
 *
 * ## Proč tady, a ne ve Studiu
 *
 * Stejná úvaha jako u Právních údajů vedle: tyhle věty mluví o tom, jak
 * obchod funguje — kdy se platí, jak dlouho se vyrábí, čím se posílá — a
 * nesmí záviset na tom, jestli Studio běží. Ve Studiu zůstává obsah webu.
 *
 * ## Co stránka vědomě nenabízí
 *
 * Věty, které musí souhlasit s obchodními podmínkami nebo se zákonem:
 * poučení o 14denní lhůtě u zakázky, zaškrtnutí v pokladně, předsmluvní
 * informace. Ty se mění s advokátem a s vydáním nového znění podmínek, ne
 * v políčku. Stránka to říká nahoře a ukazuje, kde se mění.
 */

type TextyResponse = {
  texty: ShopTextValues;
  ulozene: StoredShopTexts;
  vypnute: Partial<Record<ShopTextKey, boolean>>;
  updated_at: string | null;
  storefront_url: string;
};

const fieldId = (key: ShopTextKey) => `text-${key.replace(/\./g, "-")}`;

const TextField = ({
  textKey,
  value,
  saved,
  zmeneno,
  zapnuto,
  storefrontUrl,
  onChange,
  onReset,
  onToggle,
}: {
  textKey: ShopTextKey;
  value: string;
  /** Co právě platí v obchodě. */
  saved: string;
  /** Má tenhle text vlastní znění, nebo platí výchozí z kódu? */
  zmeneno: boolean;
  /** Ukazuje se věta zákazníkovi? */
  zapnuto: boolean;
  storefrontUrl: string;
  onChange: (value: string) => void;
  onReset: () => void;
  onToggle: (zapnuto: boolean) => void;
}) => {
  const meta = SHOP_TEXT_META[textKey];
  const id = fieldId(textKey);
  const vychozi = SHOP_TEXT_DEFAULTS[textKey];
  const delka = value.trim().length;
  const problem = shopTextProblem(textKey, value);
  const prazdne = delka === 0;
  const neulozeno = value.trim() !== saved;
  const jeVychozi = value.trim() === vychozi.trim();

  return (
    <div id={id} className="flex scroll-mt-24 flex-col gap-y-2 py-5">
      <div className="flex flex-wrap items-center gap-2">
        <Text size="small" weight="plus" as="span" id={`${id}-popisek`}>
          {meta.label}
        </Text>
        {zmeneno && !prazdne ? (
          <Badge size="2xsmall" color="blue">Vlastní znění</Badge>
        ) : null}
        {!zapnuto ? (
          <Badge size="2xsmall" color="orange">Vypnuto</Badge>
        ) : null}
        {prazdne && zapnuto ? (
          <Badge size="2xsmall" color="orange">Prázdné</Badge>
        ) : null}
        {neulozeno ? (
          <Badge size="2xsmall" color="orange">Neuloženo</Badge>
        ) : null}
        {/* Vypínač vpravo: vypnutá věta se neukáže, ale znění zůstává. */}
        <label className="ml-auto flex cursor-pointer items-center gap-2">
          <Text size="xsmall" className="text-ui-fg-subtle">
            {zapnuto ? "Ukazuje se" : "Neukazuje se"}
          </Text>
          <Switch
            checked={zapnuto}
            aria-label={`Ukazovat „${meta.label}“ zákazníkům`}
            onCheckedChange={onToggle}
          />
        </label>
      </div>

      <Text size="small" className="text-ui-fg-subtle max-w-3xl">
        {meta.help}
      </Text>

      {meta.pravni ? (
        <Text size="xsmall" className="text-ui-fg-muted max-w-3xl">
          <strong>Pozor:</strong> tahle věta musí souhlasit s obchodními
          podmínkami. Když ji změníte nebo vypnete, upravte i podmínky ve
          Studiu — jinak web tvrdí něco jiného než smlouva.
        </Text>
      ) : null}

      {meta.znacky?.length ? (
        <Text size="xsmall" className="text-ui-fg-muted max-w-3xl">
          Ve větě nechte{" "}
          {meta.znacky.map((znacka, index) => (
            <span key={znacka.znacka}>
              {index > 0 ? ", " : ""}
              <code>{znacka.znacka}</code> — {znacka.popis}
            </span>
          ))}
          . Obchod to nahradí skutečnou hodnotou.
        </Text>
      ) : null}

      <Textarea
        id={`${id}-pole`}
        aria-labelledby={`${id}-popisek`}
        rows={meta.multiline ? 3 : 2}
        value={value}
        aria-invalid={problem ? true : undefined}
        className={
          meta.multiline
            ? "min-h-[88px] max-w-3xl"
            : "min-h-[44px] max-w-3xl"
        }
        disabled={!zapnuto}
        onChange={(event) => onChange(event.target.value)}
      />

      <div className="flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-1">
        <Text
          size="xsmall"
          className={delka > meta.maxLength ? "text-ui-fg-error" : "text-ui-fg-muted"}
        >
          {delka} / {meta.maxLength}
        </Text>
        {!jeVychozi ? (
          <button
            type="button"
            className="text-ui-fg-interactive txt-xsmall hover:underline"
            onClick={onReset}
          >
            Vrátit výchozí znění
          </button>
        ) : null}
        {meta.nahled && storefrontUrl ? (
          <a
            className="text-ui-fg-interactive txt-xsmall hover:underline"
            href={`${storefrontUrl}${meta.nahled}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Podívat se do obchodu
          </a>
        ) : null}
        {problem ? (
          <Text size="xsmall" className="text-ui-fg-error">
            {problem}
          </Text>
        ) : !zapnuto ? (
          <Text size="xsmall" className="text-ui-fg-muted">
            Vypnuto — zákazník větu nevidí. Znění zůstává uložené, přepínačem
            se vrátí.
          </Text>
        ) : prazdne ? (
          <Text size="xsmall" className="text-ui-fg-muted">
            Prázdné pole znamená, že se věta zákazníkovi vůbec neukáže.
          </Text>
        ) : null}
      </div>
    </div>
  );
};

const Inner = () => {
  const queryClient = useQueryClient();
  const { data } = useQuery<TextyResponse>({
    queryKey: ["shop-texty"],
    queryFn: () => sdk.client.fetch("/admin/texty"),
  });

  const platne = data?.texty;
  const savedText = (key: ShopTextKey) =>
    platne?.[key] ?? SHOP_TEXT_DEFAULTS[key];
  const maVlastni = (key: ShopTextKey) =>
    Object.prototype.hasOwnProperty.call(data?.ulozene ?? {}, key);

  /* Vybraná záložka — v adrese, aby přežila odchod na obchod a zpět
     (viz lib/url-state). */
  const [vybranaOblast, setOblast] = useUrlState<ShopTextOblast>(
    "oblast",
    SHOP_TEXT_OBLASTI[0]
  );
  /*
   * Hledání. Při dvou stech textech je nutnost: člověk větu zná ze stránky
   * obchodu a potřebuje ji najít, ne hádat, do které záložky ji kdo zařadil.
   * Hledá se v názvu pole, v nápovědě i v samotném znění, a napříč všemi
   * záložkami — jinak by hledání selhávalo přesně tehdy, když je potřeba.
   */
  const [hledat, setHledat] = useUrlState<string>("hledat", "");
  const hledaneSlovo = hledat.trim().toLowerCase();

  /* Jen rozepsaná pole; ostatní ukazují, co právě platí. */
  const [edits, setEdits] = useState<Partial<Record<ShopTextKey, string>>>({});
  const valueOf = (key: ShopTextKey) => edits[key] ?? savedText(key);
  const zapnutoSaved = (key: ShopTextKey) => data?.vypnute?.[key] !== true;

  const sedi = (key: ShopTextKey) => {
    if (!hledaneSlovo) return true;
    const meta = SHOP_TEXT_META[key];
    return (
      `${meta.label} ${meta.help} ${valueOf(key)} ${meta.group}`
        .toLowerCase()
        .includes(hledaneSlovo)
    );
  };
  const nalezeno = SHOP_TEXT_KEYS.filter(sedi);

  const changedKeys = SHOP_TEXT_KEYS.filter(
    (key) => key in edits && (edits[key] ?? "").trim() !== savedText(key)
  );
  const problems = SHOP_TEXT_KEYS.filter((key) => shopTextProblem(key, valueOf(key)));
  const storefrontUrl = data?.storefront_url ?? "";

  const save = useMutation({
    mutationFn: (texty: Partial<Record<ShopTextKey, string>>) =>
      sdk.client.fetch("/admin/texty", { method: "POST", body: { texty } }),
    onSuccess: async (_response, sent) => {
      await queryClient.invalidateQueries({ queryKey: ["shop-texty"] });
      setEdits((current) =>
        Object.fromEntries(
          Object.entries(current).filter(
            ([key, value]) => (value ?? "").trim() !== sent[key as ShopTextKey]
          )
        )
      );
      toast.success("Uloženo — obchod to ukáže do minuty.");
    },
    onError: (error) => toast.error(ceskaChyba(error, "Uložení se nepodařilo.")),
  });

  /*
   * Vypínač se ukládá HNED, bez lišty Uložit. Je to jedno ťuknutí s jasným
   * výsledkem — „ukazuje se / neukazuje se" — a schovávat ho za Uložit by
   * znamenalo, že si člověk přepne tři věty a pak neví, co je rozepsané.
   */
  const toggle = useMutation({
    mutationFn: ({ key, zapnuto }: { key: ShopTextKey; zapnuto: boolean }) =>
      sdk.client.fetch("/admin/texty", {
        method: "POST",
        body: { vypnute: { [key]: !zapnuto } },
      }),
    onSuccess: async (_response, { zapnuto }) => {
      await queryClient.invalidateQueries({ queryKey: ["shop-texty"] });
      toast.success(
        zapnuto
          ? "Věta se zase ukazuje — obchod to vezme do minuty."
          : "Věta se přestala ukazovat. Znění zůstává uložené."
      );
    },
    onError: (error) => toast.error(ceskaChyba(error, "Nepodařilo se přepnout.")),
  });

  return (
    <Container className="divide-y p-0">
      <header className="px-6 pb-4 pt-6">
        <Heading>Texty obchodu</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-2 max-w-3xl">
          Věty, které zákazník čte u výrobku, v košíku, v pokladně a na hotové
          objednávce — jak dlouho se vyrábí, jak probíhá zakázka, čím se posílá
          a kdy se platí. Mění se tady, bez nasazování nové verze obchodu.
        </Text>
      </header>

      <section className="flex flex-col gap-y-3 px-6 py-5">
        <div className="flex max-w-3xl flex-col gap-y-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-4">
          <Text size="small">
            Pište obyčejný text, bez formátování. Prázdné pole znamená, že se
            věta zákazníkovi vůbec neukáže; původní znění vrátíte odkazem pod
            polem.
          </Text>
          <Text size="small" weight="plus">
            Co tady schválně není
          </Text>
          <Text size="small" className="text-ui-fg-subtle">
            Poučení o 14denní lhůtě u zakázky, zaškrtnutí v pokladně
            a předsmluvní informace. Ty musí souhlasit s obchodními podmínkami
            — mění se s novým zněním podmínek ve Studiu, ne tady.
          </Text>
          {data?.updated_at ? (
            <Text size="xsmall" className="text-ui-fg-muted">
              Naposledy změněno {formatDateTime(data.updated_at)}.
            </Text>
          ) : (
            <Text size="xsmall" className="text-ui-fg-muted">
              Zatím platí všechna výchozí znění.
            </Text>
          )}
        </div>
      </section>

      {/*
        Záložky podle toho, čeho se text týká; uvnitř skupiny podle toho, kde
        v obchodě stojí. Sto čtyřicet polí pod sebou se nedá projít — tohle
        je ta orientace (Matěj, 9. 11. 2026).
      */}
      <div className="flex flex-wrap items-center gap-3 px-6 pt-4">
        <Input
          type="search"
          size="small"
          className="max-w-md flex-1"
          placeholder="Najít větu — podle znění, názvu pole nebo stránky"
          value={hledat}
          onChange={(event) => setHledat(event.target.value)}
        />
        <Text size="small" className="text-ui-fg-subtle">
          {hledaneSlovo
            ? `Nalezeno ${nalezeno.length} z ${SHOP_TEXT_KEYS.length}`
            : `Celkem ${SHOP_TEXT_KEYS.length} textů`}
        </Text>
      </div>

      <nav
        aria-label="Oblasti textů"
        className={`flex flex-wrap items-center gap-x-1 gap-y-1 px-6 py-3 ${
          hledaneSlovo ? "hidden" : ""
        }`}
      >
        {SHOP_TEXT_OBLASTI.map((oblast) => {
          const aktivni = oblast === vybranaOblast;
          const pocet = SHOP_TEXT_KEYS.filter(
            (key) => oblastSkupiny(SHOP_TEXT_META[key].group) === oblast
          ).length;
          return (
            <button
              key={oblast}
              type="button"
              aria-current={aktivni ? "page" : undefined}
              onClick={() => setOblast(oblast)}
              className={
                aktivni
                  ? "bg-ui-bg-base-pressed text-ui-fg-base rounded-md px-3 py-1.5"
                  : "text-ui-fg-subtle hover:bg-ui-bg-base-hover hover:text-ui-fg-base rounded-md px-3 py-1.5"
              }
            >
              <Text size="small" weight={aktivni ? "plus" : "regular"}>
                {oblast}{" "}
                <span className="text-ui-fg-muted">({pocet})</span>
              </Text>
            </button>
          );
        })}
      </nav>

      {/* Při hledání se záložky obcházejí — hledá se napříč celým obchodem. */}
      {(hledaneSlovo
        ? SHOP_TEXT_GROUPS.filter((group) =>
            nalezeno.some((key) => SHOP_TEXT_META[key].group === group)
          )
        : skupinyOblasti(vybranaOblast)
      ).map((group) => (
        <section key={group} className="px-6 pb-1 pt-5">
          <Heading level="h2">{group}</Heading>
          {hledaneSlovo ? (
            <Text size="xsmall" className="text-ui-fg-muted">
              {oblastSkupiny(group)}
            </Text>
          ) : null}
          <div className="divide-y">
            {nalezeno.filter((key) => SHOP_TEXT_META[key].group === group).map(
              (key) => (
                <TextField
                  key={key}
                  textKey={key}
                  value={valueOf(key)}
                  saved={savedText(key)}
                  zmeneno={maVlastni(key)}
                  zapnuto={zapnutoSaved(key)}
                  onToggle={(zapnuto) => toggle.mutate({ key, zapnuto })}
                  storefrontUrl={storefrontUrl}
                  onChange={(value) =>
                    setEdits((current) => ({ ...current, [key]: value }))
                  }
                  onReset={() =>
                    setEdits((current) => ({
                      ...current,
                      [key]: SHOP_TEXT_DEFAULTS[key],
                    }))
                  }
                />
              )
            )}
          </div>
        </section>
      ))}

      <SaveBar
        dirty={changedKeys.length > 0}
        count={changedKeys.length}
        saving={save.isPending}
        onSave={() =>
          save.mutate(
            Object.fromEntries(
              changedKeys.map((key) => [key, (edits[key] ?? "").trim()])
            )
          )
        }
        onDiscard={() => setEdits({})}
        problem={
          problems.length
            ? `Opravte ${problems.length === 1 ? "zvýrazněné pole" : `zvýrazněná pole (${problems.length})`}.`
            : undefined
        }
      />
    </Container>
  );
};

const queryClient = adminQueryClient;

/** Právní věci a texty › Texty (bez vlastní položky v menu). */
const Page = () => (
  <SectionPage section="pravni" active="texty">
    <QueryClientProvider client={queryClient}>
      <Inner />
    </QueryClientProvider>
  </SectionPage>
);

export default Page;
