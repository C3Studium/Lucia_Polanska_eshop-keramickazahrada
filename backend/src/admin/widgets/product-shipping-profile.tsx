import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Badge, Button, Container, Heading, Select, Text, toast } from "@medusajs/ui";
import {
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { sdk } from "../lib/sdk";
import { adminQueryClient } from "../lib/query-client"
import { ceskaChyba } from "../lib/ceska-chyba";

/**
 * Profil dopravy u produktu — políčko, které nativní admin nemá.
 *
 * Bez profilu se produkt **nedá prodat**: Medusa při dokončení košíku porovnává
 * profil produktu s profilem zvolené dopravy, a produkt bez profilu se
 * neshodne s ničím. Objednávka spadne — ale až po zaplacení. Nativní stránka
 * produktu přitom profil nikde neukazuje ani nenabízí, takže se ta díra nedala
 * ani zjistit, ani zavřít; jediná cesta byla přes API.
 *
 * Zapisuje se běžnou cestou (`POST /admin/products/:id`), kterou Medusa umí —
 * `updateProductsWorkflow` starý odkaz zruší a založí nový. Chybí opravdu jen
 * to políčko.
 *
 * Pozor na pojmy: profil není „doprava". Na jednom profilu leží všechny
 * nabídky, které k němu patří — u téhle dílny pošta, Balíkovna i osobní odběr.
 * Přiřadit profil tedy znamená zpřístupnit všechny, ne vybrat jednu.
 */
const Inner = ({ productId }: { productId: string }) => {
  const queryClient = useQueryClient();
  const [vybrany, setVybrany] = useState<string>("");

  const { data: produkt } = useQuery<any>({
    queryKey: ["product-shipping-profile", productId],
    queryFn: () =>
      sdk.client.fetch(
        `/admin/products/${productId}?fields=id,*shipping_profile`
      ),
  });

  const { data: profily } = useQuery<any>({
    queryKey: ["shipping-profiles"],
    queryFn: () => sdk.client.fetch("/admin/shipping-profiles?limit=100"),
  });

  /*
   * Kolik dopravy na kterém profilu leží.
   *
   * ZMĚŘENO 31. 10. 2026 na „Domovním znamení": produkt byl přiřazený
   * k profilu „Česká Pošta - Křehké", pod kterým není ŽÁDNÁ volba dopravy —
   * všechny čtyři leží na výchozím profilu. Profil tedy byl vyplněný, odznak
   * hlásil „Lze objednat", a objednávka přesto spadla až při dokončení, po
   * vyplněné adrese a zvolené dopravě. Prázdný profil je stejně fatální jako
   * žádný, takže se počítá a je vidět.
   */
  const { data: dopravy } = useQuery<any>({
    queryKey: ["shipping-options-per-profile"],
    queryFn: () =>
      sdk.client.fetch(
        "/admin/shipping-options?limit=1000&fields=id,name,shipping_profile_id"
      ),
  });

  const soucasny = produkt?.product?.shipping_profile?.id ?? "";

  // Až po načtení: dokud se neví, co produkt má, není co předvybrat.
  useEffect(() => {
    setVybrany(soucasny);
  }, [soucasny]);

  const ulozit = useMutation({
    mutationFn: (shipping_profile_id: string) =>
      sdk.client.fetch(`/admin/products/${productId}`, {
        method: "POST",
        body: { shipping_profile_id },
      }),
    onSuccess: () => {
      toast.success("Profil dopravy uložen.");
      queryClient.invalidateQueries({
        queryKey: ["product-shipping-profile", productId],
      });
    },
    onError: (error: any) =>
      toast.error(ceskaChyba(error, "Profil se nepodařilo uložit.")),
  });

  if (!produkt) return null;

  const nabidka: any[] = profily?.shipping_profiles ?? [];
  const zmeneno = vybrany !== soucasny && Boolean(vybrany);

  /** Počet dopravy na profilu; `null` = ještě se načítá, tak nic netvrdíme. */
  const pocetDopravy = (profileId: string): number | null => {
    const vsechny: any[] | undefined = dopravy?.shipping_options;
    if (!vsechny) return null;
    return vsechny.filter((o) => o?.shipping_profile_id === profileId).length;
  };
  const dopravNaSoucasnem = soucasny ? pocetDopravy(soucasny) : null;
  const prazdnyProfil = dopravNaSoucasnem === 0;
  const lzeObjednat = Boolean(soucasny) && dopravNaSoucasnem !== 0;

  return (
    <Container className="flex flex-col gap-y-3 p-4">
      <div className="flex items-center justify-between">
        <Heading level="h2">Doprava</Heading>
        {lzeObjednat ? (
          <Badge size="2xsmall" color="green">Lze objednat</Badge>
        ) : (
          <Badge size="2xsmall" color="red">Nelze objednat</Badge>
        )}
      </div>

      {!soucasny && (
        <Text size="xsmall" className="text-ui-fg-error">
          Produkt nemá profil dopravy. Zákazník ho vloží do košíku, zaplatí —
          a objednávka teprve pak spadne. Vyberte profil níž.
        </Text>
      )}

      {prazdnyProfil && (
        <Text size="xsmall" className="text-ui-fg-error">
          Na tomhle profilu není žádná doprava, takže objednávka spadne až při
          dokončení — zákazník vyplní adresu, vybere dopravu a teprve pak se to
          odmítne. Přepněte prosím na profil, pod kterým doprava je (obvykle
          výchozí).
        </Text>
      )}

      <Select value={vybrany} onValueChange={setVybrany}>
        <Select.Trigger>
          <Select.Value placeholder="Bez profilu" />
        </Select.Trigger>
        <Select.Content>
          {nabidka.map((profil: any) => {
            const pocet = pocetDopravy(profil.id);
            return (
              <Select.Item key={profil.id} value={profil.id}>
                {profil.name}
                {pocet === 0 ? " — bez dopravy, nelze objednat" : ""}
              </Select.Item>
            );
          })}
        </Select.Content>
      </Select>

      <Text size="xsmall" className="text-ui-fg-subtle">
        Profil zpřístupní všechny dopravy, které na něm leží — u výchozího
        profilu poštu, Balíkovnu i osobní odběr.
      </Text>

      <Button
        size="small"
        variant="secondary"
        disabled={!zmeneno || ulozit.isPending}
        onClick={() => ulozit.mutate(vybrany)}
      >
        {ulozit.isPending ? "Ukládám…" : "Uložit profil"}
      </Button>
    </Container>
  );
};

const queryClient = adminQueryClient;
const Widget = ({ data }: { data: { id: string } }) => (
  <QueryClientProvider client={queryClient}>
    <Inner productId={data.id} />
  </QueryClientProvider>
);

export const config = defineWidgetConfig({ zone: "product.details.side.after" });
export default Widget;
