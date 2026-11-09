import {
  Badge,
  Button,
  Container,
  Heading,
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
/* `lib/shop-texty` je schválně bez jediného importu — jen tak smí do
   prohlížečového bundlu (viz `obsah/page.tsx`). Popisky, nápovědy i výchozí
   znění jsou tak na jednom místě se schématem, které hlídá zápis. */
import {
  SHOP_TEXT_DEFAULTS,
  SHOP_TEXT_GROUPS,
  SHOP_TEXT_KEYS,
  SHOP_TEXT_META,
  shopTextProblem,
  type ShopTextKey,
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
  updated_at: string | null;
  storefront_url: string;
};

const fieldId = (key: ShopTextKey) => `text-${key.replace(/\./g, "-")}`;

const TextField = ({
  textKey,
  value,
  saved,
  zmeneno,
  storefrontUrl,
  onChange,
  onReset,
}: {
  textKey: ShopTextKey;
  value: string;
  /** Co právě platí v obchodě. */
  saved: string;
  /** Má tenhle text vlastní znění, nebo platí výchozí z kódu? */
  zmeneno: boolean;
  storefrontUrl: string;
  onChange: (value: string) => void;
  onReset: () => void;
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
        {prazdne ? (
          <Badge size="2xsmall" color="orange">Neukazuje se</Badge>
        ) : null}
        {neulozeno ? (
          <Badge size="2xsmall" color="orange">Neuloženo</Badge>
        ) : null}
      </div>

      <Text size="small" className="text-ui-fg-subtle max-w-3xl">
        {meta.help}
      </Text>

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
        className="min-h-[88px] max-w-3xl"
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

  /* Jen rozepsaná pole; ostatní ukazují, co právě platí. */
  const [edits, setEdits] = useState<Partial<Record<ShopTextKey, string>>>({});
  const valueOf = (key: ShopTextKey) => edits[key] ?? savedText(key);

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

      {SHOP_TEXT_GROUPS.map((group) => (
        <section key={group} className="px-6 pb-1 pt-5">
          <Heading level="h2">{group}</Heading>
          <div className="divide-y">
            {SHOP_TEXT_KEYS.filter((key) => SHOP_TEXT_META[key].group === group).map(
              (key) => (
                <TextField
                  key={key}
                  textKey={key}
                  value={valueOf(key)}
                  saved={savedText(key)}
                  zmeneno={maVlastni(key)}
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
