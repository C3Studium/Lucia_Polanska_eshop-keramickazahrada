"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { previewGuestOrderEdit } from "@lib/data/guest-order-edit"
import type { EditAction, EditPreview } from "@lib/data/order-edit"

/** Odstup po poslední změně, než se server zeptá na rozdíl (kontrakt: debounce). */
const DEBOUNCE_MS = 600

export type PreviewState =
  /** Žádná změna — není co počítat. */
  | { status: "idle" }
  /** Běží odpočet nebo požadavek. */
  | { status: "waiting" }
  | { status: "ready"; key: string; preview: EditPreview }
  /** Server změnu odmítl (pravidlo) nebo neodpověděl. */
  | { status: "error"; key: string; message: string }

/**
 * Náhled úpravy (`dry_run`) s odstupem po každé změně.
 *
 * Tři pravidla z kontraktu, a proč tak:
 *  - **debounce 600 ms** — stepper se kliká rychle za sebou; ptát se po každém
 *    kliku by znamenalo založit a zahodit v Meduse úpravu objednávky pětkrát
 *    za vteřinu,
 *  - **vždy jen jeden požadavek** — dokud jeden běží, další se neposílá;
 *    po jeho návratu se rovnou pošle ten nejnovější stav, pokud mezitím přišel,
 *  - **zastaralé odpovědi se zahazují** — odpověď patří ke klíči (akce + otisk
 *    objednávky), se kterým se ptala; když se mezitím klíč změnil, nic nezobrazí.
 *
 * `stamp` je otisk objednávky (součty, doručení): po změně výdejny se může
 * změnit poštovné, takže tentýž návrh je třeba spočítat znovu.
 */
export function useEditPreview({
  orderId,
  token,
  actions,
  stamp,
  enabled,
}: {
  orderId: string
  token: string
  actions: EditAction[]
  stamp: string
  enabled: boolean
}) {
  const actionsJson = useMemo(() => JSON.stringify(actions), [actions])
  const key = `${stamp}#${actionsJson}`
  const hasActions = actions.length > 0

  const [state, setState] = useState<PreviewState>({ status: "idle" })
  /** Poslední úspěšný náhled — během přepočtu se ukazuje zašedlý, ať souhrn
      neposkakuje mezi čísly a prázdnem. */
  const [last, setLast] = useState<EditPreview | null>(null)

  const latestKey = useRef(key)
  const latestActions = useRef(actionsJson)
  /** Vypnuto (čeká platba, po uložení) — rozběhnutý náhled už nic nezobrazí. */
  const latestEnabled = useRef(enabled)
  const inFlight = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const run = useCallback(async () => {
    timer.current = undefined
    if (inFlight.current) return // po návratu běžícího se zeptáme znovu

    const requestedKey = latestKey.current
    const requested = JSON.parse(latestActions.current) as EditAction[]
    if (!requested.length || !latestEnabled.current) return

    inFlight.current = true
    const result = await previewGuestOrderEdit(orderId, requested, token).catch(
      () => ({
        error:
          "Rozdíl ceny se teď nepodařilo spočítat. Zkuste to prosím za chvíli znovu.",
      })
    )
    inFlight.current = false
    if (!mounted.current || !latestEnabled.current) return

    if (requestedKey !== latestKey.current) {
      /* Zastaralá odpověď. Běží-li odpočet, pošle nejnovější stav on; jinak
         odpočet doběhl, zatímco jsme čekali, a jeho běh se vzdal — pošli hned. */
      if (timer.current === undefined) void run()
      return
    }

    if ("error" in result) {
      setState({ status: "error", key: requestedKey, message: result.error })
    } else {
      setState({ status: "ready", key: requestedKey, preview: result.preview })
      setLast(result.preview)
    }
  }, [orderId, token])

  useEffect(() => {
    latestKey.current = key
    latestActions.current = actionsJson
    latestEnabled.current = enabled
    window.clearTimeout(timer.current)
    timer.current = undefined

    if (!enabled || !hasActions) {
      setState({ status: "idle" })
      if (!hasActions) setLast(null)
      return
    }

    setState({ status: "waiting" })
    timer.current = window.setTimeout(() => void run(), DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer.current)
      timer.current = undefined
    }
  }, [key, actionsJson, enabled, hasActions, run])

  /** Náhled platí jen pro přesně tenhle stav návrhu — jinak by tlačítko mohlo
      ukázat „Uložit" u změny, která ve skutečnosti znamená platbu. */
  const current =
    state.status === "ready" && state.key === key ? state.preview : null

  return { state, current, last }
}
