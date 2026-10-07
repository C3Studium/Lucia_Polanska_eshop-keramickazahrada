import LocalizedClientLink from "@modules/common/components/localized-client-link"
import type { ReactNode } from "react"
import s from "./style.module.scss"

type OrderStateShellProps = {
  eyebrow: string
  title: string
  accent?: string
  description: string
  status?: "pending" | "success" | "canceled"
  /**
   * The small uppercase line above the heading. Defaults to the order-flow
   * copy this shell was born with; pages that are not about an order (the
   * newsletter landing) pass their own.
   */
  kicker?: string
  primary?: {
    href: string
    label: string
  }
  secondary?: {
    href: string
    label: string
  }
  children?: ReactNode
}

export default function OrderStateShell({
  eyebrow,
  title,
  accent,
  description,
  status = "success",
  kicker,
  primary,
  secondary,
  children,
}: OrderStateShellProps) {
  return (
    <main className={s.root} data-status={status}>
      <div className={s.header}>
        <span>{eyebrow}</span>
        <span>Keramická zahrada</span>
      </div>

      {/*
        Dvě podoby téhož rozvržení, podle toho, jestli stránka něco nabízí.

        **Bez ovládacích prvků** (hotová objednávka, zrušená platba) je to
        oznámení: dekorativní značka vlevo, text vpravo. Nic jiného tu není
        a široká půlka pro ni je v pořádku.

        **S ovládacími prvky** (úprava objednávky, reklamace) to přestává
        platit. Formulář se vykresloval uvnitř textového sloupce, takže všechno
        — nadpis, odstavec, výběr výdejny i tlačítka — se mačkalo do pravé
        poloviny, zatímco levá držela kroužek. Prvky, se kterými se pracuje,
        proto dostanou tu širokou stranu a text ustoupí vedle. Značka
        v té podobě mizí: pod formulářem by byla jen šum.
      */}
      <section className={s.content} data-panels={children ? "ano" : "ne"}>
        {!children && (
          <div className={s.mark} aria-hidden="true">
            <span />
            <span />
            <span />
            <strong>{status === "pending" ? "…" : status === "success" ? "✓" : "×"}</strong>
          </div>
        )}

        <div className={s.copy}>
          <p className={s.kicker}>
            {kicker ??
              (status === "pending"
                ? "Objednávku právě dokončujeme"
                : status === "success"
                  ? "Objednávku máme"
                  : "Objednávka se nedokončila")}
          </p>
          <h1>
            {title}
            {accent && <em>{accent}</em>}
          </h1>
          <p className={s.description}>{description}</p>

          {(primary || secondary) && (
            <div className={s.actions}>
              {primary && (
                <LocalizedClientLink className={s.primary} href={primary.href}>
                  <span>{primary.label}</span>
                  <i aria-hidden="true">↗</i>
                </LocalizedClientLink>
              )}
              {secondary && (
                <LocalizedClientLink className={s.secondary} href={secondary.href}>
                  {secondary.label}
                </LocalizedClientLink>
              )}
            </div>
          )}
        </div>

        {/* Až za textem v DOM, ale nalevo od něj v mřížce. Na úzké obrazovce,
            kde se to skládá pod sebe, je pořadí „nejdřív o co jde, pak co
            vyplnit" to správné — a odečítač obrazovky čte DOM, ne mřížku. */}
        {children && <div className={s.panels}>{children}</div>}
      </section>

      <div className={s.footer}>
        <span>Bezpečná platba</span>
        <span>Ozveme se osobně</span>
        <span>Ateliér · Písek</span>
      </div>
    </main>
  )
}
