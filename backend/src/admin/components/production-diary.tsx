import {
  Badge,
  Button,
  Drawer,
  Switch,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { formatDateTime } from "../lib/format";
import { sdk } from "../lib/sdk";

/**
 * Deník výroby — photos and notes that live with the zakázka
 * (feature-ideas 2.1/2.2; Matěj: „something really handy").
 *
 * Designed for the workshop, not the desk: the photo button opens the phone
 * camera directly (`capture="environment"`), an entry is one photo or one
 * sentence, and everything is timestamped without her doing anything. The
 * per-entry „Ukázat zákazníkovi" switch is the whole privacy model — glaze
 * recipes stay hers, the pretty photo travels to the customer's order page.
 *
 * Uploads go through Medusa's own `/admin/uploads` (the MinIO provider), so
 * a diary photo is stored exactly like a product photo.
 */

type DiaryNote = {
  id: string;
  text: string | null;
  image_url: string | null;
  /** Fotky zprávy. Jedno odeslání = jeden řádek s polem fotek. */
  images?: string[] | null;
  visible_to_customer: boolean;
  /** „customer" = napsal zákazník, jinak ateliér (její zápisy a fotky). */
  author?: "customer" | "atelier";
  created_at: string;
};

/** Jedna zpráva ve vlákně — text + všechny její fotky. */
type DiaryMessage = {
  key: string;
  author?: "customer" | "atelier";
  created_at: string;
  text: string | null;
  photos: string[];
  /** Id řádku — „Smazat" smaže zprávu. */
  ids: string[];
  /** Samotný zápis — nese přepínač viditelnosti u ateliéru. */
  single?: DiaryNote;
};

/**
 * Každý řádek deníku je JEDNA zpráva: text + jeho fotky (`images`, u starých
 * řádků `image_url`). Žádné slepování přes `batch_id` — zpráva je atomická už
 * v DB, takže se vlákno nemůže rozpadnout na N bublin.
 */
const toDiaryMessages = (notes: DiaryNote[]): DiaryMessage[] =>
  notes.map((note) => ({
    key: note.id,
    author: note.author,
    created_at: note.created_at,
    text: note.text?.trim() ? note.text : null,
    photos:
      note.images && note.images.length
        ? note.images
        : note.image_url
          ? [note.image_url]
          : [],
    ids: [note.id],
    single: note,
  }));

export const ProductionDiary = ({
  orderId,
  label,
  trigger,
}: {
  /** Medusa order id — the key every diary surface already holds. */
  orderId: string;
  /** What to call the zakázka in the header, e.g. „#1042". */
  label: string;
  trigger: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [share, setShare] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Fotka otevřená přes celou obrazovku (zvětšení z vlákna).
  const [lightbox, setLightbox] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery<{ notes: DiaryNote[] }>({
    queryKey: ["production-diary", orderId],
    queryFn: () =>
      sdk.client.fetch(`/admin/made-to-order/orders/${orderId}/notes`),
    enabled: open,
  });

  // Nové zprávy od zákazníka přicházejí ze storefrontu — administrace o nich
  // sama neví. Při každém otevření drawer proto vytáhneme vlákno načisto, ať
  // tam i právě doručená zpráva je (jinak se ukáže jen stav z minulého otevření).
  useEffect(() => {
    if (open) void refetch();
  }, [open, refetch]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["production-diary", orderId] });

  const addNote = useMutation({
    mutationFn: (payload: {
      text?: string;
      image_url?: string;
      visible_to_customer: boolean;
    }) =>
      sdk.client.fetch(`/admin/made-to-order/orders/${orderId}/notes`, {
        method: "POST",
        body: payload,
      }),
    onSuccess: async () => {
      setText("");
      await invalidate();
      toast.success("Zapsáno do deníku.");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Zápis se nepodařil."
      ),
  });

  const toggleVisibility = useMutation({
    mutationFn: (note: DiaryNote) =>
      sdk.client.fetch(`/admin/made-to-order/notes/${note.id}`, {
        method: "PATCH",
        body: { visible_to_customer: !note.visible_to_customer },
      }),
    onSuccess: async (_result, note) => {
      await invalidate();
      toast.success(
        note.visible_to_customer
          ? "Zákazník už zápis neuvidí."
          : "Zákazník zápis uvidí u své objednávky."
      );
    },
    onError: () => toast.error("Změna se nepodařila."),
  });

  // Smaže celou zprávu — u batche (víc fotek) všechny jeho řádky naráz.
  const removeMessage = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await sdk.client
          .fetch(`/admin/made-to-order/notes/${id}`, { method: "DELETE" })
          .catch(() => undefined);
      }
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Zápis smazán.");
    },
    onError: () => toast.error("Smazání se nepodařilo."),
  });

  /**
   * Photo path: upload first, then create the entry with the returned URL.
   * Raw fetch rather than the JSON client — this is multipart, and the
   * admin session cookie authenticates it.
   */
  const uploadPhoto = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const response = await fetch(`/admin/uploads`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) {
        throw new Error("Fotku se nepodařilo nahrát.");
      }
      const payload = await response.json();
      const url: string | undefined = payload?.files?.[0]?.url;
      if (!url) {
        throw new Error("Úložiště nevrátilo adresu fotky.");
      }
      await addNote.mutateAsync({
        image_url: url,
        text: text.trim() || undefined,
        visible_to_customer: share,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Fotku se nepodařilo nahrát."
      );
    } finally {
      setUploading(false);
      if (fileInput.current) {
        fileInput.current.value = "";
      }
    }
  };

  return (
    <>
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
      {/* Širší okno — konverzace s fotkami se do úzkého sloupce nevešla. */}
      <Drawer.Content
        style={{ width: "min(46rem, 94vw)", maxWidth: "min(46rem, 94vw)" }}
      >
        <Drawer.Header>
          <Drawer.Title>Deník výroby — {label}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-5 overflow-y-auto">
          <div className="border-ui-border-base rounded-lg border p-3">
            <Textarea
              rows={2}
              placeholder="Např.: Kobalt 2×, druhý výpal 1240 °C…"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2">
                <Switch checked={share} onCheckedChange={setShare} />
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Ukázat zákazníkovi
                </Text>
              </label>
              <div className="flex gap-2">
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) uploadPhoto(file);
                  }}
                />
                <Button
                  size="small"
                  variant="secondary"
                  isLoading={uploading}
                  onClick={() => fileInput.current?.click()}
                >
                  Vyfotit / nahrát
                </Button>
                <Button
                  size="small"
                  isLoading={addNote.isPending && !uploading}
                  disabled={!text.trim()}
                  onClick={() =>
                    addNote.mutate({
                      text: text.trim(),
                      visible_to_customer: share,
                    })
                  }
                >
                  Zapsat
                </Button>
              </div>
            </div>
          </div>

          {isLoading && (
            <Text size="small" className="text-ui-fg-subtle">
              Načítám deník…
            </Text>
          )}

          {!isLoading && (data?.notes ?? []).length === 0 && (
            <Text size="small" className="text-ui-fg-subtle">
              Zatím prázdný. První fotka z kruhu se sem hodí.
            </Text>
          )}

          {toDiaryMessages(data?.notes ?? []).map((msg) => {
            const fromCustomer = msg.author === "customer";
            return (
              <div
                key={msg.key}
                className={
                  fromCustomer
                    ? "border-ui-border-interactive bg-ui-bg-highlight rounded-lg border p-3"
                    : "border-ui-border-base rounded-lg border p-3"
                }
              >
                <div className="mb-2">
                  <Badge size="2xsmall" color={fromCustomer ? "blue" : "grey"}>
                    {fromCustomer ? "Zákazník" : "Ateliér"}
                  </Badge>
                </div>
                {/* Víc fotek z jednoho odeslání = mřížka v jedné zprávě. */}
                {msg.photos.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {msg.photos.map((url) => (
                      <button
                        key={url}
                        type="button"
                        className="h-24 w-28 cursor-zoom-in overflow-hidden rounded-md"
                        onClick={() => setLightbox(url)}
                        title="Zvětšit fotku"
                      >
                        <img
                          src={url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
                {msg.text && <Text size="small">{msg.text}</Text>}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {formatDateTime(msg.created_at)}
                    {!fromCustomer && msg.single?.visible_to_customer
                      ? " · zákazník vidí"
                      : ""}
                  </Text>
                  <div className="flex gap-3">
                    {/* Zprávu zákazníka vidí zákazník vždy (je jeho) — přepínač
                        viditelnosti by tu nedával smysl, zůstává jen smazání. */}
                    {!fromCustomer && msg.single && (
                      <button
                        type="button"
                        className="text-ui-fg-interactive txt-small hover:underline"
                        onClick={() => toggleVisibility.mutate(msg.single!)}
                      >
                        {msg.single.visible_to_customer
                          ? "Skrýt"
                          : "Ukázat zákazníkovi"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-ui-fg-subtle txt-small hover:underline"
                      onClick={() => removeMessage.mutate(msg.ids)}
                    >
                      Smazat
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>

      {/* Fotka přes celou obrazovku — klik kamkoli zavře. z-index nad drawer. */}
      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </>
  );
};
