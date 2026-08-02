import {
  ArrowLeftMini,
  ArrowRightMini,
  CloudArrowUp,
  Photo,
  Trash,
} from "@medusajs/icons";
import {
  Badge,
  Button,
  Heading,
  IconButton,
  Input,
  Label,
  Select,
  Switch,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui";
import { ChangeEvent, useRef, useState } from "react";
import { sdk } from "../lib/sdk";

export type BundleEditorImage = {
  id?: string;
  url: string;
  name?: string;
};

export type BundleProductDetails = {
  title: string;
  subtitle: string;
  description: string;
  handle: string;
  material: string;
  discountable: boolean;
  status: "draft" | "published";
  images: BundleEditorImage[];
  thumbnail: string | null;
  pricing_mode: "component_sum" | "component_sum_discount" | "fixed_price";
  discount_percentage: number | null;
};

export const createEmptyBundleProductDetails = (): BundleProductDetails => ({
  title: "",
  subtitle: "",
  description: "",
  handle: "",
  material: "",
  discountable: true,
  status: "published",
  images: [],
  thumbnail: null,
  pricing_mode: "component_sum",
  discount_percentage: null,
});

export const bundleDetailsToProductPayload = (
  details: BundleProductDetails
) => ({
  title: details.title.trim(),
  subtitle: details.subtitle.trim() || null,
  description: details.description.trim() || null,
  handle: details.handle.trim(),
  material: details.material.trim() || null,
  discountable: details.discountable,
  status: details.status,
  images: details.images.map(({ id, url }) => ({
    ...(id ? { id } : {}),
    url,
  })),
  thumbnail: details.thumbnail || details.images[0]?.url || null,
});

const toHandle = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("cs")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

type BundleProductDetailsFieldsProps = {
  details: BundleProductDetails;
  onChange: (patch: Partial<BundleProductDetails>) => void;
  onUploadingChange?: (uploading: boolean) => void;
};

const BundleMedia = ({
  details,
  onChange,
  onUploadingChange,
}: BundleProductDetailsFieldsProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const setUploading = (uploading: boolean) => {
    setIsUploading(uploading);
    onUploadingChange?.(uploading);
  };

  const uploadImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []).filter((file) =>
      file.type.startsWith("image/")
    );

    event.target.value = "";

    if (!selectedFiles.length) {
      toast.error("Vyberte obrázek ve podporovaném formátu");
      return;
    }

    setUploading(true);

    try {
      const result = await sdk.admin.upload.create({ files: selectedFiles });
      const uploadedImages: BundleEditorImage[] = result.files.map(
        (file, index) => ({
          url: file.url,
          name: selectedFiles[index]?.name,
        })
      );
      const images = [...details.images, ...uploadedImages];

      onChange({
        images,
        thumbnail: details.thumbnail || images[0]?.url || null,
      });
      toast.success(
        uploadedImages.length === 1
          ? "Obrázek byl nahrán"
          : `Nahráno ${uploadedImages.length} obrázků`
      );
    } catch {
      toast.error("Obrázky se nepodařilo nahrát");
    } finally {
      setUploading(false);
    }
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= details.images.length) return;

    const images = [...details.images];
    [images[index], images[targetIndex]] = [
      images[targetIndex],
      images[index],
    ];
    onChange({ images });
  };

  const removeImage = (index: number) => {
    const removed = details.images[index];
    const images = details.images.filter((_, imageIndex) => imageIndex !== index);
    const removedThumbnail = removed?.url === details.thumbnail;

    onChange({
      images,
      thumbnail: removedThumbnail
        ? images[0]?.url || null
        : details.thumbnail,
    });
  };

  return (
    <section className="flex flex-col gap-y-4">
      <div className="flex items-end justify-between gap-x-4">
        <div>
          <Heading level="h2">Média</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Obrázky reprezentují celý balíček. První nebo označený obrázek se
            použije jako náhled.
          </Text>
        </div>
        <Badge color={details.images.length ? "green" : "grey"} size="2xsmall">
          {details.images.length} {details.images.length === 1 ? "obrázek" : "obrázků"}
        </Badge>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={uploadImages}
        aria-label="Nahrát obrázky balíčku"
      />

      {!details.images.length ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="border-ui-border-strong bg-ui-bg-subtle hover:bg-ui-bg-subtle-hover focus-visible:shadow-borders-focus flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center outline-none transition-colors disabled:cursor-wait"
        >
          <span className="bg-ui-bg-base shadow-borders-base mb-3 flex size-10 items-center justify-center rounded-lg">
            <CloudArrowUp className="text-ui-fg-subtle" />
          </span>
          <Text size="small" weight="plus">
            {isUploading ? "Nahrávám obrázky…" : "Nahrát obrázky balíčku"}
          </Text>
          <Text size="xsmall" className="text-ui-fg-muted mt-1">
            Vyberte jeden nebo více souborů z počítače.
          </Text>
        </button>
      ) : (
        <div className="flex flex-col gap-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {details.images.map((image, index) => {
              const isThumbnail = image.url === details.thumbnail;

              return (
                <article
                  key={`${image.id || image.url}-${index}`}
                  className="bg-ui-bg-component shadow-elevation-card-rest overflow-hidden rounded-lg"
                >
                  <div className="bg-ui-bg-subtle relative aspect-square overflow-hidden">
                    <img
                      src={image.url}
                      alt={`${details.title || "Balíček"} – obrázek ${index + 1}`}
                      className="size-full object-cover"
                    />
                    {isThumbnail && (
                      <Badge
                        color="green"
                        size="2xsmall"
                        className="absolute left-2 top-2"
                      >
                        Náhled
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 p-2">
                    <Button
                      type="button"
                      variant={isThumbnail ? "primary" : "secondary"}
                      size="small"
                      onClick={() => onChange({ thumbnail: image.url })}
                      disabled={isThumbnail}
                      className="min-w-0 flex-1"
                    >
                      <Photo />
                      {isThumbnail ? "Hlavní" : "Nastavit náhled"}
                    </Button>
                    <div className="flex shrink-0 items-center">
                      <IconButton
                        type="button"
                        variant="transparent"
                        size="small"
                        aria-label={`Posunout obrázek ${index + 1} doleva`}
                        disabled={index === 0}
                        onClick={() => moveImage(index, -1)}
                      >
                        <ArrowLeftMini />
                      </IconButton>
                      <IconButton
                        type="button"
                        variant="transparent"
                        size="small"
                        aria-label={`Posunout obrázek ${index + 1} doprava`}
                        disabled={index === details.images.length - 1}
                        onClick={() => moveImage(index, 1)}
                      >
                        <ArrowRightMini />
                      </IconButton>
                      <IconButton
                        type="button"
                        variant="transparent"
                        size="small"
                        aria-label={`Odebrat obrázek ${index + 1}`}
                        onClick={() => removeImage(index)}
                      >
                        <Trash className="text-ui-fg-error" />
                      </IconButton>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => inputRef.current?.click()}
            isLoading={isUploading}
            className="self-start"
          >
            <CloudArrowUp />
            Přidat další obrázky
          </Button>
        </div>
      )}
    </section>
  );
};

