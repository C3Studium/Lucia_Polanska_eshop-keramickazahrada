"use client"

import { editable } from "@c3studium/valecms/edit"
import { useEditRerender } from "@lib/hooks/use-edit-rerender"
import { itemFieldPath } from "@lib/util/site-copy"
import type { CopyBlock } from "@lib/util/site-copy"
import type { ElementType, ReactNode } from "react"

/**
 * Anotace hodnoty položky bloku podle popisku, rovnou jako atributy.
 *
 * Dvojice `itemFieldPath` + `editable` by se jinak opisovala do každé
 * komponenty, která čte bloky klíčované popiskem (stránka výrobku, stavy
 * newsletteru, rychlý nákup…). Položka, která v bloku není, dává `{}` — ze
 * stejného důvodu jako `itemFieldPath`. Mimo náhled Studia vždycky `{}`.
 *
 * Bydlí tady, v klientském modulu, a ne v `@lib/util/site-copy`: ten čte
 * i serverový `@lib/data/site-copy` a veřejný vstup `…/edit` nese React hooky
 * (`useStudioSurface`), které do serverového grafu nepatří.
 */
export const editableItem = (
  block: CopyBlock | undefined,
  label: string,
  /** Které pole položky — `note` u dvojic jako „nadpis + zvýrazněný konec". */
  field: "value" | "note" = "value"
): Record<string, string | undefined> => {
  const path = itemFieldPath(block, label, field)
  return path ? editable(block, path) : {}
}

/**
 * Text z CMS vykreslený serverovou komponentou — s anotací pro „Upravit kontent".
 *
 * ## Proč klientská komponenta kolem jednoho prvku
 *
 * `editable()` odpovídá podle `isEditMode()` a ten se zapíná až z efektu
 * (knihovna to tak dělá schválně: veřejné HTML nemá nést nic o editaci). Na
 * serveru je proto vždycky `{}` — serverová komponenta, která si anotaci
 * spočítá sama, ji v editoru nikdy mít nebude a text v rámu vypadá jako
 * natvrdo v kódu. Tohle je nejmenší klientský kousek, který se po zapnutí
 * editace sám překreslí (`useEditRerender`) a atributy dopíše.
 *
 * Vykreslí TENTÝŽ prvek, který by stránka vykreslila sama (`as`, `className`),
 * takže DOM i styly zůstávají, jak byly — žádný obal navíc.
 *
 * `doc` je `id` bloku (`block?.id`), ne celý blok: mimo náhled Studia je null
 * a do klientského balíku tak nejde nic víc než ten text.
 */
export default function CmsText({
  as: Tag = "span",
  doc,
  field,
  children,
  ...rest
}: {
  as?: ElementType
  doc?: string | null
  field?: string
  children?: ReactNode
  className?: string
  id?: string
  "data-testid"?: string
}) {
  useEditRerender()

  return (
    <Tag {...rest} {...(doc && field ? editable(doc, field) : {})}>
      {children}
    </Tag>
  )
}
