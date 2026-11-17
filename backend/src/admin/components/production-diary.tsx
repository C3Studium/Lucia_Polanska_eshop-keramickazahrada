import {
  ArrowUpMini,
  Camera,
  Eye,
  EyeSlash,
  LockClosedSolid,
  Trash,
  XMarkMini,
} from "@medusajs/icons";
import {
  Button,
  Drawer,
  IconButton,
  Text,
  clx,
  toast,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { sdk } from "../lib/sdk";
import { ceskaChyba } from "../lib/ceska-chyba";
import { useCommissionsOfOrder } from "./agreed-price";
import { RowOptionsMenu, type RowOption } from "./row-options-menu";

/**
 * Konverzace se zákazníkem (dřív „Deník výroby") — fotky, zprávy a poznámky,
 * které žijí se zakázkou (feature-ideas 2.1/2.2).
 *
 * 17. 11. 2026 přestavěno jako Zprávy na iPhonu (Matěj: „předělej i tuhle
 * konverzaci"): vlákno od nejstarší dole k nejnovější, zákazník vlevo šedě,
 * my vpravo — modře, co vidí zákazník, žlutě poznámka jen pro ateliér. Pole
 * pro psaní je dole jako v chatu a jeho barva říká, kam zpráva půjde, ať
 * receptura glazury omylem neodletí zákazníkovi e-mailem.
 *
 * Soukromí je pořád jeden příznak `visible_to_customer` — přepínač
 * „Zákazníkovi | Jen pro ateliér" ho jen nastavuje. Zpráva viditelná
 * zákazníkovi mu při odeslání přijde e-mailem (server, ne tahle komponenta).
 *
 * Fotky jdou přes Medusí `/admin/uploads`, uloží se stejně jako fotka
 * produktu. Tlačítko fotky otevře na telefonu rovnou foťák.
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

/** Komu bublina patří — určuje stranu, barvu i popisek. */
type MessageKind = "customer" | "sent" | "note";

/** Jedna zpráva ve vlákně — text + všechny její fotky. */
type DiaryMessage = {
  key: string;
  author?: "customer" | "atelier";
  kind: MessageKind;
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
 *
 * Server vrací nejnovější první; chat se čte shora dolů od nejstarší, proto
 * se tu řadí vzestupně.
 */
const toDiaryMessages = (notes: DiaryNote[]): DiaryMessage[] =>
  [...notes]
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    .map((note) => ({
      key: note.id,
      author: note.author,
      kind:
        note.author === "customer"
          ? "customer"
          : note.visible_to_customer
            ? "sent"
            : "note",
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

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** Oddělovač dne jako ve Zprávách: „Dnes", „Včera", jinak „14. 11.". */
const dayLabel = (iso: string) => {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(date, today)) return "Dnes";
  if (sameDay(date, yesterday)) return "Včera";
  const dayMonth = `${date.getDate()}. ${date.getMonth() + 1}.`;
  return date.getFullYear() === today.getFullYear()
    ? dayMonth
    : `${dayMonth} ${date.getFullYear()}`;
};

const timeLabel = (iso: string) =>
  new Intl.DateTimeFormat("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

/** Zprávy stejného druhu do 10 minut tvoří skupinu — popisek jen u první. */
const GROUP_GAP_MS = 10 * 60 * 1000;

/** Výška pole, nad kterou už se neroztahuje a začne rolovat (≈ 7 řádků). */
const COMPOSER_MAX_PX = 168;

const BUBBLE_TONE: Record<MessageKind, string> = {
  customer: "bg-ui-bg-component text-ui-fg-base border border-ui-border-base",
  sent: "bg-ui-bg-interactive text-ui-fg-on-color",
  note: "bg-ui-tag-orange-bg text-ui-fg-base border border-ui-tag-orange-border",
};

export const ProductionDiary = ({
  orderId,
  productionOrderId,
  label,
  trigger,
}: {
  /** Medusa order id — the key every diary surface already holds. */
  orderId: string;
  /**
   * Zakázka, o které deník je (§ 0c: zakázka = položka). Objednávka jich může
   * mít víc, každá má svoje vlákno — a zpráva „Ukázat zákazníkovi" je e-mail
   * o průběhu TÉ JEDNÉ zakázky. Kdo id nemá (seznam objednávek), nechá ho
   * prázdné a deník se na zakázku zeptá.
   */
  productionOrderId?: string | null;
  /** What to call the zakázka in the header, e.g. „#1042". */
  label: string;
  trigger: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  // Výchozí zůstává „jen pro ateliér" — e-mail zákazníkovi musí být volba,
  // ne omyl.
  const [share, setShare] = useState(false);
  const [uploading, setUploading] = useState(false);
  /** Fotka vybraná do zprávy, ještě neodeslaná (náhled v poli). */
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  // Fotka otevřená přes celou obrazovku (zvětšení z vlákna).
  const [lightbox, setLightbox] = useState<string | null>(null);
  /** Vybraná zakázka, když ji volající neurčil a objednávka jich má víc. */
  const [picked, setPicked] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  /** Držet vlákno dole? Ne, když si Lucie odroluje ke starším zprávám. */
  const stickToBottom = useRef(true);
  const queryClient = useQueryClient();

  /* Zakázky objednávky — dotáhnou se jen tam, kde se musí vybírat. */
  const commissionsQuery = useCommissionsOfOrder(
    orderId,
    open && !productionOrderId
  );
  const commissions = commissionsQuery.data?.production_orders ?? [];
  const activeId =
    productionOrderId ??
    picked ??
    (commissions.length === 1 ? commissions[0].id : null);
  /** Víc zakázek a žádná vybraná — zápis by server odmítl, tak se neposílá. */
  const needsPick = !productionOrderId && commissions.length > 1 && !picked;
  /** Název zakázky do nadpisu — jen když ho nenese už `label` volajícího. */
  const pickedName =
    !productionOrderId && commissions.length > 1
      ? commissions.find((commission) => commission.id === activeId)
          ?.line_title ?? null
      : null;

  const { data, isLoading, refetch } = useQuery<{ notes: DiaryNote[] }>({
    queryKey: ["production-diary", orderId, activeId],
    queryFn: () =>
      sdk.client.fetch(`/admin/made-to-order/orders/${orderId}/notes`, {
        ...(activeId ? { query: { production_order_id: activeId } } : {}),
      }),
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
        // Zápis patří TÉ zakázce — bez id by ho server u víc zakázek odmítl.
        body: {
          ...payload,
          ...(activeId ? { production_order_id: activeId } : {}),
        },
      }),
    onSuccess: async (_result, payload) => {
      setText("");
      await invalidate();
      toast.success(
        payload.visible_to_customer
          ? "Odesláno zákazníkovi."
          : "Poznámka uložena."
      );
    },
    onError: (error) =>
      toast.error(
        ceskaChyba(error, "Zápis se nepodařil.")
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
      // Odesláno — náhled z pole pryč. Při chybě fotka v poli zůstane,
      // ať jde jen zmáčknout odeslat znovu.
      setPendingFile(null);
    } catch (error) {
      toast.error(
        ceskaChyba(error, "Fotku se nepodařilo nahrát.")
      );
    } finally {
      setUploading(false);
      if (fileInput.current) {
        fileInput.current.value = "";
      }
    }
  };

  // Náhled vybrané fotky — adresa z prohlížeče, po výměně/odeslání uvolnit.
  useEffect(() => {
    if (!pendingFile) {
      setPendingPreview(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPendingPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const messages = useMemo(
    () => toDiaryMessages(data?.notes ?? []),
    [data?.notes]
  );

  const scrollToEnd = () => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  // Při otevření začít u nejnovější zprávy, jako ve Zprávách.
  useEffect(() => {
    if (open) stickToBottom.current = true;
  }, [open]);

  // Nová zpráva / načtené vlákno / jiná zakázka → dolů, pokud tam Lucie je.
  useLayoutEffect(() => {
    if (!open || !stickToBottom.current) return;
    const frame = requestAnimationFrame(scrollToEnd);
    return () => cancelAnimationFrame(frame);
  }, [open, messages.length, activeId, isLoading]);

  // Pole roste s textem (do ~7 řádků), pak roluje — jako v iMessage.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_PX)}px`;
  }, [text, open]);

  const busy = uploading || addNote.isPending;
  const canSend = !needsPick && !busy && (!!text.trim() || !!pendingFile);

  const send = () => {
    if (!canSend) return;
    // Po odeslání chceme vidět vlastní zprávu, i když bylo vlákno odrolované.
    stickToBottom.current = true;
    if (pendingFile) {
      void uploadPhoto(pendingFile);
      return;
    }
    addNote.mutate({
      text: text.trim(),
      visible_to_customer: share,
    });
  };

  const messageOptions = (msg: DiaryMessage): RowOption[] => {
    const items: RowOption[] = [];
    // Zprávu zákazníka vidí zákazník vždy (je jeho) — přepínač viditelnosti
    // by tu nedával smysl, zůstává jen smazání.
    if (msg.kind !== "customer" && msg.single) {
      const note = msg.single;
      items.push(
        note.visible_to_customer
          ? {
              label: "Skrýt před zákazníkem",
              icon: <EyeSlash />,
              onSelect: () => toggleVisibility.mutate(note),
            }
          : {
              // Přepnutí už hotové poznámky e-mail neposílá (posílá ho jen
              // nová zpráva) — ať to Lucie nečeká.
              label: "Ukázat zákazníkovi (bez e-mailu)",
              icon: <Eye />,
              onSelect: () => toggleVisibility.mutate(note),
            },
        "separator"
      );
    }
    items.push({
      label: "Smazat",
      icon: <Trash />,
      destructive: true,
      onSelect: () => removeMessage.mutate(msg.ids),
    });
    return items;
  };

  const caption = (kind: MessageKind) => {
    if (kind === "customer") return "Zákazník";
    // Zpráva přepnutá na viditelnou dodatečně e-mailem nešla, proto ne
    // „odesláno e-mailem" — platí to pro všechny modré bubliny.
    if (kind === "sent") return "Vy · vidí i zákazník";
    return (
      <span className="inline-flex items-center gap-1">
        <LockClosedSolid className="h-3 w-3" />
        Jen pro ateliér
      </span>
    );
  };

  const title = [`Konverzace — ${label}`, pickedName]
    .filter(Boolean)
    .join(" — ");

  return (
    <>
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
      {/* Širší okno na počítači; na telefonu přes celou obrazovku bez rámečku,
          ať zbude co nejvíc místa na vlákno a klávesnici. */}
      <Drawer.Content
        className={clx(
          "sm:w-[min(46rem,94vw)] sm:max-w-[min(46rem,94vw)]",
          "max-sm:inset-0 max-sm:w-full max-sm:rounded-none max-sm:border-0"
        )}
      >
        <Drawer.Header>
          <Drawer.Title>{title}</Drawer.Title>
          <Drawer.Description className="text-ui-fg-subtle txt-small">
            Zprávy, které pošlete zákazníkovi, mu přijdou e-mailem. Poznámky
            jen pro ateliér vidíte jen vy.
          </Drawer.Description>
        </Drawer.Header>

        {/* Víc zakázek v objednávce: každá má svoje vlákno, ať zpráva
            (a e-mail z ní) mluví jen o té jedné. */}
        {!productionOrderId && commissions.length > 1 && (
          <div className="border-ui-border-base flex flex-col gap-y-2 border-b px-4 py-3 sm:px-6">
            <Text size="xsmall" className="text-ui-fg-subtle">
              Které zakázky se konverzace týká:
            </Text>
            <div className="flex flex-wrap gap-2">
              {commissions.map((commission, index) => (
                <Button
                  key={commission.id}
                  size="small"
                  variant={activeId === commission.id ? "primary" : "secondary"}
                  onClick={() => setPicked(commission.id)}
                >
                  {commission.line_title || `Zakázka ${index + 1}`}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Vlákno — jediné, co roluje; hlavička i pole zůstávají na místě. */}
        <div
          ref={threadRef}
          onScroll={(event) => {
            const el = event.currentTarget;
            stickToBottom.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
          className="bg-ui-bg-subtle flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4 sm:px-6"
        >
          {isLoading && (
            <div className="flex flex-1 items-center justify-center">
              <Text size="small" className="text-ui-fg-subtle">
                Načítám zprávy…
              </Text>
            </div>
          )}

          {!isLoading && messages.length === 0 && (
            <div className="flex flex-1 items-center justify-center">
              <Text size="small" className="text-ui-fg-subtle">
                Zatím žádné zprávy.
              </Text>
            </div>
          )}

          {/* Krátké vlákno patří dolů k poli, ne nahoru pod hlavičku. */}
          {!isLoading && messages.length > 0 && <div className="flex-1" />}

          {messages.map((msg, index) => {
            const prev = messages[index - 1];
            const date = new Date(msg.created_at);
            const newDay = !prev || !sameDay(new Date(prev.created_at), date);
            const groupStart =
              newDay ||
              prev.kind !== msg.kind ||
              date.getTime() - new Date(prev.created_at).getTime() >
                GROUP_GAP_MS;
            const mine = msg.kind !== "customer";

            return (
              <div key={msg.key} className="flex flex-col">
                {newDay && (
                  <div
                    className={clx(
                      "text-ui-fg-muted txt-compact-xsmall-plus text-center",
                      index === 0 ? "mb-3" : "mb-3 mt-5"
                    )}
                  >
                    {dayLabel(msg.created_at)}
                  </div>
                )}
                {groupStart && (
                  <div
                    className={clx(
                      "txt-compact-xsmall mb-1 px-1",
                      !newDay && "mt-3",
                      mine ? "self-end" : "self-start",
                      msg.kind === "note"
                        ? "text-ui-tag-orange-text"
                        : "text-ui-fg-muted"
                    )}
                  >
                    {caption(msg.kind)}
                  </div>
                )}
                <div
                  className={clx(
                    "group flex items-center gap-1",
                    mine ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div
                    className={clx(
                      "flex min-w-0 max-w-[82%] flex-col sm:max-w-[72%]",
                      mine ? "items-end" : "items-start"
                    )}
                  >
                    <div
                      className={clx(
                        "max-w-full overflow-hidden rounded-2xl",
                        BUBBLE_TONE[msg.kind],
                        msg.photos.length ? "p-1" : "px-3.5 py-2"
                      )}
                    >
                      {/* Víc fotek z jednoho odeslání = mřížka v jedné zprávě. */}
                      {msg.photos.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {msg.photos.map((url) => (
                            <button
                              key={url}
                              type="button"
                              className="block cursor-zoom-in overflow-hidden rounded-xl"
                              onClick={() => setLightbox(url)}
                              title="Zvětšit fotku"
                            >
                              <img
                                src={url}
                                alt=""
                                className="h-36 w-44 max-w-full object-cover sm:h-40 sm:w-52"
                                onLoad={() => {
                                  // Fotka dorazila až po rolování dolů a
                                  // vlákno povyrostlo — dorovnat.
                                  if (stickToBottom.current) scrollToEnd();
                                }}
                              />
                            </button>
                          ))}
                        </div>
                      )}
                      {msg.text && (
                        <p
                          className={clx(
                            "txt-medium whitespace-pre-wrap break-words",
                            msg.photos.length > 0 && "px-2.5 pb-1.5 pt-1.5"
                          )}
                        >
                          {msg.text}
                        </p>
                      )}
                    </div>
                    <span className="text-ui-fg-muted txt-compact-xsmall mb-1 mt-0.5 px-1">
                      {timeLabel(msg.created_at)}
                    </span>
                  </div>
                  {/* „…" u bubliny — na myši se ukáže při najetí, na dotyku
                      je vidět pořád (hover tam není). */}
                  <div
                    className={clx(
                      "-mt-4 shrink-0 opacity-0 transition-opacity",
                      "group-hover:opacity-100 focus-within:opacity-100",
                      "has-[[data-state=open]]:opacity-100",
                      "[@media(hover:none)]:opacity-100"
                    )}
                  >
                    <RowOptionsMenu
                      label="Možnosti zprávy"
                      items={messageOptions(msg)}
                      contentClassName="z-50"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pole pro psaní — dole jako v chatu; barva říká, kam zpráva půjde.
            Spodní odsazení respektuje lištu iPhonu (safe area). */}
        <div
          className="border-ui-border-base bg-ui-bg-base border-t px-3 pt-3 sm:px-6"
          style={{
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
          }}
        >
          <div
            role="radiogroup"
            aria-label="Komu zpráva patří"
            className="bg-ui-bg-component border-ui-border-base mb-2 inline-flex rounded-full border p-0.5"
          >
            <button
              type="button"
              role="radio"
              aria-checked={share}
              onClick={() => setShare(true)}
              className={clx(
                "txt-compact-small-plus min-h-8 rounded-full px-3.5 transition-colors",
                share
                  ? "bg-ui-bg-interactive text-ui-fg-on-color"
                  : "text-ui-fg-subtle hover:text-ui-fg-base"
              )}
            >
              Zákazníkovi
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={!share}
              onClick={() => setShare(false)}
              className={clx(
                "txt-compact-small-plus inline-flex min-h-8 items-center gap-1 rounded-full px-3.5 transition-colors",
                !share
                  ? "bg-ui-tag-orange-bg text-ui-tag-orange-text border-ui-tag-orange-border border"
                  : "text-ui-fg-subtle hover:text-ui-fg-base"
              )}
            >
              <LockClosedSolid className="h-3.5 w-3.5" />
              Jen pro ateliér
            </button>
          </div>

          <div className="flex items-end gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) setPendingFile(file);
              }}
            />
            <IconButton
              type="button"
              variant="transparent"
              size="large"
              aria-label="Vyfotit nebo přidat fotku"
              title="Vyfotit / nahrát"
              disabled={needsPick || busy}
              onClick={() => fileInput.current?.click()}
              className="shrink-0"
            >
              <Camera />
            </IconButton>

            <div
              className={clx(
                "flex min-w-0 flex-1 flex-col rounded-2xl border px-3 py-2 transition-colors",
                share
                  ? "border-ui-border-interactive bg-ui-bg-field"
                  : "border-ui-tag-orange-border bg-ui-tag-orange-bg"
              )}
            >
              {pendingPreview && (
                <div className="relative mb-2 self-start">
                  <img
                    src={pendingPreview}
                    alt="Vybraná fotka"
                    className="h-20 w-24 rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    aria-label="Odebrat fotku"
                    title="Odebrat fotku"
                    disabled={uploading}
                    onClick={() => {
                      setPendingFile(null);
                      if (fileInput.current) fileInput.current.value = "";
                    }}
                    className="bg-ui-bg-base border-ui-border-base text-ui-fg-subtle absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border shadow-sm"
                  >
                    <XMarkMini />
                  </button>
                </div>
              )}
              <textarea
                ref={textareaRef}
                rows={1}
                disabled={needsPick}
                // Na iPhonu pod 16 px Safari při psaní zvětší stránku.
                className="text-ui-fg-base placeholder:text-ui-fg-muted txt-medium block w-full resize-none bg-transparent leading-6 outline-none max-sm:text-[16px]"
                placeholder={
                  share
                    ? "Napište zákazníkovi…"
                    : "Např.: Kobalt 2×, druhý výpal 1240 °C…"
                }
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  // Enter = nový řádek (zprávy bývají delší), ⌘/Ctrl+Enter odešle.
                  if (
                    event.key === "Enter" &&
                    (event.metaKey || event.ctrlKey)
                  ) {
                    event.preventDefault();
                    send();
                  }
                }}
              />
            </div>

            <IconButton
              type="button"
              variant="primary"
              size="large"
              aria-label="Odeslat"
              title="Odeslat (⌘ + Enter)"
              isLoading={busy}
              disabled={!canSend}
              onClick={send}
              className="shrink-0 rounded-full"
            >
              <ArrowUpMini />
            </IconButton>
          </div>

          <Text size="xsmall" className="text-ui-fg-muted mt-1.5 px-1">
            {needsPick
              ? "Nejdřív vyberte zakázku nahoře — zpráva i e-mail z ní půjdou jen o ní."
              : share
                ? "Přijde mu e-mailem."
                : "Zákazník tuhle poznámku neuvidí."}
          </Text>
        </div>
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
