import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Calendar } from "@medusajs/icons";
import {
  Button, Container, Heading, Input, Switch, Text, Toaster, toast,
} from "@medusajs/ui";
import {
  QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { sdk } from "../../lib/sdk";

/**
 * Dovolená a oznámení — the shop's voice on its own page (Matěj,
 * 2026-08-06: own UI, storefront shows it as a card at the top; also for
 * event announcements).
 *
 * Two instruments, one settings write:
 * - **Dovolená** pauses new commissions SERVER-SIDE (payment workflow) and
 *   banners the storefront. Stock items still sell.
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

  useEffect(() => {
    const s = data?.settings;
    if (!s) return;
    setVacation(Boolean(s.vacation_enabled));
    setUntil(s.vacation_until ?? "");
    setVMessage(s.vacation_message ?? "");
    setAnnounce(Boolean(s.announcement_enabled));
    setAText(s.announcement_text ?? "");
  }, [data]);

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
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["merchant-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["storefront-check"] });
      toast.success("Uloženo — obchod to zákazníkům ukáže hned.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Uložení se nepodařilo."),
  });

  return (
    <Container className="divide-y p-0">
      <Toaster />
      <header className="px-6 pb-4 pt-6">
        <Heading>Dovolená a oznámení</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
          Co sem napíšete, uvidí zákazníci nahoře na každé stránce obchodu.
          Dovolená navíc pozastaví nové zakázky — hotové zboží se prodává dál.
        </Text>
      </header>

      <section className="flex flex-col gap-y-4 px-6 py-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Text size="small" weight="plus">Mám dovolenou</Text>
            <Text size="xsmall" className="text-ui-fg-subtle mt-0.5">
              Nové zakázky počkají na váš návrat; systém je zdvořile odmítne sám.
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
          <Input size="small" value={aText}
            placeholder="Např.: V sobotu mě najdete na trhu na Náplavce!"
            onChange={(e) => setAText(e.target.value)} />
        )}
      </section>

      <footer className="px-6 py-4">
        <Button size="small" isLoading={save.isPending} onClick={() => save.mutate()}>
          Uložit
        </Button>
      </footer>
    </Container>
  );
};

const queryClient = new QueryClient();
const Page = () => (
  <QueryClientProvider client={queryClient}><Inner /></QueryClientProvider>
);
export const config = defineRouteConfig({ label: "Dovolená a oznámení", icon: Calendar });
export default Page;
