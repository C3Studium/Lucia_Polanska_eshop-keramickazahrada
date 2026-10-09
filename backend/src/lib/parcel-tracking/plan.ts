/**
 * Plánovač přechodů sledované zásilky — ČISTÁ část `applyParcelEvents`
 * (docs/sledovani-zasilek.md §3).
 *
 * Dostane dnešní řádek + události z ČP (nebo jednu simulovanou) a vrátí, co
 * se má do řádku zapsat a které vedlejší účinky spustit. Žádný container,
 * žádná síť — proto jde matice přechodů dokázat v unit testu a job i simulace
 * jdou prokazatelně touž cestou.
 *
 * Pravidla, která drží pohromadě:
 * - razítka `*_at` se nastaví jen jednou (první výskyt), spouštěče jen tehdy;
 * - fáze jen vpřed (`PHASE_RANK`), `problem` nikdy neposouvá zpět a nepřepíše
 *   hotovou zásilku;
 * - dedupe událostí podle id+date+text — ČP dává jen datum, dvě stejné
 *   události v jednom dni jsou jedna;
 * - `-3`/`-4` se nepřidávají do historie (šum „není v evidenci" každou
 *   půlhodinu), jen se zapíše jako poslední stav a počítá se pokus; po 30
 *   dnech bez jediné skutečné události se sledování vzdá.
 */

import {
  classifyState,
  isTerminalPhase,
  PHASE_RANK,
  type ParcelPhase,
  type StateKind,
} from "./classify"
import type { ParcelEventInput } from "./client"

export type ParcelEventSource = "cp" | "simulated"

export type StoredParcelEvent = ParcelEventInput & {
  source: ParcelEventSource
  seen_at: string
}

/** Jen pole, která plánovač čte — řádek z DB jich má víc. */
export type TrackingSnapshot = {
  phase: ParcelPhase
  events?: unknown
  handed_over_at?: Date | string | null
  stored_at?: Date | string | null
  delivered_at?: Date | string | null
  returned_at?: Date | string | null
  done?: boolean | null
  note?: string | null
  check_count?: number | null
  created_at?: Date | string | null
  last_state_id?: string | null
  last_state_text?: string | null
}

export type TrackingPatch = {
  phase: ParcelPhase
  events: StoredParcelEvent[]
  handed_over_at: Date | null
  stored_at: Date | null
  delivered_at: Date | null
  returned_at: Date | null
  last_state_id: string | null
  last_state_text: string | null
  last_checked_at: Date
  check_count: number
  done: boolean
  note: string | null
}

export type ParcelTriggers = {
  /** První předání dopravci — shipment, fáze „odesláno", e-mail zákazníkovi. */
  handed_over: boolean
  /** Zásilka se vrací / vrátila — upozornit majitelku. */
  returned: boolean
  /** ČP hlásí poškození — upozornit majitelku, sledovat dál. */
  damaged: boolean
  /** 30 dnů od štítku a ČP zásilku stále nezná — vzdáno, upozornit majitelku. */
  never_appeared: boolean
}

export type ParcelPlan = {
  patch: TrackingPatch
  newEvents: StoredParcelEvent[]
  triggers: ParcelTriggers
}

export const GIVE_UP_AFTER_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

export const eventKey = (event: {
  id?: string | null
  date?: string | null
  text?: string | null
}): string => `${event.id ?? ""}|${event.date ?? ""}|${event.text ?? ""}`

const toDate = (value: Date | string | null | undefined): Date | null => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

/**
 * Časové razítko události: ČP dává jen den. Dnešní událost dostane „teď"
 * (simulace i čerstvý stav), starší poledne UTC toho dne — ať se den
 * nepřeklopí převodem pásma a razítko zůstává v rámci dne, kdy se to stalo.
 */
