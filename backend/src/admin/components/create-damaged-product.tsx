import { Button, Input, Label, Text, Textarea, toast } from "@medusajs/ui"
import { useMutation, useQuery } from "@tanstack/react-query"
import { ChangeEvent, useEffect, useMemo, useState } from "react"
import { sdk } from "../lib/sdk"

/**
 * „Výprodej / poškozený kus" — založení z existujícího produktu.
 *
 * Poškozený kus je ten samý produkt, jen jeden konkrétní s vadou a levnější.
 * Místo zakládání od nuly se vybere zdroj + varianta, data (fotky, popis,
 * materiál, rozměry) zkopíruje backend (`POST /admin/damaged-products`) a tady
 * se dodá jen to, co je u vady vlastní: akční cena, fotky vady a popis vady.
 *
 * Žádná sleva ve Slevy+ nevzniká — „sleva" je akční cena + původní cena na
 * produktu, storefront z toho vykreslí přeškrtnutí.
 */

type VariantHit = {
  id: string
  title?: string
  prices?: { amount: number; currency_code: string }[]
}
type ProductHit = {
  id: string
  title: string
  handle?: string
  thumbnail?: string | null
  variants?: VariantHit[]
}

const czk = (variant?: VariantHit | null): number | null => {
  const price = (variant?.prices ?? []).find(
    (entry) => String(entry.currency_code).toLowerCase() === "czk"
  )
  return price ? Number(price.amount) : null
}

