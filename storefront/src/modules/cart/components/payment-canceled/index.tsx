"use client"
import OrderStateShell from "@modules/order/components/order-state-shell"

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
}: {
  /** Česky formulovaný důvod od brány, když ho známe. */
  duvod?: string | null
}) {
  return (
    <OrderStateShell
      eyebrow="Objednávka čeká na zaplacení"
      title="Ještě není zaplaceno."
      accent="Košík vám zůstal."
      description={
        (duvod
          ? `Platba se nedokončila — ${duvod}. Nic jsme vám nestrhli. `
          : "Platba se nedokončila a nic jsme vám nestrhli. ") +
        "Zaplaťte prosím objednávku, ať ji můžeme co nejdřív poslat — do té doby ji nemáme jak odeslat. Zboží vám v košíku zůstalo, stačí pokračovat."
      }
      status="canceled"
      primary={{ href: "/checkout?step=payment", label: "Zaplatit objednávku" }}
      secondary={{ href: "/cart", label: "Zobrazit košík" }}
    />
  )
}