export const eventTimestamp = (date: string | null | undefined, now: Date): Date => {
  const day = (date ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day === now.toISOString().slice(0, 10)) {
    return now
  }
  const parsed = new Date(`${day}T12:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) ? parsed : now
}

const storedEvents = (raw: unknown): StoredParcelEvent[] =>
  Array.isArray(raw)
    ? (raw.filter((item) => item && typeof item === "object") as StoredParcelEvent[])
    : []

/** Fázi posuň jen vpřed; `problem` jen dokud zásilka není hotová. */
export const nextPhase = (current: ParcelPhase, kind: StateKind): ParcelPhase => {
  if (kind === "problem") {
    return isTerminalPhase(current) ? current : "problem"
  }
  if (kind === "returned") {
    return current === "delivered" ? current : "returned"
  }
  const candidate: ParcelPhase | null =
    kind === "label"
      ? "label"
      : kind === "handed_over"
        ? "handed_over"
        : kind === "in_transit"
          ? "in_transit"
          : kind === "stored"
            ? "stored"
            : kind === "delivered"
              ? "delivered"
              : null
  if (!candidate) return current
  // `in_transit` jen z `handed_over` (kontrakt §3) — rank to zařídí: z
  // `problem` (rank 2) ani ze `stored` se na cestu nevrací.
  return PHASE_RANK[candidate] > PHASE_RANK[current] ? candidate : current
}

export const planParcelUpdate = (
  tracking: TrackingSnapshot,
  events: ParcelEventInput[],
  source: ParcelEventSource,
  now: Date = new Date()
): ParcelPlan => {
  const existing = storedEvents(tracking.events)
  const seen = new Set(existing.map(eventKey))

  let phase: ParcelPhase = tracking.phase ?? "label"
  let handedOverAt = toDate(tracking.handed_over_at)
  let storedAt = toDate(tracking.stored_at)
  let deliveredAt = toDate(tracking.delivered_at)
  let returnedAt = toDate(tracking.returned_at)
  let done = Boolean(tracking.done)
  let note = tracking.note ?? null
  // Prázdná odpověď (síť vrátila nic) nesmí smazat poslední známý stav.
  let lastId: string | null = tracking.last_state_id ?? null
  let lastText: string | null = tracking.last_state_text ?? null

  const triggers: ParcelTriggers = {
    handed_over: false,
    returned: false,
    damaged: false,
    never_appeared: false,
  }
  const newEvents: StoredParcelEvent[] = []
  const seenAt = now.toISOString()

  const addNote = (text: string) => {
    if (!note) {
      note = text
    } else if (!note.includes(text)) {
      note = `${note} · ${text}`
    }
  }

  for (const event of events) {
    const meaning = classifyState(event.id, event.text)
    lastId = event.id || null
    lastText = event.text || null

    if (meaning.kind === "not_found") {
      // Jen „ještě nic" — do historie se nepíše, počítá se níž.
      continue
    }

    const key = eventKey(event)
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    newEvents.push({ ...event, source, seen_at: seenAt })

    const at = eventTimestamp(event.date, now)

    switch (meaning.kind) {
      case "label":
        break
      case "handed_over":
        if (!handedOverAt) {
          handedOverAt = at
          triggers.handed_over = true
        }
        break
      case "in_transit":
        // Zásilka na cestě = dopravce ji má, i kdyby „21" v historii chybělo
        // (sledování začalo pozdě, ČP stav vynechala). Bez tohohle by widget
        // ukázal „na cestě" bez data předání a zákazník by nedostal „odesláno".
        if (!handedOverAt) {
          handedOverAt = at
          triggers.handed_over = true
          phase = nextPhase(phase, "handed_over")
        }
        if (meaning.misrouted) {
          addNote("ČP: chybně směrovaná zásilka")
        }
        break
      case "stored":
        if (!handedOverAt) {
          handedOverAt = at
          triggers.handed_over = true
          phase = nextPhase(phase, "handed_over")
        }
        if (!storedAt) storedAt = at
        break
      case "delivered":
        if (!handedOverAt) {
          handedOverAt = at
          triggers.handed_over = true
          phase = nextPhase(phase, "handed_over")
        }
        if (!deliveredAt) deliveredAt = at
        done = true
        break
      case "returned":
        if (!returnedAt) {
          returnedAt = at
          triggers.returned = true
        }
        done = true
        break
      case "problem":
        triggers.damaged = true
        break
      case "out_of_register":
        done = true
        break
    }

    phase = nextPhase(phase, meaning.kind)
  }

  const isCheck = source === "cp"
  const checkCount = (tracking.check_count ?? 0) + (isCheck ? 1 : 0)

  // Po 30 dnech od štítku bez jediné skutečné události: balík nejspíš nikdy
  // neodešel (štítek vytištěn, krabice zůstala v ateliéru). Dál se neptáme.
  const createdAt = toDate(tracking.created_at)
  // „Skutečná" událost = cokoli mimo štítek: nAPI hlásí PŘEDANÁ / ZPRACOVANÁ
  // DATA i u balíku, který nikdy neodešel — to není důkaz, že ČP balík má.
  const hasRealEvents = [...existing, ...newEvents].some(
    (event) => classifyState(event.id, event.text).kind !== "label"
  )
  if (
    isCheck &&
    !done &&
    !hasRealEvents &&
    createdAt &&
    now.getTime() - createdAt.getTime() >= GIVE_UP_AFTER_DAYS * DAY_MS
  ) {
    done = true
    triggers.never_appeared = true
    addNote(`vzdáno po ${GIVE_UP_AFTER_DAYS} dnech — zásilka se u ČP neobjevila`)
  }

  return {
    patch: {
      phase,
      events: [...existing, ...newEvents],
      handed_over_at: handedOverAt,
      stored_at: storedAt,
      delivered_at: deliveredAt,
      returned_at: returnedAt,
      last_state_id: lastId,
      last_state_text: lastText,
      last_checked_at: now,
      check_count: checkCount,
      done,
      note,
    },
    newEvents,
    triggers,
  }
}