export default function CreateDamagedProduct({
  onCreated,
}: {
  onCreated: (productId: string) => void
}) {
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [product, setProduct] = useState<ProductHit | null>(null)
  const [variantId, setVariantId] = useState<string | null>(null)
  const [salePrice, setSalePrice] = useState("")
  const [originalPrice, setOriginalPrice] = useState("")
  const [damage, setDamage] = useState("")
  const [images, setImages] = useState<{ url: string }[]>([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [search])

  const canSearch = debounced.length >= 2 && !product
  const { data, isFetching } = useQuery({
    queryKey: ["damaged-product-search", debounced],
    queryFn: () =>
      sdk.client.fetch<{ products: ProductHit[] }>("/admin/products", {
        query: {
          q: debounced,
          limit: 8,
          status: ["published", "draft"],
          fields:
            "id,title,handle,thumbnail,variants.id,variants.title,variants.prices.amount,variants.prices.currency_code",
        },
      }),
    enabled: canSearch,
    staleTime: 30_000,
  })

  const variants = product?.variants ?? []
  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === variantId) ?? null,
    [variants, variantId]
  )

  const pickProduct = (hit: ProductHit) => {
    setProduct(hit)
    const only = hit.variants?.length === 1 ? hit.variants[0] : null
    setVariantId(only?.id ?? null)
    // Původní cena se předvyplní z varianty (když je jedna), akční necháme na ní.
    const base = czk(only)
    setOriginalPrice(base != null ? String(base) : "")
  }

  const pickVariant = (variant: VariantHit) => {
    setVariantId(variant.id)
    const base = czk(variant)
    setOriginalPrice(base != null ? String(base) : "")
  }

  const reset = () => {
    setProduct(null)
    setVariantId(null)
    setSalePrice("")
    setOriginalPrice("")
    setDamage("")
    setImages([])
    setSearch("")
  }

  const uploadImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).filter((file) =>
      file.type.startsWith("image/")
    )
    event.target.value = ""
    if (!files.length) return
    setUploading(true)
    try {
      const result = await sdk.admin.upload.create({ files })
      const uploaded = (result.files ?? [])
        .map((file) => file.url)
        .filter(Boolean)
        .map((url) => ({ url: String(url) }))
      setImages((current) => [...current, ...uploaded])
    } catch {
      toast.error("Fotky se nepodařilo nahrát.")
    } finally {
      setUploading(false)
    }
  }

  const create = useMutation({
    mutationFn: async () => {
      const sale = Number(salePrice)
      const original = Number(originalPrice)
      if (!product || !variantId) {
        throw new Error("Vyberte produkt a jeho variantu.")
      }
      if (!Number.isFinite(sale) || sale <= 0) {
        throw new Error("Zadejte akční cenu v Kč.")
      }
      const result = await sdk.client.fetch<{ product: { id: string } }>(
        "/admin/damaged-products",
        {
          method: "POST",
          body: {
            source_product_id: product.id,
            source_variant_id: variantId,
            sale_price: sale,
            original_price:
              Number.isFinite(original) && original > 0 ? original : undefined,
            damage: damage.trim() || undefined,
            images: images.length ? images : undefined,
          },
        }
      )
      return result.product.id
    },
    onSuccess: (productId) => {
      toast.success("Poškozený kus založen.")
      onCreated(productId)
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Kus se nepodařilo založit."
      )
    },
  })

  const canCreate =
    !!product && !!variantId && Number(salePrice) > 0 && !create.isPending

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Zdrojový produkt */}
      {!product ? (
        <div>
          <Label htmlFor="damaged-search">Vyhledat produkt</Label>
          <Input
            id="damaged-search"
            className="mt-1"
            value={search}
            autoFocus
            placeholder="Název produktu, který se poškodil…"
            onChange={(event) => setSearch(event.target.value)}
          />
          {canSearch && (
            <div className="mt-2 flex flex-col gap-1">
              {isFetching && (
                <Text size="small" className="text-ui-fg-subtle">
                  Hledám…
                </Text>
              )}
              {(data?.products ?? []).map((hit) => (
                <button
                  key={hit.id}
                  type="button"
                  onClick={() => pickProduct(hit)}
                  className="transition-fg flex items-center gap-3 rounded-lg px-3 py-2 text-left shadow-borders-base hover:bg-ui-bg-base-hover"
                >
                  {hit.thumbnail ? (
                    <img
                      src={hit.thumbnail}
                      alt=""
                      className="h-9 w-9 rounded object-cover"
                    />
                  ) : (
                    <span className="bg-ui-bg-component flex h-9 w-9 items-center justify-center rounded text-ui-fg-muted">
                      {hit.title.slice(0, 1)}
                    </span>
                  )}
                  <span className="flex-1">{hit.title}</span>
                </button>
              ))}
              {!isFetching && (data?.products ?? []).length === 0 && (
                <Text size="small" className="text-ui-fg-subtle">
                  Nic nenalezeno.
                </Text>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-lg px-3 py-2 shadow-borders-base">
          <span className="flex items-center gap-3">
            {product.thumbnail ? (
              <img
                src={product.thumbnail}
                alt=""
                className="h-9 w-9 rounded object-cover"
              />
            ) : null}
            <span>{product.title}</span>
          </span>
          <Button variant="transparent" size="small" onClick={reset}>
            Změnit
          </Button>
        </div>
      )}

      {/* Varianta */}
      {product && variants.length > 1 && (
        <div>
          <Label>Varianta</Label>
          <div className="mt-1 flex flex-wrap gap-2">
            {variants.map((variant) => (
              <button
                key={variant.id}
                type="button"
                onClick={() => pickVariant(variant)}
                className={`transition-fg rounded-lg px-3 py-1.5 text-sm shadow-borders-base ${
                  variantId === variant.id
                    ? "bg-ui-bg-base-hover shadow-borders-interactive-with-active"
                    : "hover:bg-ui-bg-base-hover"
                }`}
              >
                {variant.title || "Varianta"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ceny */}
      {product && variantId && (
        <>
          <div className="flex flex-wrap gap-3">
            <div className="min-w-32 flex-1">
              <Label htmlFor="damaged-original">Původní cena (Kč)</Label>
              <Input
                id="damaged-original"
                className="mt-1"
                type="number"
                inputMode="numeric"
                value={originalPrice}
                onChange={(event) => setOriginalPrice(event.target.value)}
                placeholder="např. 500"
              />
            </div>
            <div className="min-w-32 flex-1">
              <Label htmlFor="damaged-sale">Akční cena (Kč)</Label>
              <Input
                id="damaged-sale"
                className="mt-1"
                type="number"
                inputMode="numeric"
                value={salePrice}
                onChange={(event) => setSalePrice(event.target.value)}
                placeholder="na kolik slevujete"
              />
            </div>
          </div>
          <Text size="xsmall" className="text-ui-fg-subtle">
            Původní cena se v e-shopu ukáže přeškrtnutá; žádná sleva se nezakládá.
          </Text>

          {/* Fotky vady */}
          <div>
            <Label>Fotky poškození</Label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {images.map((image) => (
                <img
                  key={image.url}
                  src={image.url}
                  alt=""
                  className="h-14 w-14 rounded object-cover shadow-borders-base"
                />
              ))}
              <label className="transition-fg flex h-14 w-14 cursor-pointer items-center justify-center rounded text-ui-fg-muted shadow-borders-base hover:bg-ui-bg-base-hover">
                {uploading ? "…" : "+"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={uploadImages}
                />
              </label>
            </div>
            <Text size="xsmall" className="text-ui-fg-subtle mt-1">
              Když žádné nenahrajete, použijí se fotky původního produktu.
            </Text>
          </div>

          {/* Popis vady */}
          <div>
            <Label htmlFor="damaged-note">Co je to za poškození</Label>
            <Textarea
              id="damaged-note"
              className="mt-1"
              value={damage}
              onChange={(event) => setDamage(event.target.value)}
              placeholder="např. drobný odštípnutý okraj na spodní hraně, jinak bez vady"
            />
          </div>

          <div>
            <Button
              onClick={() => create.mutate()}
              disabled={!canCreate}
              isLoading={create.isPending}
            >
              Založit a otevřít
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
