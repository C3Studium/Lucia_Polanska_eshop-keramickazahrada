"use client"
import { itemFieldPath, itemValue } from "@lib/util/site-copy"
import type { CopyBlock } from "@lib/util/site-copy"
import OrderStateShell from "@modules/order/components/order-state-shell"
import { useTexty } from "@lib/context/texty"

/**
 * Návrat z brány, když platba neprošla — storno, zamítnutí i zavřené okno.
 *
 * ## Proč to neříká „nic se neztratilo"
 *
 * Původní text zněl „Platba neproběhla — Nic se neztratilo. Košík vám
 * zůstal." Byla to pravda a zároveň to znělo jako rozloučení: uklidnilo to
 * a nic nechtělo. Jenže v tuhle chvíli objednávka **není** — vznikne až
 * zaplacením — a člověk odsud často odejde v přesvědčení, že koupeno má.
 *
 * Text proto říká, co chybí a proč na tom záleží: dokud není zaplaceno,
 * nemá se co odeslat.
 *
 * ## Proč se důvod píše, jen když ho známe
 *
 * ComGate vrací `paymentErrorReason` (změřeno: `NO_FUNDS` u zamítnuté
 * zkušební platby). Když ho backend zaznamená, dá se říct „na účtu nebyl
 * dostatek prostředků" místo „platba neproběhla" — to je rozdíl mezi
 * „zkus to znovu" a „zkus jinou kartu". Když ho neznáme, mlčí se: vymyšlený
 * důvod je horší než žádný.
 */
export default function PaymentCanceled({
  duvod,
  block,
}: {
  /** Česky formulovaný důvod od brány, když ho známe. */
  duvod?: string | null
  /**
   * Blok `kosik.platba-zrusena`: nadpis (`title` + `headline`), výzva
   * k zaplacení (`body`) a položky klíčované popiskem — obočí (`oboci`)
   * a názvy tlačítek (`tlacitko.zaplatit`, `tlacitko.kosik`). Položky, ne
   * pozice v `accent`: CMS z něj prázdné vyhazuje, a vymazané obočí by pak
   * dalo tlačítku k zaplacení nápis „Zobrazit košík".
   *
   * Úvodní věta s důvodem od brány zůstává v kódu — skládá se z údaje, který
   * redakce nezná, a slibuje, že se nic nestrhlo.
   */
  block?: CopyBlock
}) {
  /* Věty z administrace (Právní věci a texty → Texty obchodu). */
  const texty = useTexty()
  const callToAction =
    block?.bodyText?.trim() ||
    texty["kosik.platba_zrusena_vyzva"]

  return (
    <OrderStateShell
      eyebrow={itemValue(block, "oboci")?.trim() || "Objednávka čeká na zaplacení"}
      title={block?.title?.trim() || "Ještě není zaplaceno."}
      accent={block?.headline?.trim() || "Košík vám zůstal."}
      description={
        (duvod
          ? `Platba se nedokončila — ${duvod}. Nic jsme vám nestrhli. `
          : texty["kosik.platba_zrusena"]) + callToAction
      }
      status="canceled"
      primary={{
        href: "/checkout?step=payment",
        label: itemValue(block, "tlacitko.zaplatit")?.trim() || "Zaplatit objednávku",
      }}
      secondary={{
        href: "/cart",
        label: itemValue(block, "tlacitko.kosik")?.trim() || "Zobrazit košík",
      }}
      /* Popis se v místě neanotuje: je složený z věty v kódu a z `body`,
         editor by uložil obojí do jednoho pole. Upravuje se ve formuláři. */
      editDoc={block?.id ?? null}
      editFields={{ eyebrow: itemFieldPath(block, "oboci"), title: "title", accent: "headline" }}
    />
  )
}
