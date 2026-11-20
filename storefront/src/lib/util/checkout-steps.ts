import { isMadeToOrderLine } from "@lib/util/commission"
import { isDobirkaFeeLine } from "@lib/util/dobirka"
import { isPackagingLine } from "@lib/util/packaging"

/**
 * Kroky pokladny podle košíku — JEDNO místo pro bublinky, hlavičku kroku
 * i tlačítka „Pokračovat" a „Zpět" (19. 11. 2026, Matěj).
 *
 * - jen běžné zboží:   Adresa · Doručení · Poznámka · Platba · Přehled
 * - jen zakázka:       Adresa · Doručení · Zadání · Platba · Přehled
 * - zakázka + běžné:   Adresa · Doručení · Zadání · Poznámka · Platba · Přehled
 *
 * Zadání je povinné (bez něj k platbě nepustí), Poznámka nikdy — je to
 * vzkaz k běžným výrobkům, uloží se do `customer_note` a admin ho ukáže
 * jako „Poznámka od zákazníka".
 */
export type CheckoutStepKey =
  | "address"
  | "delivery"
  | "brief"
  | "note"
  | "payment"
  | "review"

export type CheckoutStep = { key: CheckoutStepKey; label: string; text: string }

type Line = Parameters<typeof isMadeToOrderLine>[0] & Parameters<typeof isPackagingLine>[0]

export const maZakazku = (items: readonly unknown[] | null | undefined): boolean =>
  ((items ?? []) as Line[]).some(isMadeToOrderLine)

/** Běžné zboží = řádek výrobku, který není zakázka, balné ani doběrečné. */
export const maBezneZbozi = (items: readonly unknown[] | null | undefined): boolean =>
  ((items ?? []) as Line[]).some(
    (item) => !isMadeToOrderLine(item) && !isPackagingLine(item) && !isDobirkaFeeLine(item as never)
  )

export const checkoutSteps = (items: readonly unknown[] | null | undefined): CheckoutStep[] => {
  const zakazka = maZakazku(items)
  const bezne = maBezneZbozi(items) || !zakazka
  return [
    { key: "address", label: "Adresa", text: "Kam a komu to máme poslat." },
    { key: "delivery", label: "Doručení", text: "Česká pošta, Balíkovna nebo osobní odběr v ateliéru." },
    ...(zakazka
      ? [{ key: "brief" as const, label: "Zadání", text: "Co si představujete — popis a případně fotky." }]
      : []),
    ...(bezne
      ? [{ key: "note" as const, label: "Poznámka", text: "Doplňující informace k objednávce — velikost, barva… Nepovinné." }]
      : []),
    {
      key: "payment",
      label: "Platba",
      text: zakazka ? "Záloha kartou nebo bankou; zbytek po dokončení." : "Kartou, bankou, nebo při převzetí.",
    },
    { key: "review", label: "Přehled", text: "Poslední kontrola a odeslání objednávky." },
  ]
}

/** Krok za `key` (nebo `payment`, když `key` v téhle pokladně není). */
export const nextCheckoutStep = (
  items: readonly unknown[] | null | undefined,
  key: CheckoutStepKey
): CheckoutStepKey => {
  const kroky = checkoutSteps(items)
  const i = kroky.findIndex((krok) => krok.key === key)
  return i >= 0 && i < kroky.length - 1 ? kroky[i + 1].key : "payment"
}

/** Krok před `key` (nebo `delivery`). */
export const previousCheckoutStep = (
  items: readonly unknown[] | null | undefined,
  key: CheckoutStepKey
): CheckoutStepKey => {
  const kroky = checkoutSteps(items)
  const i = kroky.findIndex((krok) => krok.key === key)
  return i > 0 ? kroky[i - 1].key : "delivery"
}

export const stepLabel = (key: CheckoutStepKey): string =>
  ({ address: "adrese", delivery: "doručení", brief: "zadání", note: "poznámce", payment: "platbě", review: "přehledu" })[key]
