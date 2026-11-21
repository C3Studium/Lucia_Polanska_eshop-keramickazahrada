import {
  Button,
  Container,
  Heading,
  Input,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui";
import {
  QueryClientProvider, useMutation, useQuery, useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { sdk } from "../../lib/sdk";
import { adminQueryClient } from "../../lib/query-client"
import { ceskaChyba } from "../../lib/ceska-chyba";
import { SaveBar } from "../../components/save-bar";
import { movedTo } from "../../components/section-tabs";

type ZkusebniVysledek = {
  adresa: string | null;
  odeslani: string;
  stav: string | null;
  resend_id: string | null;
};

/** Jedna věta o tom, jak dopadl zkušební e-mail na jednu adresu. */
const vetaVysledku = (kdo: string, v: ZkusebniVysledek): { ok: boolean; text: string } => {
  if (!v.adresa || v.odeslani === "no-recipient") {
    return { ok: false, text: `${kdo}: adresa není nastavená, nic se neposlalo.` };
  }
  if (v.stav === "failure") {
    return { ok: false, text: `${kdo} (${v.adresa}): Resend e-mail nepřijal — zkontrolujte klíč a ověřenou doménu v Resendu.` };
  }
  if (v.stav === "success" || v.resend_id) {
    return { ok: true, text: `${kdo} (${v.adresa}): odesláno, Resend ho přijal.` };
  }
  return { ok: true, text: `${kdo} (${v.adresa}): odesláno, stav doručení zatím neznámý.` };
};

/**
 * E-maily obchodu — kam chodí provozní a vývojářské zprávy.
 *
 * Dvě adresy, jeden zápis do nastavení (merchant-settings):
 * - **Obchod (klientka)** — nová objednávka, zakázka, doplatek, štítek, souhrny.
 * - **Vývojář** — technické hlídky (nezdařené e-maily, chyby dopravce).
 *
 * Prázdné pole = spadne na env `OWNER/DEV_NOTIFICATION_EMAIL`, takže než se tu
 * něco uloží, nic se nerozbije a jede to po staru.
 */
const Inner = () => {
  const queryClient = useQueryClient();
  const { data } = useQuery<{ settings: any }>({
    queryKey: ["merchant-settings"],
    queryFn: () => sdk.client.fetch("/admin/merchant-settings"),
  });

  const [owner, setOwner] = useState("");
  const [dev, setDev] = useState("");
  const [returnAddress, setReturnAddress] = useState("");
  const [returnInstructions, setReturnInstructions] = useState("");

  /* Uložené hodnoty — z nich se plní pole, proti nim se počítají neuložené
     změny a na ně vrací „Zahodit". */
  const s = data?.settings;
  const saved = s
    ? {
        owner: String(s.owner_notification_email ?? ""),
        dev: String(s.dev_notification_email ?? ""),
        returnAddress: String(s.return_address ?? ""),
        returnInstructions: String(s.return_instructions ?? ""),
      }
    : null;
  const reset = () => {
    if (!saved) return;
    setOwner(saved.owner);
    setDev(saved.dev);
    setReturnAddress(saved.returnAddress);
    setReturnInstructions(saved.returnInstructions);
  };
  useEffect(reset, [data]);

  /* Ukládá se oříznuté, tak se i porovnává oříznuté. */
  const changes = saved
    ? [
        owner.trim() !== saved.owner,
        dev.trim() !== saved.dev,
        returnAddress.trim() !== saved.returnAddress,
        returnInstructions.trim() !== saved.returnInstructions,
      ].filter(Boolean).length
    : 0;

  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch("/admin/merchant-settings", {
        method: "POST",
        body: {
          owner_notification_email: owner.trim(),
          dev_notification_email: dev.trim(),
          return_address: returnAddress.trim(),
          return_instructions: returnInstructions.trim(),
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["merchant-settings"] });
      toast.success("Uloženo — další e-maily půjdou podle tohoto nastavení.");
    },
    onError: (error) =>
      toast.error(
        ceskaChyba(error, "Uložení se nepodařilo.")
      ),
  });

  /* Zkušební e-maily (21. 11. 2026) — na uložené adresy, zákazníkům nic. */
  const [vysledek, setVysledek] = useState<Array<{ ok: boolean; text: string }> | null>(null);
  const zkouska = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ obchod: ZkusebniVysledek; vyvojar: ZkusebniVysledek }>(
        "/admin/workbench/zkusebni-emaily",
        { method: "POST" }
      ),
    onSuccess: (result) => {
      const radky = [vetaVysledku("E-mail obchodu", result.obchod), vetaVysledku("Vývojář", result.vyvojar)];
      setVysledek(radky);
      if (radky.every((radek) => radek.ok)) toast.success("Zkušební e-maily odeslané — zkontrolujte obě schránky.");
      else toast.error("Některý zkušební e-mail neodešel — podrobnosti pod tlačítkem.");
    },
    onError: (error) => toast.error(ceskaChyba(error, "Zkušební e-maily se nepodařilo poslat.")),
  });

  return (
    <Container className="divide-y p-0">
      <header className="px-6 pb-4 pt-6">
        <Heading>E-maily obchodu</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
          Kam posílat zprávy o obchodu. Zákaznické e-maily (potvrzení objednávky
          apod.) chodí vždy zákazníkovi — tohle je jen pro vás dva. Dole je
          navíc adresa a pokyny pro vrácení zboží, které zákazník dostane při
          schválené reklamaci či vrácení.
        </Text>
      </header>

      <section className="flex flex-col gap-y-2 px-6 py-5">
        <Text size="small" weight="plus">E-mail obchodu (pro majitelku)</Text>
        <Text size="xsmall" className="text-ui-fg-subtle">
          Nová objednávka, zakázka, doplatek, připravený štítek, denní i týdenní
          souhrn. Sem chodí vše kolem provozu obchodu.
        </Text>
        <Input
          size="small"
          type="email"
          value={owner}
          placeholder="napr. lucie@keramickazahrada.cz"
          onChange={(e) => setOwner(e.target.value)}
        />
      </section>

      <section className="flex flex-col gap-y-2 px-6 py-5">
        <Text size="small" weight="plus">E-mail vývojáře</Text>
        <Text size="xsmall" className="text-ui-fg-subtle">
          Technické hlídky — nezdařené e-maily, chyby dopravce a podobné věci,
          které má řešit vývojář, ne majitelka. Souhrny obchodu sem nechodí
          (jen když e-mail obchodu chybí).
        </Text>
        <Input
          size="small"
          type="email"
          value={dev}
          placeholder="napr. vyvojar@example.com"
          onChange={(e) => setDev(e.target.value)}
        />
      </section>

      <section className="px-6 py-4">
        <Text size="xsmall" className="text-ui-fg-muted">
          Necháte-li pole prázdné, použije se adresa z nastavení serveru
          (OWNER/DEV_NOTIFICATION_EMAIL).
        </Text>
      </section>

      <section className="flex flex-col items-start gap-y-2 px-6 py-5">
        <Text size="small" weight="plus">Zkouška</Text>
        <Text size="xsmall" className="text-ui-fg-subtle max-w-2xl">
          Pošle jeden zkušební e-mail na e-mail obchodu a jeden vývojáři — na
          uložené adresy. Zákazníkům nic neodchází. Hodí se po změně adres
          nebo účtu Resend.
        </Text>
        <Button
          size="small"
          variant="secondary"
          isLoading={zkouska.isPending}
          disabled={changes > 0}
          onClick={() => zkouska.mutate()}
        >
          Poslat zkušební e-maily
        </Button>
        {changes > 0 && (
          <Text size="xsmall" className="text-ui-fg-muted">
            Nejdřív uložte změny — zkouška jde na uložené adresy.
          </Text>
        )}
        {vysledek && (
          <ul className="flex flex-col gap-y-1">
            {vysledek.map((radek) => (
              <li key={radek.text}>
                <Text size="small" className={radek.ok ? "text-ui-fg-base" : "text-ui-fg-error"}>
                  {radek.ok ? "✓ " : "✗ "}
                  {radek.text}
                </Text>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-y-2 px-6 py-5">
        <Text size="small" weight="plus">Adresa pro vrácení zboží</Text>
        <Text size="xsmall" className="text-ui-fg-subtle">
          Kam má zákazník poslat zboží zpět při schválené reklamaci, vrácení
          nebo odstoupení. Dostane ji v e-mailu o schválení a uvidí ji ve stavu
          žádosti na e-shopu. Víceřádkově, jak se píše na balík.
        </Text>
        <Textarea
          rows={3}
          value={returnAddress}
          placeholder={"Keramická zahrada\nPutim 229\n397 01 Putim"}
          onChange={(e) => setReturnAddress(e.target.value)}
        />
      </section>

      <section className="flex flex-col gap-y-2 px-6 py-5">
        <Text size="small" weight="plus">Pokyny k vrácení (volitelné)</Text>
        <Text size="xsmall" className="text-ui-fg-subtle">
          Doplní se pod adresu do e-mailu o schválení — např. jak zabalit a co
          přiložit. Prázdné = bez pokynů.
        </Text>
        <Textarea
          rows={3}
          value={returnInstructions}
          placeholder="Zabalte prosím pečlivě do původní krabice a přiložte číslo objednávky."
          onChange={(e) => setReturnInstructions(e.target.value)}
        />
      </section>

      <section className="px-6 py-4">
        <Text size="xsmall" className="text-ui-fg-muted">
          Prázdná adresa = použije se výchozí adresa ateliéru (Keramická
          zahrada, Putim 229, 397 01 Putim).
        </Text>
      </section>

      <SaveBar
        dirty={changes > 0}
        count={changes}
        saving={save.isPending}
        onSave={() => save.mutate()}
        onDiscard={reset}
      />
    </Container>
  );
};

const queryClient = adminQueryClient;
/** Obsah záložky Nastavení obchodu › E-maily obchodu. */
export const EmailyObchodu = () => (
  <QueryClientProvider client={queryClient}><Inner /></QueryClientProvider>
);
/* Bez položky v menu — stránka je záložkou Nastavení obchodu; stará adresa
   tam přesměruje. */
export default movedTo("/nastaveni-obchodu/emaily");
