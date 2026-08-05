import {
  Button,
  Drawer,
  Switch,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
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
  visible_to_customer: boolean;
  created_at: string;
};

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
  const fileInput = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ notes: DiaryNote[] }>({
    queryKey: ["production-diary", orderId],
    queryFn: () =>
      sdk.client.fetch(`/admin/made-to-order/orders/${orderId}/notes`),
    enabled: open,
  });

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

  const removeNote = useMutation({
    mutationFn: (noteId: string) =>
      sdk.client.fetch(`/admin/made-to-order/notes/${noteId}`, {
        method: "DELETE",
      }),
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
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
      <Drawer.Content>
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

          {(data?.notes ?? []).map((note) => (
            <div
              key={note.id}
              className="border-ui-border-base rounded-lg border p-3"
            >
              {note.image_url && (
                <a href={note.image_url} target="_blank" rel="noreferrer">
                  <img
                    src={note.image_url}
                    alt=""
                    className="mb-2 max-h-56 w-full rounded-md object-cover"
                  />
                </a>
              )}
              {note.text && <Text size="small">{note.text}</Text>}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <Text size="xsmall" className="text-ui-fg-muted">
                  {formatDateTime(note.created_at)}
                  {note.visible_to_customer ? " · zákazník vidí" : ""}
                </Text>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="text-ui-fg-interactive txt-small hover:underline"
                    onClick={() => toggleVisibility.mutate(note)}
                  >
                    {note.visible_to_customer ? "Skrýt" : "Ukázat zákazníkovi"}
                  </button>
                  <button
                    type="button"
                    className="text-ui-fg-subtle txt-small hover:underline"
                    onClick={() => removeNote.mutate(note.id)}
                  >
                    Smazat
                  </button>
                </div>
              </div>
            </div>
          ))}
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  );
};
