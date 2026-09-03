import { Button, Drawer, Input, Text, Textarea, toast } from "@medusajs/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { sdk } from "../lib/sdk";

/**
 * Kolekce, jak ji vidí zákazník — jméno, fotka, podtitulek.
 *
 * Tři věci, které o kolekci stojí na úvodní stránce obchodu, na jednom místě. Dřív se fotka
 * nastavovala drobným odkazem ve sloupci a podtitulek neexistoval vůbec: text pod jménem
 * kolekce se psal v CMS zvlášť a párovat ho s kolekcí musel člověk podle handle. Kolekce je
 * ale katalog — když se přejmenuje nebo smaže, má se s ní hnout i její popisek, a to jde
 * jedině tehdy, když bydlí u ní.
 *
 * ## Kam se to ukládá
 *
 * `title` je vlastní pole kolekce. Fotka a podtitulek jdou do `metadata` pod klíče `image`
 * a `subtitle`; `image` tam byl už dřív a čte ho menu obchodu, takže se nepřejmenovává.
 *
 * Metadata se v Meduse PŘEPISUJÍ celá, ne slučují — proto se posílá vždy rozbalená kopie
 * těch stávajících. Bez toho by uložení podtitulku smazalo fotku i příznak `hidden`.
 */
export type AdminCollection = {
  id: string;
  title: string;
  metadata?: Record<string, unknown> | null;
};

export const CollectionDrawer = ({
  collection,
  open,
  onOpenChange,
  onSaved,
}: {
  collection: AdminCollection | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** Pozve rodiče, aby si přenačetl kolekce — seznam vlevo ukazuje jméno i fotku. */
  onSaved: () => Promise<unknown> | unknown;
}) => {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [image, setImage] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  /* Rozepsané pole se plní z kolekce, ne z klávesnice, takže se musí přenačíst pokaždé, když
     se panel otevře nad jinou kolekcí — jinak by v něm zůstal text té předchozí. */
  useEffect(() => {
    if (!open || !collection) return;
    const meta = (collection.metadata ?? {}) as Record<string, unknown>;
    setTitle(collection.title ?? "");
    setSubtitle(typeof meta.subtitle === "string" ? meta.subtitle : "");
    setImage(typeof meta.image === "string" ? meta.image : "");
  }, [open, collection]);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const response = await fetch(`/admin/uploads`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) throw new Error("Fotku se nepodařilo nahrát.");
      const payload = await response.json();
      const url: string | undefined = payload?.files?.[0]?.url;
      if (!url) throw new Error("Úložiště nevrátilo adresu fotky.");
      /* Jen do rozepsaného stavu. Uloží se to spolu se jménem a podtitulkem, aby „Uložit"
         znamenalo totéž pro všechna tři pole — nahraná fotka, kterou pak někdo zavře bez
         uložení, se na web nedostane. */
      setImage(url);
      toast.success("Fotka nahraná — uloží se tlačítkem níž.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nepodařilo se.");
    } finally {
      setUploading(false);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!collection) return;
      const name = title.trim();
      if (!name) throw new Error("Jméno kolekce nesmí zůstat prázdné.");
      return sdk.client.fetch(`/admin/collections/${collection.id}`, {
        method: "POST",
        body: {
          title: name,
          // Metadata se přepisují celá — viz komentář nahoře.
          metadata: {
            ...((collection.metadata ?? {}) as Record<string, unknown>),
            image: image || undefined,
            subtitle: subtitle.trim() || undefined,
          },
        },
      });
    },
    onSuccess: async () => {
      await onSaved();
      await queryClient.invalidateQueries({ queryKey: ["rozdeleni-collections"] });
      toast.success("Uloženo — projeví se v obchodě i na úvodní stránce.");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Nepodařilo se."),
  });

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Kolekce v obchodě</Drawer.Title>
          <Drawer.Description>
            Jak se kolekce ukáže zákazníkovi — na úvodní stránce i v menu.
          </Drawer.Description>
        </Drawer.Header>

        <Drawer.Body className="flex flex-col gap-6 overflow-y-auto">
          <div className="flex flex-col gap-2">
            <Text size="small" weight="plus">Jméno kolekce</Text>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Např. Do zahrady a na fasádu"
            />
            <Text size="xsmall" className="text-ui-fg-muted">
              Stejné jméno nese kolekce všude — v menu, v obchodě i v adrese odkazu.
            </Text>
          </div>

          <div className="flex flex-col gap-2">
            <Text size="small" weight="plus">Fotka</Text>
            <div className="flex items-center gap-3">
              {image ? (
                <img
                  src={image}
                  alt=""
                  className="h-16 w-16 rounded object-cover border border-ui-border-base"
                />
              ) : (
                <div className="h-16 w-16 rounded border border-dashed border-ui-border-base" />
              )}
              <label className="text-ui-fg-interactive txt-small cursor-pointer hover:underline">
                {uploading ? "Nahrávám…" : image ? "Změnit fotku" : "Nastavit fotku"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void upload(file);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
            <Text size="xsmall" className="text-ui-fg-muted">
              Když ji nenastavíte, vezme se fotka prvního produktu v kolekci.
            </Text>
          </div>

          <div className="flex flex-col gap-2">
            <Text size="small" weight="plus">Popisek pod jménem</Text>
            <Textarea
              rows={3}
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Jedna věta, která řekne, co v kolekci je."
            />
            <Text size="xsmall" className="text-ui-fg-muted">
              Ukáže se na kartě kolekce na úvodní stránce. Když ho necháte prázdný, karta
              zůstane jen se jménem.
            </Text>
          </div>
        </Drawer.Body>

        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="secondary">Zavřít</Button>
          </Drawer.Close>
          <Button onClick={() => save.mutate()} isLoading={save.isPending}>
            Uložit
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

export default CollectionDrawer;
