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

      <section className={s.content}>
        <div className={s.mark} aria-hidden="true">
          <span />
          <span />
          <span />
          <strong>{status === "pending" ? "…" : status === "success" ? "✓" : "×"}</strong>
        </div>

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

          {children}

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
      </section>

      <div className={s.footer}>
        <span>Bezpečná platba</span>
        <span>Ozveme se osobně</span>
        <span>Ateliér · Písek</span>
      </div>
    </main>
  )
}
