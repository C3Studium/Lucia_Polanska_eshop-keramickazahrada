"use client"

import { useEffect, useRef, useState } from "react"

import { placeOrder } from "@lib/data/cart"
import type { CopyBlock } from "@lib/util/site-copy"
import OrderStateShell from "@modules/order/components/order-state-shell"

/**
 * A successful `placeOrder` redirects to the order page, and Next signals that redirect by
 * rejecting with a tagged error. That is not a failure and must not be treated as one.
 */
const isRedirectSignal = (error: unknown) =>
  typeof (error as { digest?: unknown })?.digest === "string" &&
  (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")

/*
 * Proč se to zkouší víckrát.
 *
 * Brána pošle zákazníka zpátky ve chvíli, kdy peníze vezme — ale její vlastní
 * dotaz na stav i oznámení, které chodí na server, se za tím opožďují
 * o vteřiny. Jediný pokus hned po návratu tak umí selhat na platbě, která je
 * v pořádku, a z dvouvteřinového zpoždění udělá objednávku k ručnímu
 * dodělání. Šest pokusů po třech vteřinách je zhruba čtvrt minuty — pod tím,
 * co člověk vydrží koukat na „ještě ji dokončujeme", a nad tím, co brána
 * potřebuje.
 */
const POKUSU = 6
const PRODLEVA_MS = 3000

export default function PaymentConfirmed({
  id,
  supportEmail,
  supportPhone,
  block,
  preview = false,
}: {
  id: string
  supportEmail: string
  supportPhone: string
  /**
   * Blok `kosik.platba-potvrzena` — texty čekání, než se objednávka uloží:
   * obočí (`accent.0`), nadpis (`title` + `headline`), věta (`body`).
   *
   * Stav „objednávka se sama nedokončila" do CMS schválně nejde: peníze už
   * odešly a text musí říct „znovu neplaťte" a dát kontakt i číslo košíku.
   * Přeformulovaný ve Studiu by se to dalo omylem ztratit — a odpovědí na
   * nejasnou větu tady je druhá platba.
   */
  block?: CopyBlock
  /**
   * Ukázka ve Studiu (`/cart/ukazka/confirmed`): jen texty čekání, košík se
   * NEDOKONČUJE — žádný `placeOrder`.
   */
  preview?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const startedRef = useRef(false)

  useEffect(() => {
    // React runs effects twice in development; the order must only be placed once.
    if (startedRef.current || preview) {
      return
    }
    startedRef.current = true

    const complete = async () => {
      for (let pokus = 1; pokus <= POKUSU; pokus += 1) {
        try {
          // Capture happens server-side via the ComGate webhook; the storefront
          // used to also call a /store/payment/capture route that never existed.
          await placeOrder(id)
          return
        } catch (error) {
          if (isRedirectSignal(error)) {
            return
          }

          if (pokus === POKUSU) {
            console.error(`[objednávka] košík ${id} se nepodařilo dokončit`, error)
            setFailed(true)
            return
          }

          await new Promise((hotovo) => setTimeout(hotovo, PRODLEVA_MS))
        }
      }
    }

    complete()
  }, [id, preview])

  if (failed) {
    return (
      <OrderStateShell
        eyebrow="Ještě to dořešíme"
        title="Platbu máme."
        accent="Objednávku dodělám ručně."
        // The money has left the customer's account. Never imply they should pay again.
        description={`Platba prošla, ale objednávka se sama nedokončila. Znovu prosím neplaťte — platbu máme zaznamenanou a objednávku dodělám ručně. Napište nám na ${supportEmail} nebo zavolejte na ${supportPhone} a uveďte číslo ${id}. Ozveme se obratem.`}
        status="canceled"
        primary={{ href: "/store", label: "Pokračovat v obchodě" }}
      />
    )
  }

  return (
    <OrderStateShell
      eyebrow={block?.accent?.[0]?.trim() || "Ověřujeme platbu"}
      title={block?.title?.trim() || "Platbu máme."}
      accent={block?.headline?.trim() || "Ještě ji dokončujeme."}
      description={
        block?.bodyText?.trim() ||
        "Ještě chviličku — objednávku potvrzujeme a ukládáme. Stránku nemusíte obnovovat."
      }
      status="pending"
      editDoc={block?.id ?? null}
      editFields={{ eyebrow: "accent.0", title: "title", accent: "headline", description: "body" }}
    />
  )
}
