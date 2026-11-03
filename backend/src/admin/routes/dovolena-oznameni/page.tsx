import {
  Container,
  Heading,
  Input,
  Switch,
  Text,
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

const savedForm = (s: any) => ({
  vacation: Boolean(s.vacation_enabled),
  until: String(s.vacation_until ?? ""),
  vMessage: String(s.vacation_message ?? ""),
  announce: Boolean(s.announcement_enabled),
  aText: String(s.announcement_text ?? ""),
  aLink: String(s.announcement_link ?? ""),
  /* Výchozí true jako v backendu. */
  company: s.company_purchase_enabled !== false,
});

/**
 * Dovolená a oznámení — the shop's voice on its own page (Matěj,
 * 2026-08-06: own UI, storefront shows it as a card at the top; also for
 * event announcements).
 *
 * Two instruments, one settings write:
 * - **Dovolená** je jen upozornění v obchodě — objednávky ani zakázky
 *   neblokuje (14. 10. 2026) a po dni návratu se sama skryje.
 * - **Oznámení** is banner-only — trhy, výstavy, nové výpaly. No behaviour.
 */
const Inner = () => {
  const queryClient = useQueryClient();
  const { data } = useQuery<{ settings: any }>({
    queryKey: ["merchant-settings"],
    queryFn: () => sdk.client.fetch("/admin/merchant-settings"),
  });

  const [vacation, setVacation] = useState(false);
  const [until, setUntil] = useState("");
  const [vMessage, setVMessage] = useState("");
  const [announce, setAnnounce] = useState(false);
  const [aText, setAText] = useState("");
  const [aLink, setALink] = useState("");
  /* Výchozí true jako v backendu — než dorazí uložená hodnota, ať formulář
     neproblikne vypnutým stavem u něčeho, co je zapnuté. */
  const [company, setCompany] = useState(true);
  // Doběrečné se přestěhovalo na stránku Doprava a platba (12. 10. 2026).

  /* Uložené hodnoty ve stejném tvaru jako formulář — z nich se plní pole,
     proti nim se počítají neuložené změny a na ně vrací „Zahodit". */
  const saved = data?.settings ? savedForm(data.settings) : null;
  const reset = () => {
    if (!saved) return;
    setVacation(saved.vacation);
    setUntil(saved.until);
    setVMessage(saved.vMessage);
    setAnnounce(saved.announce);
    setAText(saved.aText);
    setALink(saved.aLink);
    setCompany(saved.company);
  };
  useEffect(reset, [data]);

  const current = { vacation, until, vMessage, announce, aText, aLink: aLink.trim(), company };
  const changes = saved
    ? (Object.keys(current) as Array<keyof typeof current>).filter(
        (key) => current[key] !== saved[key]
      ).length
    : 0;

  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch("/admin/merchant-settings", {
        method: "POST",
        body: {
          vacation_enabled: vacation,
          vacation_until: until,
          vacation_message: vMessage,
          announcement_enabled: announce,
          announcement_text: aText,
          announcement_link: aLink.trim(),
          company_purchase_enabled: company,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["merchant-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["storefront-check"] });
      toast.success("Uloženo — obchod to zákazníkům ukáže hned.");
    },
    onError: (error) =>
      toast.error(ceskaChyba(error, "Uložení se nepodařilo.")),
  });

  return (
    <Container className="divide-y p-0">
      <header className="px-6 pb-4 pt-6">
        <Heading>Dovolená a oznámení</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
          Co sem napíšete, uvidí zákazníci nahoře na každé stránce obchodu
          i v pokladně. Nakupovat jde dál — dovolená nic neblokuje.
        </Text>
      </header>

      <section className="flex flex-col gap-y-4 px-6 py-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Text size="small" weight="plus">Mám dovolenou</Text>
            <Text size="xsmall" className="text-ui-fg-subtle mt-0.5">
              Objednávky i zakázky chodí dál; zákazník uvidí, že je vyřídíte
              po návratu. Ode dne návratu se upozornění samo skryje.
            </Text>
          </div>
          <Switch checked={vacation} onCheckedChange={setVacation} />
        </div>
        {vacation && (
          <div className="flex flex-wrap gap-3">
            <div>
              <Text size="xsmall" className="text-ui-fg-subtle mb-1">Návrat</Text>
              <Input size="small" type="date" value={until}
                onChange={(e) => setUntil(e.target.value)} />
            </div>
            <div className="min-w-64 flex-1">
              <Text size="xsmall" className="text-ui-fg-subtle mb-1">
                Vzkaz zákazníkům (nepovinné)
              </Text>
              <Input size="small" value={vMessage}
                placeholder="Např.: Jsem u moře a sbírám inspiraci — píšu si vaše přání!"
                onChange={(e) => setVMessage(e.target.value)} />
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-y-4 px-6 py-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Text size="small" weight="plus">Oznámení</Text>
            <Text size="xsmall" className="text-ui-fg-subtle mt-0.5">
              Trhy, výstavy, nový výpal — jen se ukáže, nic nepozastavuje.
            </Text>
          </div>
          <Switch checked={announce} onCheckedChange={setAnnounce} />
        </div>
        {announce && (
          <div className="flex flex-col gap-y-2">
            <Input size="small" value={aText}
              placeholder="Např.: V sobotu mě najdete na trhu na Náplavce!"
              onChange={(e) => setAText(e.target.value)} />
            <div>
              <Text size="xsmall" className="text-ui-fg-subtle mb-1">
                Odkaz pod tlačítkem (nepovinné) — mapa trhu, stránka události…
              </Text>
              <Input size="small" type="url" value={aLink}
                placeholder="https://…"
                onChange={(e) => setALink(e.target.value)} />
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-y-4 px-6 py-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Text size="small" weight="plus">Nákup na firmu</Text>
            <Text size="xsmall" className="text-ui-fg-subtle mt-0.5">
              Zákazník může v pokladně vyplnit IČO, DIČ a sídlo, aby dostal
              fakturu na firmu. Vypnutím se ta volba v obchodě jen schová —
              objednávky, které tak už vznikly, zůstávají i s údaji na faktuře.
            </Text>
          </div>
          <Switch checked={company} onCheckedChange={setCompany} />
        </div>
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
/** Obsah záložky Nastavení obchodu › Dovolená a oznámení. */
export const DovolenaOznameni = () => (
  <QueryClientProvider client={queryClient}><Inner /></QueryClientProvider>
);
/* Bez položky v menu — stránka je záložkou Nastavení obchodu; stará adresa
   (odkaz z Přehledu, záložky v prohlížeči) tam přesměruje. */
export default movedTo("/nastaveni-obchodu");
