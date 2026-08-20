import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Button, Container, Heading, Text } from "@medusajs/ui"
import { ArrowUpRightOnBox, PaperClip, Plus } from "@medusajs/icons";

import {
  DetailWidgetProps,
  AdminProduct,
} from "@medusajs/framework/types"
import { useEffect, useState } from "react";
import { sdk } from "../lib/sdk";

const ExpressCheckoutWidget = ({ 
  data: product,
}: DetailWidgetProps<AdminProduct>) => {
    const [copied, setCopied] = useState(false)
    const [ isOpen, setIsOpen ] = useState(false)

   /* The link must point at the real storefront, wherever it runs — the
      backend knows (`store_url` comes from STOREFRONT_PUBLIC_URL), the admin
      bundle does not, and a hardcoded localhost was a broken link in prod. */
   const [storeUrl, setStoreUrl] = useState<string | null>(null)
   useEffect(() => {
       let cancelled = false
       sdk.client
           .fetch<{ store_url?: string | null }>(`/admin/workbench/products/${product.id}`)
           .then((detail) => {
               if (!cancelled) setStoreUrl(detail?.store_url ?? null)
           })
           .catch(() => {})
       return () => {
           cancelled = true
       }
   }, [product.id])

   const expressURL = storeUrl
       ? storeUrl.replace("/products/", "/express-checkout/")
       : null

   const copyToClipboard = () => {
       if (!expressURL) return
       navigator.clipboard.writeText(expressURL)
       setCopied(true)
       setTimeout(() => setCopied(false), 3500)
   }

  return (
    <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-1">
                <Heading level="h2">Express Checkout - </Heading>
                <Text> Link pro Sociální sítě</Text>
            </div>
            <div className="flex gap-2">
                {expressURL ? (
                    <a href={expressURL} target="_blank" rel="noreferrer">
                        <Button variant="transparent">
                        <ArrowUpRightOnBox /> Zobrazit Stránku
                        </Button>
                    </a>
                ) : (
                    <Text size="small" className="text-ui-fg-subtle self-center">
                        Odkaz bude po zveřejnění produktu.
                    </Text>
                )}
                <Button
                    variant="secondary"
                    onClick={copyToClipboard}
                    disabled={!expressURL}
                >
                    <PaperClip /> {copied ? "Zkopírováno!" : "Zkopírovat odkaz"}
                </Button>
            </div>
        </div>
        <div className="px-6 py-3 flex flex-col gap-1 items-start justify-center">
            <div className="flex items-center justify-start cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                <Button variant="secondary" className="flex items-center gap-2">
                    <Plus />
                    {isOpen ? "Skrýt detaily" : "Zobrazit detaily"}
                </Button>
            </div>
            <div 
                className="flex flex-col gap-1"
                style={{ height: isOpen ? "auto" : "0", overflow: "hidden", transition: "height 0.3s ease-in-out" }}
            >
                <Text className="px-6 break-all">Sdílejte tento odkaz na sociálních sítích, když budete sdílet fotku s produktem, aby si to lidi rozklikli a rovnou mohli produkt koupit.</Text>
                <Text className="px-6 break-all">Je to rychlý a snadný způsob, jak zvýšit prodeje! Tyto stránky jsou snažší pro nákup, a to během pár kliknutí, než náročné procházení celého e-shopu.</Text>
                <Text className="px-6 break-all">Pomůže Vám to zvýšit konverze a prodeje.</Text>
            </div>
        </div>
    </Container>
  )
}


export const config = defineWidgetConfig({
  zone: "product.details.before",
})

export default ExpressCheckoutWidget