export const BundleProductDetailsFields = ({
  details,
  onChange,
  onUploadingChange,
}: BundleProductDetailsFieldsProps) => {
  const updateTitle = (title: string) => {
    const currentAutomaticHandle = toHandle(details.title);
    const shouldUpdateHandle =
      !details.handle || details.handle === currentAutomaticHandle;

    onChange({
      title,
      ...(shouldUpdateHandle ? { handle: toHandle(title) } : {}),
    });
  };

  return (
    <div className="flex flex-col gap-y-10">
      <section className="flex flex-col gap-y-4">
        <div>
          <Heading level="h2">Název a identita</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Tyto údaje zákazník uvidí na detailu balíčku a ve vyhledávání.
          </Text>
        </div>

        <div className="flex flex-col gap-y-2">
          <Label htmlFor="bundle-title" size="small" weight="plus">
            Název balíčku
          </Label>
          <Input
            id="bundle-title"
            value={details.title}
            onChange={(event) => updateTitle(event.target.value)}
            placeholder="Například Zahradní sada"
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col gap-y-2">
          <Label htmlFor="bundle-subtitle" size="small" weight="plus">
            Podtitulek
          </Label>
          <Input
            id="bundle-subtitle"
            value={details.subtitle}
            onChange={(event) => onChange({ subtitle: event.target.value })}
            placeholder="Krátké doplnění názvu"
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col gap-y-2">
          <Label htmlFor="bundle-description" size="small" weight="plus">
            Popis
          </Label>
          <Textarea
            id="bundle-description"
            value={details.description}
            onChange={(event) => onChange({ description: event.target.value })}
            placeholder="Popište, co balíček obsahuje a pro koho je určený."
            rows={5}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="bundle-handle" size="small" weight="plus">
              URL identifikátor
            </Label>
            <div className="relative">
              <span className="text-ui-fg-muted pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm">
                /
              </span>
              <Input
                id="bundle-handle"
                value={details.handle}
                onChange={(event) =>
                  onChange({ handle: toHandle(event.target.value) })
                }
                placeholder="zahradni-sada"
                autoComplete="off"
                className="pl-5"
              />
            </div>
            <Text size="xsmall" className="text-ui-fg-muted">
              Vytvoří se z názvu; musí být v katalogu jedinečný.
            </Text>
          </div>

          <div className="flex flex-col gap-y-2">
            <Label htmlFor="bundle-material" size="small" weight="plus">
              Materiál
            </Label>
            <Input
              id="bundle-material"
              value={details.material}
              onChange={(event) => onChange({ material: event.target.value })}
              placeholder="Například ručně glazovaná keramika"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="bg-ui-bg-subtle shadow-borders-base flex items-center justify-between gap-4 rounded-lg p-4">
            <div>
              <Label htmlFor="bundle-discountable" size="small" weight="plus">
                Povolit slevy
              </Label>
              <Text size="xsmall" className="text-ui-fg-muted mt-1">
                Na balíček lze uplatnit slevový kód nebo propagaci.
              </Text>
            </div>
            <Switch
              id="bundle-discountable"
              checked={details.discountable}
              onCheckedChange={(discountable) => onChange({ discountable })}
            />
          </div>

          <div className="bg-ui-bg-subtle shadow-borders-base flex items-center justify-between gap-4 rounded-lg p-4">
            <div className="min-w-0">
              <Label htmlFor="bundle-status" size="small" weight="plus">
                Stav v obchodě
              </Label>
              <Text size="xsmall" className="text-ui-fg-muted mt-1">
                Koncept zůstane skrytý, publikovaný balíček je dostupný.
              </Text>
            </div>
            <Select
              value={details.status}
              onValueChange={(status) =>
                onChange({ status: status as BundleProductDetails["status"] })
              }
            >
              <Select.Trigger id="bundle-status" className="w-32 shrink-0">
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="draft">Koncept</Select.Item>
                <Select.Item value="published">Publikováno</Select.Item>
              </Select.Content>
            </Select>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-y-4">
        <div>
          <Heading level="h2">Cena balíčku</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Cena může vzniknout součtem vybraných provedení, nebo lze na celý
            součet použít slevu.
          </Text>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="bundle-pricing-mode" size="small" weight="plus">
              Způsob výpočtu
            </Label>
            <Select
              value={details.pricing_mode}
              onValueChange={(pricingMode) =>
                onChange({
                  pricing_mode: pricingMode as BundleProductDetails["pricing_mode"],
                  discount_percentage:
                    pricingMode === "component_sum_discount"
                      ? details.discount_percentage ?? 10
                      : null,
                })
              }
            >
              <Select.Trigger id="bundle-pricing-mode">
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="component_sum">
                  Součet vybraných provedení
                </Select.Item>
                <Select.Item value="component_sum_discount">
                  Součet se slevou balíčku
                </Select.Item>
                <Select.Item value="fixed_price">Pevná cena produktu</Select.Item>
              </Select.Content>
            </Select>
            <Text size="xsmall" className="text-ui-fg-muted">
              Pevnou cenu upravíte u katalogového produktu balíčku.
            </Text>
          </div>

          {details.pricing_mode === "component_sum_discount" && (
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="bundle-discount" size="small" weight="plus">
                Sleva balíčku v %
              </Label>
              <Input
                id="bundle-discount"
                type="number"
                min={0}
                max={100}
                step={1}
                value={details.discount_percentage ?? 0}
                onChange={(event) =>
                  onChange({
                    discount_percentage: Math.min(
                      100,
                      Math.max(0, Number(event.target.value) || 0)
                    ),
                  })
                }
              />
              <Text size="xsmall" className="text-ui-fg-muted">
                Sleva se počítá až z konkrétních provedení zvolených zákazníkem.
              </Text>
            </div>
          )}
        </div>
      </section>

      <BundleMedia
        details={details}
        onChange={onChange}
        onUploadingChange={onUploadingChange}
      />
    </div>
  );
};
