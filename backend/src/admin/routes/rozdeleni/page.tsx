import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ProductBulkDrawer } from "../../components/product-bulk-drawer";
import {
  ArchiveBox, ArrowUturnLeft, DotsSix, ExclamationCircle, Eye, EyeSlash, Folder,
  ListBullet, ListTree, PencilSquare, Photo, SidebarRight, Trash,
} from "@medusajs/icons";
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Text,
  toast,
} from "@medusajs/ui";
import {
  QueryClientProvider, useMutation, useQuery, useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { CollectionDrawer } from "../../components/collection-drawer";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { ProductLightbox, Thumb } from "../../components/product-thumb";
import { RowOptionsMenu } from "../../components/row-options-menu";
import { VisibilityEye } from "../../components/visibility-eye";
import { useVisibilityToggle } from "../../components/visibility-toggle";
import { sdk } from "../../lib/sdk";
import { ViewSwitcher, gridClassName, useViewMode } from "../../lib/view-mode";
import { adminQueryClient } from "../../lib/query-client"
import { useUrlFlag, useUrlState } from "../../lib/url-state"
import { ceskaChyba } from "../../lib/ceska-chyba";
import { useScrollMemory } from "../../lib/scroll-memory"
import { ulozSeznam } from "../../lib/seznam-kontext"

/**
 * Rozdělení — kolekce → kategorie → produkty as three columns
 * (Matěj, 2026-08-06: the native Produkty pages, but as one simple room).
 *
 * Column 1: every collection, creatable/renamable/deletable. Column 2: the
 * categories that actually occur among the selected collection's products
 * (plus „Bez kategorie") — a collection holding uncategorised products
 * simply shows them without the middle noise. Column 3: the products, every
 * kind with its label, movable to another collection or category on the
 * spot. All writes go through the native admin APIs.
 */

/*
 * Pořadí kolekcí a kategorií v menu E-shop (16. 11. 2026, Matěj).
 *
 * Přetažením za úchyt (šest teček) se mění `metadata.nav_order` — index od
 * 0 do posledního v rámci seznamu. Storefront menu podle něj řadí karty
 * kolekcí i odkazy kategorií v nich (storefront lib/data/navigation.ts).
 * Bez indexu se řadí na konec podle názvu, takže nic nezmizí.
 */
const navOrderOf = (item: any): number => {
  const raw = Number((item?.metadata as any)?.nav_order);
  return Number.isFinite(raw) ? raw : Number.MAX_SAFE_INTEGER;
};
const byNavOrder = (orderOf: (item: any) => number, nameOf: (item: any) => string) =>
  (a: any, b: any) =>
    orderOf(a) - orderOf(b) || nameOf(a).localeCompare(nameOf(b), "cs");

const DND_TEXTS = {
  screenReaderInstructions: {
    draggable:
      "Položku zvednete mezerníkem nebo klávesou Enter. Šipkami nahoru a dolů ji přesunete, mezerníkem položíte, klávesou Escape přesun zrušíte.",
  },
  announcements: {
    onDragStart: () => "Položka zvednuta. Šipkami ji přesuňte, mezerníkem položte.",
    onDragOver: () => undefined,
    onDragEnd: () => "Položka položena, nové pořadí se ukládá.",
    onDragCancel: () => "Přesun zrušen.",
  },
};

/** Řádek s úchytem pro přetažení; obsah řádku zůstává, jak byl. */
const SortableRow = ({
  id,
  label,
  disabled,
  children,
}: {
  id: string;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "relative z-10 flex items-start gap-1 opacity-75" : "flex items-start gap-1"}
    >
      {!disabled && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="text-ui-fg-muted hover:bg-ui-bg-base-hover hover:text-ui-fg-base mt-2 cursor-grab rounded p-0.5 active:cursor-grabbing"
          aria-roledescription="přesouvatelná položka"
          aria-label={`Přesunout ${label}`}
          title="Přetažením změníte pořadí v menu E-shop"
        >
          <DotsSix />
        </button>
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
};

const kindBadge: Record<string, { label: string; color: "green" | "orange" | "blue" | "red" }> = {
  bezne: { label: "Produkt", color: "green" },
  zakazka: { label: "Zakázka", color: "orange" },
  balicek: { label: "Balíček", color: "blue" },
  poskozene: { label: "Poškozené", color: "red" },
};

/** „1 produkt · 3 produkty · 12 produktů" — ne „1 produktů". */
const pocetProduktu = (count: number) =>
  `${count} ${count === 1 ? "produkt" : count >= 2 && count <= 4 ? "produkty" : "produktů"}`;

/* Stav v řádku jen jako tichá značka; přepíná se v nabídce „…". */
const StateMark = ({ kind }: { kind: "hidden" | "archived" }) => {
  const text = kind === "hidden" ? "Skryto z obchodu" : "V archivu";
  return (
    <span role="img" aria-label={text} title={text} className="text-ui-fg-muted shrink-0">
      {kind === "hidden" ? <EyeSlash /> : <ArchiveBox />}
    </span>
  );
};

/* Přejmenování na místě řádku: Enter uloží, Escape vrátí původní stav. */
const RenameRow = ({
  value,
  label,
  onChange,
  onSave,
  onCancel,
}: {
  value: string;
  label: string;
  onChange: (next: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) => (
  <div className="bg-ui-bg-base-pressed flex flex-col gap-2 rounded-md p-2">
    <Input
      autoFocus
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && value.trim()) onSave();
        if (e.key === "Escape") onCancel();
      }}
    />
    <div className="flex gap-2">
      <Button size="base" disabled={!value.trim()} onClick={onSave}>
        Uložit
      </Button>
      <Button size="base" variant="secondary" onClick={onCancel}>
        Zrušit
      </Button>
    </div>
  </div>
);

/* Thumb + ProductLightbox live in components/product-thumb.tsx — shared with
   Produkty+, so „the photo opens the photos" behaves the same everywhere. */

const Inner = () => {
  /* Návrat z detailu vrátí i tam, kde ve výpisu byla — ne nahoru
     (8. 11. 2026, viz lib/scroll-memory). */
  useScrollMemory("rozdeleni");
  const adresa = useLocation();
  const queryClient = useQueryClient();
  /*
   * Kde zrovna je — v ADRESE, ne v paměti komponenty (8. 11. 2026).
   *
   * Majitelka si proklikala kolekci a kategorii, otevřela produkt na úpravu
   * a po návratu stála zase na začátku. U katalogu o dvou stech kusech to
   * není drobnost: vybírat obojí znovu u každého produktu je práce navíc
   * pokaždé. V adrese to tlačítko Zpět obnoví samo — a jde to i poslat
   * odkazem. Viz `lib/url-state`.
   */
  const [collectionId, setCollectionId] = useUrlState("kolekce");
  // Panel „Zobrazit kolekci" — jméno, fotka a popisek vybrané kolekce.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [categoryId, setCategoryId] = useUrlState<string | "none">("kategorie");
  const [newCollection, setNewCollection] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newCategoryCollection, setNewCategoryCollection] = useState("");
  const [kindTab, setKindTab] = useUrlState<
    "vse" | "bezne" | "zakazka" | "balicek" | "poskozene"
  >("druh", "vse");
  /* „Zobrazit všechny kategorie" — the middle column stops being scoped to a
     collection and lists every category, including orphans (Medusa seed data
     like Shirts/Pants) that belong to no collection and were otherwise
     unreachable, so she can rename or delete them. */
  const [allCats, setAllCats] = useUrlFlag("vsekategorie");
  /* Icon tabs of the all-categories view: everything · with a collection ·
     without one (the misclick she'll want to fix) · archived. */
  const [catTab, setCatTab] = useUrlState<"vse" | "skolekci" | "bez" | "archiv">(
    "kategorie-zalozka",
    "vse"
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [renamingCategory, setRenamingCategory] = useState<{ id: string; name: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set());
  /* Rozpracované přeřazení: řádkové selecty nezapisují hned, jen sem. Uloží
     se až Potvrdit (řádek) / Potvrdit vše (lišta) — takže může rozdělat
     změn kolik chce a pak je jedním klikem uložit, nebo zahodit. */
  const [pending, setPending] = useState<
    Record<string, { collection_id: string | null; category_id: string | null }>
  >({});
  /* Řádek, kde se změna udělala — u něj stojí Potvrdit (vše) / Zrušit (vše). */
  const [lastEdited, setLastEdited] = useState<string | null>(null);
  /* Tři styly pravého sloupce: řádky (plná práce s přeřazením), mřížka
     (fotky — vizuální kontrola katalogu) a kompaktní (rychlé skenování,
     nejlepší na telefonu). Sdílená komponenta, volba se pamatuje. */
  const [view, changeView] = useViewMode("kz-rozdeleni-view");
  /* Klik na miniaturu otevře fotky v plné velikosti — kontrola detailů kusu
     bez odchodu ze stránky (sdílený ProductLightbox). */
  const [lightbox, setLightbox] = useState<{ id: string; title: string } | null>(
    null
  );
  const [renamingCollection, setRenamingCollection] = useState<{ id: string; title: string } | null>(null);
  /* Nabídka „…" je u každého řádku, nejen u vybraného — panel, fotka
     i potvrzení si proto pamatují, ke které kolekci/kategorii patří. */
  const [drawerCollectionId, setDrawerCollectionId] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const photoTarget = useRef<string | null>(null);
  // Cíl zůstává i po zavření dialogu, ať titulek při zavírání nezmizí.
  const [deletingCollection, setDeletingCollection] = useState<any>(null);
  const [deleteCollectionOpen, setDeleteCollectionOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<any>(null);
  const [deleteCategoryOpen, setDeleteCategoryOpen] = useState(false);
  const [archivingCategory, setArchivingCategory] = useState<{ id: string; name: string; archive: boolean } | null>(null);
  const [archiveCategoryOpen, setArchiveCategoryOpen] = useState(false);
  const visibility = useVisibilityToggle();

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["rozdeleni-collections"] });
    await queryClient.invalidateQueries({ queryKey: ["workbench-products-all"] });
    await queryClient.invalidateQueries({ queryKey: ["workbench-products"] });
  };

  const { data: collectionsData } = useQuery<any>({
    queryKey: ["rozdeleni-collections"],
    queryFn: () => sdk.client.fetch("/admin/collections?limit=100&fields=id,title,handle,metadata"),
    refetchOnWindowFocus: true,
  });
  const { data: categoriesData } = useQuery<any>({
    queryKey: ["rozdeleni-categories"],
    queryFn: () => sdk.client.fetch("/admin/product-categories?limit=100&fields=id,name,metadata,is_active"),
  });
  const { data: productsData } = useQuery<any>({
    queryKey: ["workbench-products-all"],
    queryFn: () => sdk.client.fetch("/admin/workbench/products?limit=1000"),
    refetchOnWindowFocus: true,
  });

  const collections: any[] = [...(collectionsData?.collections ?? [])].sort(
    byNavOrder(navOrderOf, (c) => String(c?.title ?? ""))
  );
  const allCategories: any[] = categoriesData?.product_categories ?? [];
  const products: any[] = productsData?.products ?? [];

  /* No collection selected = the whole shop, not „bez kolekce". The first
     view used to filter on collection_id === null, so assigning a collection
     made the product vanish from the very list she was working in. */
  const inCollection =
    collectionId === null
      ? products
      : products.filter((product) => product.collection_id === collectionId);
  // Kategorie „patří" kolekci přes metadata.collection_id — Medusa je má
  // globální, tohle je naše vazba, aby seděl model kolekce → podkategorie
  // i pro prázdné kategorie — plus kategorie, které se v kolekci reálně
  // vyskytují na produktech. Stejná unie jako storefront menu.
  const categoriesOf = (collId: string) => [
    ...new Map(
      [
        ...products
          .filter((product) => product.collection_id === collId)
          .flatMap((product) => product.category_refs ?? []),
        ...allCategories.filter(
          (category: any) =>
            (category.metadata as any)?.collection_id === collId
        ),
      ].map((category: any) => [category.id, category])
    ).values(),
  ];
  /* Pořadí kategorie čte celý záznam — řádky z produktů (category_refs)
     nesou jen id a název, metadata ne. */
  const categoryOrderOf = (category: any) =>
    navOrderOf(
      allCategories.find((full: any) => full.id === category?.id) ?? category
    );
  const categoriesHere = collectionId
    ? categoriesOf(collectionId).sort(
        byNavOrder(categoryOrderOf, (c) => String(c?.name ?? ""))
      )
    : [];

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /* Nové pořadí: index 0…n-1 do metadata.nav_order. Na obrazovce hned
     (cache dotazu), zapisuje se jen to, co se změnilo; po uložení se
     seznamy znovu načtou. */
  const saveOrder = async (
    kind: "collections" | "categories",
    ordered: any[]
  ) => {
    const key = kind === "collections" ? ["rozdeleni-collections"] : ["rozdeleni-categories"];
    const listKey = kind === "collections" ? "collections" : "product_categories";
    const fullOf = (item: any) =>
      kind === "collections"
        ? item
        : allCategories.find((full: any) => full.id === item.id) ?? item;
    const indexOf = new Map(ordered.map((item, index) => [item.id, index]));
    queryClient.setQueryData(key, (old: any) =>
      old
        ? {
            ...old,
            [listKey]: (old[listKey] ?? []).map((item: any) =>
              indexOf.has(item.id)
                ? { ...item, metadata: { ...(item.metadata ?? {}), nav_order: indexOf.get(item.id) } }
                : item
            ),
          }
        : old
    );
    try {
      for (const [index, item] of ordered.entries()) {
        const full = fullOf(item);
        if (Number((full?.metadata as any)?.nav_order) === index) continue;
        await sdk.client.fetch(
          kind === "collections"
            ? `/admin/collections/${item.id}`
            : `/admin/product-categories/${item.id}`,
          {
            method: "POST",
            body: { metadata: { ...((full?.metadata as any) ?? {}), nav_order: index } },
          }
        );
      }
      toast.success("Pořadí v menu E-shop uloženo.");
    } catch (error) {
      toast.error(ceskaChyba(error, "Pořadí se nepodařilo uložit."));
    } finally {
      await queryClient.invalidateQueries({ queryKey: key });
    }
  };

  const onDragEndOf =
    (kind: "collections" | "categories", list: any[]) => (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const from = list.findIndex((item) => item.id === active.id);
      const to = list.findIndex((item) => item.id === over.id);
      if (from < 0 || to < 0) return;
      void saveOrder(kind, arrayMove(list, from, to));
    };

  /* The scoped column derives rows from product.category_refs, which carry
     only id+name — flags (is_active, archived) live on the full record. */
  const fullCategory = (id: string) =>
    allCategories.find((category: any) => category.id === id);
  const categoryArchived = (category: any) =>
    Boolean((fullCategory(category.id)?.metadata as any)?.archived);
  const categoryHidden = (category: any) =>
    fullCategory(category.id)?.is_active === false;
  const categoryHasCollection = (category: any) =>
    Boolean((fullCategory(category.id)?.metadata as any)?.collection_id) ||
    products.some(
      (p) =>
        p.collection_id &&
        (p.category_refs ?? []).some((c: any) => c.id === category.id)
    );

  /* The category a row shows for a collection: the product's first category
     that belongs to it. Products can hold more (bulk picker merges); the row
     editor manages „the" place, not the whole set. */
  const savedCategoryFor = (product: any, collId: string | null) => {
    if (!collId) return null;
    const allowed = new Set(categoriesOf(collId).map((c: any) => c.id));
    return (
      (product.category_refs ?? []).find((c: any) => allowed.has(c.id))?.id ??
      null
    );
  };

  const draftFor = (product: any) =>
    pending[product.id] ?? {
      collection_id: (product.collection_id ?? null) as string | null,
      category_id: savedCategoryFor(product, product.collection_id ?? null),
    };

  /*
   * Hromadné přeřazení (19. 11. 2026, Matěj): když je měněný řádek mezi
   * několika označenými, stejná kolekce a kategorie se propíše do všech
   * označených — a u řádku se pak ukáže „Potvrdit vše / Zrušit vše" místo
   * lišty nahoře. Kategorie jde i s kolekcí řádku, ať všechny skončí na
   * stejném místě (jinak by kategorie jiné kolekce u části výběru propadla).
   */
  const setDraft = (
    product: any,
    patch: Partial<{ collection_id: string | null; category_id: string | null }>
  ) => {
    setLastEdited(product.id);
    const bulk = selected.size > 1 && selected.has(product.id);
    if (!bulk) {
      setDraftOne(product, patch);
      return;
    }
    const full =
      "category_id" in patch && !("collection_id" in patch)
        ? { collection_id: draftFor(product).collection_id, ...patch }
        : patch;
    for (const other of products.filter((item) => selected.has(item.id))) {
      setDraftOne(other, full);
    }
  };

  const setDraftOne = (
    product: any,
    patch: Partial<{ collection_id: string | null; category_id: string | null }>
  ) => {
    setPending((prev) => {
      const current = prev[product.id] ?? {
        collection_id: (product.collection_id ?? null) as string | null,
        category_id: savedCategoryFor(product, product.collection_id ?? null),
      };
      const next = { ...current, ...patch };
      if ("collection_id" in patch) {
        // Nová kolekce = nová nabídka kategorií; dosavadní volba přežije,
        // jen pokud do ní patří.
        const allowed = new Set(
          (next.collection_id ? categoriesOf(next.collection_id) : []).map(
            (c: any) => c.id
          )
        );
        next.category_id =
          next.category_id && allowed.has(next.category_id)
            ? next.category_id
            : null;
      }
      // Ruční návrat k uloženému stavu = žádná rozpracovaná změna.
      const savedCollection = (product.collection_id ?? null) as string | null;
      if (
        next.collection_id === savedCollection &&
        next.category_id === savedCategoryFor(product, savedCollection)
      ) {
        const { [product.id]: _dropped, ...rest } = prev;
        return rest;
      }
      return { ...prev, [product.id]: next };
    });
  };
  const uncategorised = inCollection.filter(
    (product) => !(product.category_refs ?? []).length
  );
  const visibleProducts =
    categoryId === null
      ? inCollection
      : categoryId === "none"
        ? uncategorised
        : inCollection.filter((product) =>
            (product.category_refs ?? []).some((c: any) => c.id === categoryId)
          );
  /* What the right column actually renders — and what „Označit vše" means. */
  const listedProducts = visibleProducts.filter(
    (p) => kindTab === "vse" || p.kind === kindTab
  );

  /*
   * Ohlásit pořadí, v jakém výpis právě stojí — detail z něj skládá
   * „Další" a cestu zpět (8. 11. 2026, lib/seznam-kontext). Posílá se
   * i adresa s filtry, aby se šlo vrátit přesně sem.
   *
   * Závislostí je složený řetězec identifikátorů, ne pole: pole vzniká
   * při každém překreslení nové, takže by se ukládalo pořád dokola.
   * Řetězec je tu skutečná totožnost seznamu.
   */
  const poradiIds = listedProducts
    .map((polozka: { id: string }) => polozka.id)
    .join(",");
  const adresaVypisu = adresa.pathname + adresa.search;
  useEffect(() => {
    ulozSeznam(
      "produkty",
      poradiIds ? poradiIds.split(",") : [],
      adresaVypisu
    );
  }, [poradiIds, adresaVypisu]);

  const allListedSelected =
    listedProducts.length > 0 &&
    listedProducts.every((p) => selected.has(p.id));

  /* The picker's offer: everything that is not already in the target,
     narrowed by its search — shared by the rows and its „Označit vše". */
  const pickerCandidates = products.filter((product) => {
    // Nenabízet, co už tady je.
    const inThisCollection = product.collection_id === collectionId;
    const inThisCategory =
      categoryId && categoryId !== "none"
        ? (product.category_refs ?? []).some((c: any) => c.id === categoryId)
        : true;
    if (inThisCollection && inThisCategory) return false;
    return (
      !pickerSearch.trim() ||
      product.title.toLowerCase().includes(pickerSearch.trim().toLowerCase())
    );
  });
  const allPickerSelected =
    pickerCandidates.length > 0 &&
    pickerCandidates.every((p) => pickerSelected.has(p.id));

  const createCollection = useMutation({
    mutationFn: () => {
      if (!newCollection.trim()) throw new Error("Kolekce potřebuje název.");
      return sdk.client.fetch("/admin/collections", {
        method: "POST",
        body: { title: newCollection.trim() },
      });
    },
    onSuccess: async () => { setNewCollection(""); await invalidate(); toast.success("Kolekce založena."); },
    onError: (e) => toast.error(ceskaChyba(e, "Nepodařilo se.")),
  });
  const renameCollection = useMutation({
    mutationFn: (payload: { id: string; title: string }) =>
      sdk.client.fetch(`/admin/collections/${payload.id}`, {
        method: "POST", body: { title: payload.title },
      }),
    onSuccess: async () => { await invalidate(); toast.success("Přejmenováno."); },
    onError: (e) => toast.error(ceskaChyba(e, "Nepodařilo se.")),
  });
  const deleteCollection = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/collections/${id}`, { method: "DELETE" }),
    onSuccess: async (_, id) => {
      if (id === collectionId) setCollectionId(null);
      await invalidate();
      toast.success("Kolekce smazána — produkty zůstaly, jen bez kolekce.");
    },
    onError: (e) => toast.error(ceskaChyba(e, "Nepodařilo se.")),
  });
  const setCollectionImage = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData();
      formData.append("files", file);
      const response = await fetch(`/admin/uploads`, {
        method: "POST", credentials: "include", body: formData,
      });
      if (!response.ok) throw new Error("Fotku se nepodařilo nahrát.");
      const payload = await response.json();
      const url: string | undefined = payload?.files?.[0]?.url;
      if (!url) throw new Error("Úložiště nevrátilo adresu fotky.");
      const current = collections.find((c) => c.id === id);
      // metadata.image — stejný klíč, který už čte storefront navbar.
      return sdk.client.fetch(`/admin/collections/${id}`, {
        method: "POST",
        body: { metadata: { ...(current?.metadata ?? {}), image: url } },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["rozdeleni-collections"] });
      toast.success("Fotka kolekce nastavena — uvidí ji i menu obchodu.");
    },
    onError: (e) => toast.error(ceskaChyba(e, "Nepodařilo se.")),
  });

  const renameCategory = useMutation({
    mutationFn: (payload: { id: string; name: string }) =>
      sdk.client.fetch(`/admin/product-categories/${payload.id}`, {
        method: "POST", body: { name: payload.name },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["rozdeleni-categories"] });
      await invalidate();
      toast.success("Kategorie přejmenována.");
    },
    onError: (e) => toast.error(ceskaChyba(e, "Nepodařilo se.")),
  });
  const deleteCategory = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/product-categories/${id}`, { method: "DELETE" }),
    onSuccess: async (_, id) => {
      if (id === categoryId) setCategoryId(null);
      await queryClient.invalidateQueries({ queryKey: ["rozdeleni-categories"] });
      await invalidate();
      toast.success("Kategorie smazána — produkty zůstaly.");
    },
    onError: (e) => toast.error(ceskaChyba(e, "Nepodařilo se.")),
  });

  /* Archiv kategorie = metadata.archived (celý objekt se posílá sloučený —
     nativní update metadata NAHRAZUJE). Archivace zároveň kategorii skryje
     z obchodu (is_active: false); návrat z archivu ji sám nezveřejní —
     o zobrazení rozhoduje ona. */
  const archiveCategory = useMutation({
    mutationFn: (payload: { id: string; archive: boolean }) => {
      const full = fullCategory(payload.id);
      return sdk.client.fetch(`/admin/product-categories/${payload.id}`, {
        method: "POST",
        body: {
          metadata: { ...(full?.metadata ?? {}), archived: payload.archive },
          ...(payload.archive ? { is_active: false } : {}),
        },
      });
    },
    onSuccess: async (_, payload) => {
      setCategoryId(null);
      await queryClient.invalidateQueries({ queryKey: ["rozdeleni-categories"] });
      await invalidate();
      toast.success(
        payload.archive
          ? "Kategorie archivována — z obchodu i ze seznamů zmizela, produkty zůstaly."
          : "Kategorie vrácena z archivu. V obchodě se ukáže, až zvolíte Zobrazit v obchodě."
      );
    },
    onError: (e) => toast.error(ceskaChyba(e, "Nepodařilo se.")),
  });

  const createCategory = useMutation({
    mutationFn: () => {
      if (!newCategory.trim()) throw new Error("Kategorie potřebuje název.");
      const parent = collectionId ?? newCategoryCollection;
      if (!parent) throw new Error("Vyberte, pod kterou kolekci kategorie patří.");
      return sdk.client.fetch("/admin/product-categories", {
        method: "POST",
        body: {
          name: newCategory.trim(),
          is_active: true,
          metadata: { collection_id: parent },
        },
      });
    },
    onSuccess: async () => {
      setNewCategory("");
      await queryClient.invalidateQueries({ queryKey: ["rozdeleni-categories"] });
      toast.success("Kategorie založena.");
    },
    onError: (e) => toast.error(ceskaChyba(e, "Nepodařilo se.")),
  });

  const bulkArchive = useMutation({
    mutationFn: async () => {
      for (const id of selected) {
        await sdk.client.fetch(`/admin/workbench/products/${id}/flags`, {
          method: "POST",
          body: { archived: true },
        });
      }
    },
    onSuccess: async () => {
      const count = selected.size;
      setSelected(new Set());
      await invalidate();
      toast.success(`Archivováno ${count} produktů — z obchodu zmizely, historie zůstává.`);
    },
    onError: (e) => toast.error(ceskaChyba(e, "Archivace se nepodařila.")),
  });

  const bulkDelete = useMutation({
    mutationFn: async () => {
      for (const id of selected) {
        await sdk.client.fetch(`/admin/products/${id}`, { method: "DELETE" });
      }
    },
    onSuccess: async () => {
      const count = selected.size;
      setSelected(new Set());
      await invalidate();
      toast.success(`Smazáno ${count} produktů.`);
    },
    onError: (e) => toast.error(ceskaChyba(e, "Mazání se nepodařilo.")),
  });

  const bulkAssign = useMutation({
    mutationFn: async () => {
      for (const id of pickerSelected) {
        const product = products.find((item) => item.id === id);
        const currentCategories = (product?.category_refs ?? []).map(
          (category: any) => ({ id: category.id })
        );
        const wantsCategory =
          categoryId && categoryId !== "none"
            ? currentCategories.some((c: any) => c.id === categoryId)
              ? currentCategories
              : [...currentCategories, { id: categoryId }]
            : currentCategories;
        await sdk.client.fetch(`/admin/products/${id}`, {
          method: "POST",
          body: {
            collection_id: collectionId,
            // Kategorie se SLUČUJÍ — produkt může být ve více kategoriích,
            // zařazení sem mu ostatní nesmí vzít.
            categories: wantsCategory,
          },
        });
      }
    },
    onSuccess: async () => {
      const count = pickerSelected.size;
      setPickerSelected(new Set());
      // The picker stays open on purpose: filling several categories in a row
      // is the normal flow, and closing it here forced a re-click on „Přidat
      // produkty" after every batch. Clicking another category just re-aims
      // the picker (the target line above the search says where).
      setPickerSearch("");
      await invalidate();
      toast.success(`Zařazeno ${count} produktů — výběr zůstává otevřený.`);
    },
    onError: (e) => toast.error(ceskaChyba(e, "Zařazení se nepodařilo.")),
  });

  const applyPending = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        const draft = pending[id];
        if (!draft) continue;
        /* Jen „to" místo, které řádek spravuje: kategorie z ostatních kolekcí
           zůstávají (výrobek může být ve víc kolekcích — Zařazení na detailu).
           Dřív se přepsal celý seznam a výrobek tiše vypadl odjinud. Při
           změně kolekce odejdou i kategorie staré kolekce. */
        const product = products.find((item) => item.id === id);
        const oldCollection = (product?.collection_id ?? null) as string | null;
        const managed = product ? savedCategoryFor(product, oldCollection) : null;
        const collectionOfCategory = (categoryId: string) =>
          ((allCategories.find((category: any) => category.id === categoryId)?.metadata as any)
            ?.collection_id ?? null) as string | null;
        const keep = (product?.category_refs ?? [])
          .map((category: any) => category.id as string)
          .filter(
            (categoryId: string) =>
              categoryId !== managed &&
              categoryId !== draft.category_id &&
              (draft.collection_id === oldCollection ||
                !oldCollection ||
                collectionOfCategory(categoryId) !== oldCollection)
          );
        await sdk.client.fetch(`/admin/products/${id}`, {
          method: "POST",
          body: {
            collection_id: draft.collection_id,
            categories: [...keep, ...(draft.category_id ? [draft.category_id] : [])].map(
              (categoryId) => ({ id: categoryId })
            ),
          },
        });
      }
    },
    onSuccess: async (_, ids) => {
      setPending((prev) => {
        const rest = { ...prev };
        for (const id of ids) delete rest[id];
        return rest;
      });
      await invalidate();
      toast.success(
        ids.length === 1 ? "Změna uložena." : `Uloženo změn: ${ids.length}.`
      );
    },
    onError: (e) =>
      toast.error(ceskaChyba(e, "Uložení se nepodařilo.")),
  });

  const selectedCollection = collections.find((c) => c.id === collectionId);

  /* Back to the first-open view: no selection, every product listed. Pending
     row edits deliberately survive — a view reset must not discard her work. */
  const resetView = () => {
    setCollectionId(null);
    setCategoryId(null);
    setAllCats(false);
    setKindTab("vse");
    setPickerOpen(false);
    setPickerSelected(new Set());
    setSelected(new Set());
    setRenamingCollection(null);
  };

  /* Položky nabídky „…" — tytéž zápisy, které dřív visely v řádku jako odkazy. */
  const toggleCollectionVisibility = (collection: any) =>
    visibility.toggle({
      visible: !(collection.metadata as any)?.hidden,
      label: `kolekci ${collection.title}`,
      hideText:
        "Zákazníci ji přestanou vidět v menu Eshop produktů i v obchodě. Produkty v ní zůstanou dostupné jinými cestami.",
      showText: "Kolekce se vrátí do menu a do obchodu.",
      onToggle: (next) =>
        sdk.client.fetch(`/admin/collections/${collection.id}`, {
          method: "POST",
          body: {
            /* Metadata update REPLACES — always send merged. */
            metadata: { ...(collection.metadata ?? {}), hidden: !next },
          },
        }),
      onDone: invalidate,
    });
  const toggleCategoryVisibility = (category: any) =>
    visibility.toggle({
      visible: !categoryHidden(category),
      label: `kategorii ${category.name}`,
      hideText:
        "Zákazníci ji přestanou vidět v menu i ve filtrech obchodu. Produkty v ní zůstanou dostupné jinými cestami.",
      showText: "Kategorie se vrátí do menu a filtrů obchodu.",
      onToggle: (next) =>
        sdk.client.fetch(`/admin/product-categories/${category.id}`, {
          method: "POST",
          body: { is_active: next },
        }),
      onDone: async () => {
        await queryClient.invalidateQueries({ queryKey: ["rozdeleni-categories"] });
        await invalidate();
      },
    });

  /* Co je vpravo nahoře napsané: kde právě stojí a kolik toho vidí. */
  const contextTitle = allCats
    ? "Všechny kategorie"
    : selectedCollection
      ? `${selectedCollection.title}${
          categoryId === "none"
            ? " › Bez kategorie"
            : categoryId
              ? ` › ${fullCategory(categoryId)?.name ?? "kategorie"}`
              : ""
        }`
      : "Celý obchod";
  const pickerTargetLabel =
    categoryId && categoryId !== "none" ? "kategorie" : "kolekce";

  return (
    <Container className="p-0">
      <header className="border-ui-border-base border-b px-6 pb-4 pt-6">
        <Heading>Kolekce a kategorie</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-1 max-w-2xl">
          Kolekce, jejich kategorie a produkty vedle sebe. Klik vlevo otevře
          prostředek, klik uprostřed pravý sloupec.
        </Text>
      </header>

      <div className="grid min-h-[60vh] lg:grid-cols-[260px_240px_minmax(0,1fr)] divide-x divide-ui-border-base">
        {/* ── 1. kolekce ── */}
        <div className="flex flex-col gap-1 p-3">
          <DndContext
            sensors={dndSensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEndOf("collections", collections)}
            accessibility={DND_TEXTS}
          >
          <SortableContext
            items={collections.map((collection) => collection.id)}
            strategy={verticalListSortingStrategy}
          >
          {collections.map((collection) => {
            const active = collection.id === collectionId;
            const hidden = Boolean((collection.metadata as any)?.hidden);
            const hasImage = Boolean((collection.metadata as any)?.image);
            return (
            <SortableRow key={collection.id} id={collection.id} label={`kolekci ${collection.title}`}>
            {/* Řádek = jedna věc: klik vybere kolekci. Vše ostatní je v „…"
                (17. 11. 2026 — dřív se vybraný řádek rozbalil do řady odkazů). */}
            {renamingCollection && renamingCollection.id === collection.id ? (
              <RenameRow
                value={renamingCollection.title}
                label={`Nový název kolekce ${collection.title}`}
                onChange={(title) => setRenamingCollection({ id: collection.id, title })}
                onSave={() => {
                  renameCollection.mutate({ id: collection.id, title: renamingCollection.title.trim() });
                  setRenamingCollection(null);
                }}
                onCancel={() => setRenamingCollection(null)}
              />
            ) : (
              <div className={
                active
                  ? "bg-ui-bg-base-pressed flex items-center rounded-md"
                  : "hover:bg-ui-bg-base-hover flex items-center rounded-md"
              }>
                <button type="button"
                  aria-current={active ? "true" : undefined}
                  onClick={() => { setCollectionId(collection.id); setCategoryId(null); setAllCats(false); setRenamingCollection(null); }}
                  className="min-w-0 flex-1 py-2 pl-3 pr-1 text-left">
                  <span className="flex items-center gap-1.5">
                    <Text size="base" weight={active ? "plus" : "regular"} className="truncate">
                      {collection.title}
                    </Text>
                    {hidden && <StateMark kind="hidden" />}
                  </span>
                  <Text size="small" className="text-ui-fg-muted">
                    {pocetProduktu(products.filter((p) => p.collection_id === collection.id).length)}
                  </Text>
                </button>
                <RowOptionsMenu
                  label={`Možnosti kolekce ${collection.title}`}
                  items={[
                    {
                      // Jméno, fotka a popisek na jednom místě — co o kolekci uvidí zákazník.
                      label: "Zobrazit kolekci",
                      icon: <SidebarRight />,
                      onSelect: () => { setDrawerCollectionId(collection.id); setDrawerOpen(true); },
                    },
                    {
                      label: hasImage ? "Změnit fotku" : "Nastavit fotku",
                      icon: <Photo />,
                      // Okno se soubory jen přímo z kliknutí (Safari).
                      sync: true,
                      onSelect: () => { photoTarget.current = collection.id; photoInput.current?.click(); },
                    },
                    {
                      label: hidden ? "Zobrazit v obchodě" : "Skrýt z obchodu",
                      icon: hidden ? <Eye /> : <EyeSlash />,
                      onSelect: () => toggleCollectionVisibility(collection),
                    },
                    {
                      label: "Přejmenovat",
                      icon: <PencilSquare />,
                      takesFocus: true,
                      onSelect: () => setRenamingCollection({ id: collection.id, title: collection.title }),
                    },
                    "separator",
                    {
                      label: "Smazat",
                      icon: <Trash />,
                      destructive: true,
                      onSelect: () => { setDeletingCollection(collection); setDeleteCollectionOpen(true); },
                    },
                  ]}
                />
              </div>
            )}
            </SortableRow>
            );
          })}
          </SortableContext>
          </DndContext>
          {/* Jedno skryté pole pro fotku kolekce — spouští ho „Změnit fotku"
              v nabídce kteréhokoli řádku, cíl drží `photoTarget`. */}
          <input ref={photoInput} type="file" accept="image/*" className="hidden"
            aria-hidden="true" tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0];
              const id = photoTarget.current;
              if (file && id) setCollectionImage.mutate({ id, file });
              e.currentTarget.value = "";
            }} />
          <div className="mt-2 flex gap-2">
            <Input size="small" placeholder="Nová kolekce…" value={newCollection}
              onChange={(e) => setNewCollection(e.target.value)} />
            <Button size="small" variant="secondary"
              isLoading={createCollection.isPending}
              onClick={() => createCollection.mutate()}>+</Button>
          </div>
          {/* Sticky, so the way out of any selection is always on screen. */}
          <div className="border-ui-border-base bg-ui-bg-base sticky bottom-0 -mx-3 -mb-3 mt-auto border-t p-2">
            <Button size="small" variant="secondary" className="w-full"
              onClick={resetView}>
              Zobrazit vše
            </Button>
          </div>
        </div>

        {/* ── 2. kategorie in this collection ── */}
        <div className="flex flex-col gap-1 p-3">
          {!selectedCollection && !allCats && (
            <div className="flex flex-col gap-2 px-1 py-1">
              <Text size="xsmall" className="text-ui-fg-muted">
                Vyberte kolekci vlevo — nebo založte kategorii rovnou:
              </Text>
              <Input size="small" placeholder="Nová kategorie…" value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)} />
              <select
                className="bg-ui-bg-field border-ui-border-base txt-small rounded-md border px-2 py-1.5"
                value={newCategoryCollection}
                onChange={(e) => setNewCategoryCollection(e.target.value)}>
                <option value="">Pod kterou kolekci patří…</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              <Button size="small" variant="secondary"
                isLoading={createCategory.isPending}
                onClick={() => createCategory.mutate()}>Založit kategorii</Button>
            </div>
          )}
          {(selectedCollection || allCats) && (
            <>
              {allCats && (
                <>
                  <Text size="xsmall" className="text-ui-fg-muted px-1">
                    Všechny kategorie v obchodě — i ty, které nepatří pod
                    žádnou kolekci.
                  </Text>
                  <div className="flex items-center gap-1 px-1 pb-1">
                    {([
                      ["vse", ListBullet, "Všechny"],
                      ["skolekci", Folder, "S kolekcí"],
                      ["bez", ExclamationCircle, "Bez kolekce"],
                      ["archiv", ArchiveBox, "Archivované"],
                    ] as const).map(([key, Icon, titleText]) => (
                      <button key={key} type="button" title={titleText}
                        onClick={() => { setCatTab(key); setCategoryId(null); }}
                        className={
                          catTab === key
                            ? "bg-ui-bg-base-pressed text-ui-fg-base rounded-md p-1.5"
                            : "text-ui-fg-muted hover:bg-ui-bg-base-hover hover:text-ui-fg-base rounded-md p-1.5"
                        }>
                        <Icon />
                      </button>
                    ))}
                  </div>
                </>
              )}
              <button type="button" onClick={() => setCategoryId(null)}
                className={categoryId === null ? "bg-ui-bg-base-pressed rounded-md px-3 py-2 text-left" : "hover:bg-ui-bg-base-hover rounded-md px-3 py-2 text-left"}>
                <Text size="base">Vše ({inCollection.length})</Text>
              </button>
              <DndContext
                sensors={dndSensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEndOf(
                  "categories",
                  categoriesHere.filter((category: any) => !categoryArchived(category))
                )}
                accessibility={DND_TEXTS}
              >
              <SortableContext
                items={categoriesHere
                  .filter((category: any) => !categoryArchived(category))
                  .map((category: any) => category.id)}
                strategy={verticalListSortingStrategy}
              >
              {(allCats
                ? allCategories.filter((category: any) =>
                    catTab === "archiv"
                      ? categoryArchived(category)
                      : !categoryArchived(category) &&
                        (catTab === "vse" ||
                          (catTab === "skolekci"
                            ? categoryHasCollection(category)
                            : !categoryHasCollection(category)))
                  )
                : categoriesHere.filter(
                    (category: any) => !categoryArchived(category)
                  )
              ).map((category: any) => {
                const active = categoryId === category.id;
                const hidden = categoryHidden(category);
                const archived = categoryArchived(category);
                return (
                /* Přetahuje se jen v kolekci (tam je pořadí menu); v pohledu
                   „všechny kategorie" je seznam smíšený, úchyt tam není. */
                <SortableRow key={category.id} id={category.id} label={`kategorii ${category.name}`} disabled={allCats}>
                  {/* Porovnání přes `?.` nezúží typ, takže uvnitř větve byl
                      `renamingCategory` pořád `| null` — proto ta dvě hlášení
                      z typecheck. Explicitní test zúží. */}
                  {renamingCategory && renamingCategory.id === category.id ? (
                    <RenameRow
                      value={renamingCategory.name}
                      label={`Nový název kategorie ${category.name}`}
                      onChange={(name) => setRenamingCategory({ id: category.id, name })}
                      onSave={() => {
                        renameCategory.mutate({ id: category.id, name: renamingCategory.name.trim() });
                        setRenamingCategory(null);
                      }}
                      onCancel={() => setRenamingCategory(null)}
                    />
                  ) : (
                    <div className={
                      active
                        ? "bg-ui-bg-base-pressed flex items-center rounded-md"
                        : "hover:bg-ui-bg-base-hover flex items-center rounded-md"
                    }>
                      <button type="button"
                        aria-current={active ? "true" : undefined}
                        className="min-w-0 flex-1 py-2.5 pl-3 pr-1 text-left"
                        onClick={() => setCategoryId(category.id)}>
                        <span className="flex items-center gap-1.5">
                          <Text size="base" weight={active ? "plus" : "regular"} className="truncate">
                            {category.name}
                          </Text>
                          {hidden && <StateMark kind="hidden" />}
                          {archived && <StateMark kind="archived" />}
                        </span>
                      </button>
                      <RowOptionsMenu
                        label={`Možnosti kategorie ${category.name}`}
                        items={[
                          {
                            label: hidden ? "Zobrazit v obchodě" : "Skrýt z obchodu",
                            icon: hidden ? <Eye /> : <EyeSlash />,
                            onSelect: () => toggleCategoryVisibility(category),
                          },
                          {
                            label: "Přejmenovat",
                            icon: <PencilSquare />,
                            takesFocus: true,
                            onSelect: () => setRenamingCategory({ id: category.id, name: category.name }),
                          },
                          {
                            label: archived ? "Vrátit z archivu" : "Archivovat",
                            icon: archived ? <ArrowUturnLeft /> : <ArchiveBox />,
                            onSelect: () => { setArchivingCategory({ id: category.id, name: category.name, archive: !archived }); setArchiveCategoryOpen(true); },
                          },
                          "separator",
                          {
                            label: "Smazat",
                            icon: <Trash />,
                            destructive: true,
                            onSelect: () => { setDeletingCategory(category); setDeleteCategoryOpen(true); },
                          },
                        ]}
                      />
                    </div>
                  )}
                </SortableRow>
                );
              })}
              </SortableContext>
              </DndContext>
              {/* Creating a category needs a collection to belong to — in the
                  all-categories view there is none, so no inline form there. */}
              {selectedCollection && (
                <div className="mt-2 flex gap-2">
                  <Input size="small" placeholder="Nová kategorie…" value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)} />
                  <Button size="small" variant="secondary"
                    isLoading={createCategory.isPending}
                    onClick={() => createCategory.mutate()}>+</Button>
                </div>
              )}
              {uncategorised.length > 0 &&
                (allCats ? allCategories : categoriesHere).length > 0 && (
                <button type="button" onClick={() => setCategoryId("none")}
                  className={categoryId === "none" ? "bg-ui-bg-base-pressed rounded-md px-3 py-2 text-left" : "hover:bg-ui-bg-base-hover rounded-md px-3 py-2 text-left"}>
                  <Text size="base">Bez kategorie ({uncategorised.length})</Text>
                </button>
              )}
            </>
          )}
          <div className="border-ui-border-base bg-ui-bg-base sticky bottom-0 -mx-3 -mb-3 mt-auto border-t p-2">
            <Button size="small" variant="secondary" className="w-full"
              onClick={() => {
                // Orphan categories live nowhere else — this is their door.
                setAllCats(true);
                setCollectionId(null);
                setCategoryId(null);
                setRenamingCollection(null);
              }}>
              Zobrazit všechny kategorie
            </Button>
          </div>
        </div>

        {/* ── 3. produkty ── */}
        <div className="flex flex-col divide-y divide-ui-border-base">
          <div className="flex flex-col gap-3 px-4 py-3">
            {/* Hlavička sloupce (17. 11. 2026): vlevo kde stojí, vpravo jedna
                hlavní akce. Dřív se tu filtry, přepínač a tři tlačítka
                zalamovaly do druhé řádky napřeskáčku. */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1 basis-40">
                <Text size="base" weight="plus" className="truncate">
                  {contextTitle}
                </Text>
                <Text size="small" className="text-ui-fg-muted">
                  {pocetProduktu(listedProducts.length)}
                </Text>
              </div>
              {/* Zařadit existující produkty sem — jen když je kam (kolekce)
                  a výběr ještě není otevřený; zavírá se v něm samotném. */}
              {selectedCollection && !pickerOpen && (
                <Button size="large" variant="secondary"
                  onClick={() => setPickerOpen(true)}>
                  Přidat produkty do {pickerTargetLabel}
                </Button>
              )}
              <Button size="large" variant="primary" asChild>
                <Link to="/novy-produkt">Přidat produkt</Link>
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div role="group" aria-label="Druh produktu"
                className="border-ui-border-base bg-ui-bg-subtle flex max-w-full flex-wrap items-center gap-0.5 rounded-lg border p-0.5">
                {([
                  ["vse", "Vše"],
                  ["bezne", "Produkty"],
                  ["zakazka", "Zakázky"],
                  ["balicek", "Balíčky"],
                  ["poskozene", "Poškozené"],
                ] as const).map(([key, label]) => (
                  <button key={key} type="button" onClick={() => setKindTab(key)}
                    aria-pressed={kindTab === key}
                    className={
                      kindTab === key
                        ? "bg-ui-bg-base text-ui-fg-base shadow-elevation-card-rest txt-compact-small-plus h-9 rounded-md px-3"
                        : "text-ui-fg-subtle hover:bg-ui-bg-base-hover hover:text-ui-fg-base txt-compact-small h-9 rounded-md px-3"
                    }>
                    {label}
                  </button>
                ))}
              </div>
              {/* `ml-auto`, ne rozpěrka s `flex-1`: v zalamovacím řádku by
                  rozpěrka spolkla celou další řádku a přepínač odsunula ještě
                  o jednu níž — v úzkém třetím sloupci na Windows přesně to se
                  dělo a vypadalo to, že tam přepínač není. */}
              <ViewSwitcher value={view} onChange={changeView} className="ml-auto" />
            </div>
            {selected.size > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Vybráno: {selected.size}
                </Text>
                {/* Hromadné změny (19. 11. 2026): pravý panel společný
                    s Produkty+ — zařazení do kolekcí a kategorií i doprava.
                    Otevře se až na klik, ať nepřekryje seznam. */}
                <Button size="small" onClick={() => setBulkOpen(true)}>
                  Hromadné změny
                </Button>
                <Button size="small" variant="secondary"
                  isLoading={bulkArchive.isPending}
                  onClick={() => bulkArchive.mutate()}>
                  Archivovat vybrané
                </Button>
                {/* Ptá se jmény, ne počtem: „Smazat 3 produkty?" se nedá
                    zkontrolovat — když je výběr špatně, číslo sedí a dialog
                    projde (spec §12). */}
                <ConfirmDialog
                  trigger={
                    <Button size="small" variant="danger">Smazat vybrané</Button>
                  }
                  title={
                    selected.size === 1
                      ? "Smazat tenhle kus?"
                      : `Smazat tyhle ${selected.size < 5 ? `${selected.size} kusy` : `${selected.size} kusů`}?`
                  }
                  description="Pokud je chcete jen stáhnout z obchodu a nechat si historii, použijte Archivovat."
                  items={listedProducts
                    .filter((product) => selected.has(product.id))
                    .map((product) => product.title)}
                  consequence="Smazané kusy se nevrátí ani přes Ctrl+Z."
                  confirmLabel={
                    selected.size === 1
                      ? "Smazat kus"
                      : `Smazat ${selected.size} kusů`
                  }
                  isPending={bulkDelete.isPending}
                  onConfirm={() => bulkDelete.mutate()}
                />
                <Button size="small" variant="transparent"
                  onClick={() => setSelected(new Set())}>Zrušit výběr</Button>
              </div>
            )}
          </div>
          {pickerOpen && selectedCollection && (
            <div className="border-ui-border-base flex flex-col gap-2 border-b p-4">
              {/* Where the batch will land — updates live as she clicks other
                  categories, so the sticky picker never aims silently. */}
              <div className="flex items-start gap-3">
                <Text size="small" className="text-ui-fg-subtle min-w-0 flex-1">
                  Zařazuje se do:{" "}
                  <span className="text-ui-fg-base font-medium">
                    {selectedCollection.title}
                    {categoryId && categoryId !== "none"
                      ? ` → ${
                          allCategories.find(
                            (category: any) => category.id === categoryId
                          )?.name ?? "kategorie"
                        }`
                      : ""}
                  </span>{" "}
                  — cíl změníte kliknutím na jinou kategorii, výběr zůstane
                  otevřený.
                </Text>
                {/* Zavírá se tam, kde je otevřený — ne tlačítkem v hlavičce. */}
                <Button size="base" variant="secondary" className="shrink-0"
                  onClick={() => setPickerOpen(false)}>
                  Zavřít výběr
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input size="small" type="search" className="min-w-56 flex-1"
                  placeholder="Filtrovat produkty…"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)} />
                <Button size="small"
                  isLoading={bulkAssign.isPending}
                  disabled={pickerSelected.size === 0}
                  onClick={() => bulkAssign.mutate()}>
                  Zařadit vybrané ({pickerSelected.size})
                </Button>
              </div>
              {pickerCandidates.length > 0 && (
                <label className="flex w-fit cursor-pointer items-center gap-2 px-2">
                  <input type="checkbox" className="size-5 shrink-0 cursor-pointer"
                    checked={allPickerSelected}
                    onChange={(e) => {
                      const next = new Set(pickerSelected);
                      for (const p of pickerCandidates) {
                        if (e.target.checked) next.add(p.id);
                        else next.delete(p.id);
                      }
                      setPickerSelected(next);
                    }} />
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    Označit vše ({pickerCandidates.length})
                  </Text>
                </label>
              )}
              <div className="max-h-80 overflow-y-auto">
                {pickerCandidates
                  .map((product) => (
                    <label key={product.id}
                      className="hover:bg-ui-bg-base-hover flex cursor-pointer items-center gap-2 rounded px-2 py-1.5">
                      <input type="checkbox" className="size-5 shrink-0 cursor-pointer"
                        checked={pickerSelected.has(product.id)}
                        onChange={(e) => {
                          const next = new Set(pickerSelected);
                          if (e.target.checked) next.add(product.id);
                          else next.delete(product.id);
                          setPickerSelected(next);
                        }} />
                      <Thumb src={product.thumbnail} title={product.title}
                        onZoom={() => setLightbox({ id: product.id, title: product.title })} />
                      <Text size="small" className="min-w-0 flex-1 truncate">
                        {product.title}
                        <span className="text-ui-fg-muted">
                          {" "}· {product.collection ?? "bez kolekce"}
                          {(product.category_refs ?? []).length
                            ? ` · ${(product.category_refs ?? [])
                                .map((c: any) => c.name)
                                .join(", ")}`
                            : ""}
                        </span>
                      </Text>
                    </label>
                  ))}
              </div>
            </div>
          )}
          {(selectedCollection || allCats) && listedProducts.length === 0 && (
            <div className="flex flex-col items-start gap-2 p-4">
              <Text size="small" className="text-ui-fg-muted">
                Zatím tu nic není.
              </Text>
              {/* The picker writes collection_id, so it needs a collection —
                  in the all-categories view there is none to offer. */}
              {selectedCollection && !pickerOpen && (
                <Button size="base" variant="secondary"
                  onClick={() => setPickerOpen(true)}>
                  Přidat produkty do {pickerTargetLabel}
                </Button>
              )}
            </div>
          )}
          {listedProducts.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-2">
              <label className="flex cursor-pointer items-center gap-3">
                <input type="checkbox" className="size-5 shrink-0 cursor-pointer"
                  checked={allListedSelected}
                  onChange={(e) => {
                    const next = new Set(selected);
                    for (const p of listedProducts) {
                      if (e.target.checked) next.add(p.id);
                      else next.delete(p.id);
                    }
                    setSelected(next);
                  }} />
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Označit vše ({listedProducts.length})
                </Text>
              </label>
            </div>
          )}
          {/* Mřížka — fotky vedle sebe; 2 sloupce na telefonu. Přeřazovací
              selecty tu nejsou schválně: mřížka je na koukání a hromadný
              výběr, práce s kolonkami patří řádkům. */}
          {view === "mrizka" && listedProducts.length > 0 && (
            <div className={gridClassName}>
              {listedProducts.map((product) => (
                <figure
                  key={product.id}
                  className="border-ui-border-base overflow-hidden rounded-lg border"
                >
                  <div className="relative">
                    <button
                      type="button"
                      title="Zvětšit fotku"
                      className="bg-ui-bg-subtle block aspect-square w-full"
                      onClick={() =>
                        setLightbox({ id: product.id, title: product.title })
                      }
                    >
                      {product.thumbnail ? (
                        <img
                          src={product.thumbnail}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="text-ui-fg-muted flex h-full w-full items-center justify-center">
                          <Text size="xsmall">—</Text>
                        </div>
                      )}
                    </button>
                    <input
                      type="checkbox"
                      className="absolute left-2 top-2 size-5 shrink-0 cursor-pointer"
                      checked={selected.has(product.id)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(product.id);
                        else next.delete(product.id);
                        setSelected(next);
                      }}
                    />
                  </div>
                  <figcaption className="flex flex-col gap-1 p-2">
                    <Link
                      to={`/produkt/${product.id}`}
                      className="block hover:underline"
                    >
                      <Text size="small" weight="plus" className="truncate">
                        {product.title}
                      </Text>
                    </Link>
                    <div className="flex items-center justify-between gap-1">
                      <Badge
                        size="2xsmall"
                        color={kindBadge[product.kind]?.color ?? "grey"}
                      >
                        {kindBadge[product.kind]?.label ?? product.kind}
                      </Badge>
                      <VisibilityEye
                        visible={product.status === "published"}
                        label={`produkt ${product.title}`}
                        hideText="Zákazníci ho v obchodě neuvidí a nekoupí, dokud ho zase nezveřejníte."
                        showText="Produkt se vrátí do obchodu a půjde koupit."
                        onToggle={(next) =>
                          sdk.client.fetch(`/admin/products/${product.id}`, {
                            method: "POST",
                            body: { status: next ? "published" : "draft" },
                          })
                        }
                        onDone={invalidate}
                      />
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
          {view !== "mrizka" && listedProducts.map((product) => {
              const draft = draftFor(product);
              const dirty = Boolean(pending[product.id]);
              const applyingThis =
                applyPending.isPending &&
                (applyPending.variables ?? []).includes(product.id);
              /* Kompaktní řádek — miniatura, název, druh. Hustý seznam pro
                 telefon a rychlou kontrolu; editace vede na detail produktu. */
              if (view === "kompakt") {
                return (
                  <div
                    key={product.id}
                    className="flex items-center gap-2 px-4 py-1.5"
                  >
                    <input
                      type="checkbox" className="size-5 shrink-0 cursor-pointer"
                      checked={selected.has(product.id)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(product.id);
                        else next.delete(product.id);
                        setSelected(next);
                      }}
                    />
                    <Thumb
                      src={product.thumbnail}
                      title={product.title}
                      sizeClassName="size-6"
                      onZoom={() =>
                        setLightbox({ id: product.id, title: product.title })
                      }
                    />
                    <Link
                      to={`/produkt/${product.id}`}
                      className="min-w-0 flex-1 hover:underline"
                    >
                      <Text size="small" className="truncate">
                        {product.title}
                      </Text>
                    </Link>
                    <Badge
                      size="2xsmall"
                      color={kindBadge[product.kind]?.color ?? "grey"}
                    >
                      {kindBadge[product.kind]?.label ?? product.kind}
                    </Badge>
                  </div>
                );
              }
              return (
            <div key={product.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <input
                type="checkbox" className="size-5 shrink-0 cursor-pointer"
                checked={selected.has(product.id)}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(product.id);
                  else next.delete(product.id);
                  setSelected(next);
                }}
              />
              <Thumb src={product.thumbnail} title={product.title}
                onZoom={() => setLightbox({ id: product.id, title: product.title })} />
              <div className="min-w-0 flex-1">
                {/* Klik na název = detail produktu, stejně jako všude jinde. */}
                <Link
                  to={`/produkt/${product.id}`}
                  title="Otevřít detail produktu"
                  className="block w-fit max-w-full hover:underline"
                >
                  <Text size="small" weight="plus" className="truncate">{product.title}</Text>
                </Link>
                <Badge size="2xsmall" color={kindBadge[product.kind]?.color ?? "grey"}>
                  {kindBadge[product.kind]?.label ?? product.kind}
                </Badge>
              </div>
              <select
                className="bg-ui-bg-field border-ui-border-base txt-small rounded-md border px-2 py-1"
                value={draft.collection_id ?? ""}
                onChange={(e) =>
                  setDraft(product, { collection_id: e.target.value || null })
                }>
                <option value="">Bez kolekce</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              {/* Kategorie až po kolekci — a jen ty, které do ní patří. */}
              {draft.collection_id && (
                <select
                  className="bg-ui-bg-field border-ui-border-base txt-small rounded-md border px-2 py-1"
                  value={draft.category_id ?? ""}
                  onChange={(e) =>
                    setDraft(product, { category_id: e.target.value || null })
                  }>
                  <option value="">Bez kategorie</option>
                  {categoriesOf(draft.collection_id).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              {/* Potvrzení u řádku (19. 11. 2026): jeden řádek → Potvrdit /
                  Zrušit; změna ve výběru víc kusů → u řádku, kde se změnila,
                  Potvrdit vše / Zrušit vše, ostatní změněné jen „změněno". */}
              {dirty &&
                (() => {
                  const inBulk = selected.size > 1 && selected.has(product.id);
                  if (!inBulk) {
                    return (
                      <>
                        <Button size="small" isLoading={applyingThis}
                          onClick={() => applyPending.mutate([product.id])}>
                          Potvrdit
                        </Button>
                        <Button size="small" variant="transparent"
                          disabled={applyingThis}
                          onClick={() =>
                            setPending((prev) => {
                              const { [product.id]: _dropped, ...rest } = prev;
                              return rest;
                            })
                          }>
                          Zrušit
                        </Button>
                      </>
                    );
                  }
                  const bulkIds = Object.keys(pending).filter((id) => selected.has(id));
                  const owner =
                    lastEdited && bulkIds.includes(lastEdited) ? lastEdited : bulkIds[0];
                  if (product.id !== owner) {
                    return (
                      <Badge size="2xsmall" color="orange">
                        změněno
                      </Badge>
                    );
                  }
                  return (
                    <>
                      <Button size="small"
                        isLoading={applyPending.isPending}
                        onClick={() => applyPending.mutate(bulkIds)}>
                        Potvrdit vše ({bulkIds.length})
                      </Button>
                      <Button size="small" variant="transparent"
                        disabled={applyPending.isPending}
                        onClick={() =>
                          setPending((prev) => {
                            const rest = { ...prev };
                            for (const id of bulkIds) delete rest[id];
                            return rest;
                          })
                        }>
                        Zrušit vše
                      </Button>
                    </>
                  );
                })()}
              <VisibilityEye
                visible={product.status === "published"}
                label={`produkt ${product.title}`}
                hideText="Zákazníci ho v obchodě neuvidí a nekoupí, dokud ho zase nezveřejníte."
                showText="Produkt se vrátí do obchodu a půjde koupit."
                onToggle={(next) =>
                  sdk.client.fetch(`/admin/products/${product.id}`, {
                    method: "POST",
                    body: { status: next ? "published" : "draft" },
                  })
                }
                onDone={invalidate}
              />
              <Link to={`/produkt/${product.id}`} className="text-ui-fg-interactive txt-small hover:underline">
                Upravit
              </Link>
            </div>
              );
            })}
          <ProductBulkDrawer
            products={products
              .filter((product) => selected.has(product.id))
              .map((product) => ({
                id: product.id,
                title: product.title,
                status: product.status,
                cod_allowed: Boolean(product.cod_allowed),
                fragile: Boolean(product.fragile),
                packaging_price: product.packaging_price ?? null,
                clearance: Boolean(product.clearance),
                no_promo: Boolean(product.no_promo),
                shipping_class: product.shipping_class ?? "male",
                collection_id: product.collection_id ?? null,
                category_refs: product.category_refs ?? [],
              }))}
            open={bulkOpen}
            onOpenChange={setBulkOpen}
            onSaved={() => setSelected(new Set())}
          />
          <div className="bg-ui-bg-base sticky bottom-0 mt-auto p-2">
            <Button size="small" variant="secondary" className="w-full"
              onClick={resetView}>
              Zobrazit všechny produkty
            </Button>
          </div>
        </div>
      </div>

      {/* Lightbox — full-size photos of the clicked piece. */}
      <ProductLightbox product={lightbox} onClose={() => setLightbox(null)} />

      {/* Panel vpravo: jméno, fotka a popisek vybrané kolekce — všechno, co o ní
          uvidí zákazník, na jednom místě. */}
      <CollectionDrawer
        collection={collections.find((c) => c.id === drawerCollectionId) ?? null}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSaved={invalidate}
      />

      {/* Potvrzení z nabídek „…" — stejná znění jako dřív u odkazů v řádku. */}
      {visibility.dialog}
      <ConfirmDialog
        open={deleteCollectionOpen}
        onOpenChange={setDeleteCollectionOpen}
        title={`Smazat kolekci ${deletingCollection?.title ?? ""}?`}
        description="Produkty zůstanou v obchodě, jen přijdou o kolekci."
        consequence="Smazanou kolekci nejde vrátit."
        confirmLabel="Smazat kolekci"
        isPending={deleteCollection.isPending}
        onConfirm={() => {
          if (deletingCollection) deleteCollection.mutate(deletingCollection.id);
        }}
      />
      <ConfirmDialog
        open={archiveCategoryOpen}
        onOpenChange={setArchiveCategoryOpen}
        destructive={archivingCategory?.archive !== false}
        title={
          archivingCategory?.archive === false
            ? `Vrátit kategorii ${archivingCategory.name} z archivu?`
            : `Archivovat kategorii ${archivingCategory?.name ?? ""}?`
        }
        description={
          archivingCategory?.archive === false
            ? "Vrátí se do seznamů. V obchodě se ukáže, až zvolíte Zobrazit v obchodě."
            : "Zmizí z obchodu i ze seznamů, produkty o ni nepřijdou. Najdete ji v záložce archivu (ikona krabice)."
        }
        confirmLabel={
          archivingCategory?.archive === false
            ? "Vrátit z archivu"
            : "Archivovat"
        }
        isPending={archiveCategory.isPending}
        onConfirm={() => {
          if (archivingCategory)
            archiveCategory.mutate({
              id: archivingCategory.id,
              archive: archivingCategory.archive,
            });
        }}
      />
      <ConfirmDialog
        open={deleteCategoryOpen}
        onOpenChange={setDeleteCategoryOpen}
        title={`Smazat kategorii ${deletingCategory?.name ?? ""}?`}
        description="Produkty zůstanou, jen přijdou o tuhle kategorii."
        consequence="Smazanou kategorii nejde vrátit — když ji chcete jen schovat, použijte Archivovat."
        confirmLabel="Smazat kategorii"
        isPending={deleteCategory.isPending}
        onConfirm={() => {
          if (deletingCategory) deleteCategory.mutate(deletingCategory.id);
        }}
      />
    </Container>
  );
};

const queryClient = adminQueryClient;
const Page = () => (
  <QueryClientProvider client={queryClient}><Inner /></QueryClientProvider>
);
export const config = defineRouteConfig({
  // „Rozdělení" nikomu neřeklo, co tu je; adresa /rozdeleni zůstává.
  label: "Kolekce a kategorie",
  icon: ListTree,
  // Vedlejší, k produktům: za Produkty (20), před Sklad (30).
  rank: 25,
});
export default Page;
