import { defineRouteConfig } from "@medusajs/admin-sdk";
import { PencilSquare } from "@medusajs/icons";
import { Button, Container, Heading, Text } from "@medusajs/ui";
import { useEffect, useState } from "react";

import { sdk } from "../../lib/sdk";

/**
 * Obsah webu — rozcestník do Studia.
 *
 * ## Proč je to jen odkaz
 *
 * Tady dřív bydlel protokol synchronizace do Sanity: tabulka běhů a tlačítko
 * „spustit znovu", protože produkty se do Sanity kopírovaly a ta kopie mohla
 * zaostat. Po přechodu na ValeCMS se nekopíruje nic. Produkty, ceny, sklad,
 * objednávky, kurzy i recenze drží Medusa a storefront je čte přímo z ní; CMS
 * drží redakční texty a fotky a o produktech vůbec neví.
 *
 * Není tedy co synchronizovat ani co opravovat, když se to nepovede — a stránka,
 * která by to předstírala, by byla horší než odkaz. Zbyla jedna otázka, na
 * kterou Lucie potřebuje odpověď: „kde se mění text na webu?"
 *
 * ## Proč se to needituje tady
 *
 * Studio vykresluje živý web do rámu a nechá kliknout přímo na text nebo fotku,
 * které se mají změnit. To vyžaduje běžící storefront a jeho stránky — něco,
 * co administrace Medusy nemá a mít nemůže. Vestavět sem druhý, chudší editor
 * by znamenalo dvě místa, kde se mění tentýž text, a jedno z nich by po čase
 * začalo lhát.
 */
const ObsahPage = () => {
  /* The Studio address is server env — the browser bundle can't read it, and
     importing `src/lib/constants` for it drags the entire server framework
     (pg, jsonwebtoken) into the vite bundle and crashes the admin at load.
     One authenticated fetch instead; null = still loading. */
  const [studio, setStudio] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    sdk.client
      .fetch<{ studio_url: string }>("/admin/workbench/cms-config")
      .then((config) => {
        if (!cancelled) setStudio(config.studio_url ?? "");
      })
      .catch(() => {
        if (!cancelled) setStudio("");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Obsah webu</Heading>
      </div>

      <div className="flex flex-col gap-4 px-6 py-6">
        <Text className="text-ui-fg-subtle">
          Texty a fotky, které nejsou z e-shopu — úvodní stránka, kurzy, o mně,
          kontakt — se upravují ve Studiu. Otevře se web a klikne se přímo do
          něj: na text nebo obrázek, který se má změnit.
        </Text>

        <Text className="text-ui-fg-subtle">
          Produkty, ceny, sklad, objednávky, kurzy a recenze zůstávají tady
          v administraci. Ve Studiu je nehledejte.
        </Text>

        {studio === null ? null : studio ? (
          <div>
            {/* Nová karta schválně: administrace je pracovní plocha, ze které se
                odchází a vrací. `noopener` proto, že cílová stránka by jinak
                mohla přepsat adresu té naší přes `window.opener`. */}
            <Button
              variant="primary"
              onClick={() => window.open(studio, "_blank", "noopener,noreferrer")}
            >
              Otevřít Studio
            </Button>
          </div>
        ) : (
          /* Bez adresy se nepředstírá tlačítko, které nikam nevede — řekne se,
             co chybí a kdo to nastaví. Je to jediná proměnná, kterou tahle
             stránka potřebuje. */
          <Text className="text-ui-fg-muted">
            Adresa Studia není nastavená. Doplňte proměnnou{" "}
            <code>CMS_STUDIO_URL</code> v nastavení služby (například{" "}
            <code>https://keramickazahrada.cz/studio</code>) a stránku načtěte
            znovu.
          </Text>
        )}
      </div>
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Obsah webu",
  icon: PencilSquare,
  // Za pracovními stránkami: je to místo, kam se chodí zřídka a odkud se hned
  // odchází jinam. Stejný řád jako mělo „Obsah webu" se Sanity.
  rank: 120,
});

export default ObsahPage;
