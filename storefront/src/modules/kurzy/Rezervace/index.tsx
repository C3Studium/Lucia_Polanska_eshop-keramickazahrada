"use client"

import { editable } from "@c3studium/valecms/edit"
import { useEditRerender } from "@lib/hooks/use-edit-rerender"
import type { CopyBlock } from "@lib/util/site-copy"
import type { CourseTerm } from "@lib/data/courses"
import ContactTrigger from "@modules/layout/ContactDialog/trigger"

import { czk, formatDuration, formatPrague, seatsLabel } from "../format"

/**
 * The reservation teaser for „Pro zájemce" — the compact section the modal
 * grew out of.
 *
 * The booking itself now lives in the reservation modal (RezervaceModal, with
 * the calendar and the three-step stepper); this section stays on the page as
 * the server-rendered landing spot: the SEO copy, the nearest three upcoming
 * terms as read-only cards, and one „Vybrat termín" button that opens the
 * modal. The `#rezervace` deep link still scrolls here.
 */

const TEASER_COUNT = 3

type Props = {
  terms: CourseTerm[]
  /** Opens the reservation modal. */
  onReserveAction: () => void
  /** Blok `kurzy.rezervace` — texty kolem termínů; termíny samy jsou z Medusy. */
  block?: CopyBlock
}

export default function Rezervace({ terms, onReserveAction, block }: Props) {
  /* Sekce sama o sobě nemá důvod k překreslení — bez tohohle by po zapnutí
     režimu editace zůstaly anotace prázdné. Viz hook. */
  useEditRerender()

  const nearest = terms.slice(0, TEASER_COUNT)

  const eyebrow = block?.accent?.[0]?.trim() || "03 · Rezervace"
  const titleLead = block?.title?.trim() || "Vyberte si termín."
  const titleAccent = block?.headline?.trim() || "Místo je vaše."
  const lede =
    block?.bodyText?.trim() ||
    "Vypsané kurzy pro jednotlivce, dvojice i malé skupiny. Zaplatit můžete předem kartou, nebo až na místě."
  const ctaText = block?.accent?.[1]?.trim() || "Vybrat termín"
  const teaserNote =
    block?.accent?.[2]?.trim() ||
    "Rezervace s kalendářem a volnými místy zabere minutu."
  const emptyTitle =
    block?.accent?.[3]?.trim() || "Právě nejsou vypsané žádné termíny."
  const emptyText =
    block?.accent?.[4]?.trim() ||
    "Napište mi a dám vám vědět, jakmile vypíšu další — nebo se domluvíme na termínu jen pro vaši skupinu."
  const emptyCta = block?.accent?.[5]?.trim() || "Dejte mi vědět"

  return (
    <section className="kurzyRezervace" id="rezervace" data-scroll-section>
      <header className="kurzyRezervace__head">
        <span {...editable(block, "accent.0")}>{eyebrow}</span>
        {/* Obě půlky vlastní pole — `editable` píše celé pole naráz. */}
        <h2>
          <span {...editable(block, "title")}>{titleLead}</span>
          <em {...editable(block, "headline")}>{titleAccent}</em>
        </h2>
        <p {...editable(block, "body")}>{lede}</p>
      </header>

      {terms.length === 0 ? (
        <div className="kurzyRezervace__empty">
          <h3 {...editable(block, "accent.3")}>{emptyTitle}</h3>
          <p {...editable(block, "accent.4")}>{emptyText}</p>
          <span {...editable(block, "accent.5")}>
            <ContactTrigger
              text={emptyCta}
              topic="Kurzy"
              className="kurzyRezervaceCtaButton"
            />
          </span>
        </div>
      ) : (
        <div className="kurzyRezervace__teaser">
          <ul className="kurzyRezervace__teaserList" aria-label="Nejbližší termíny">
            {nearest.map((term) => (
              <li key={term.id} className="kurzyRezervace__term kurzyRezervace__term--static">
                <span className="kurzyRezervace__termDate">
                  {formatPrague(term.starts_at)}
                </span>
                <strong>{term.title}</strong>
                <span className="kurzyRezervace__termMeta">
                  {term.location}
                  {term.duration_minutes
                    ? ` · ${formatDuration(term.duration_minutes)}`
                    : ""}
                </span>
                <span className="kurzyRezervace__termPrices">
                  {czk(term.price_single)} za jednoho
                  {term.price_two != null
                    ? ` · ${czk(term.price_two)}/os. za dva`
                    : ""}
                  {term.group_min != null && term.price_group_per_person != null
                    ? ` · od ${term.group_min} lidí ${czk(term.price_group_per_person)}/os.`
                    : ""}
                </span>
                <span
                  className={`kurzyRezervace__termSeats${
                    term.sold_out ? " is-full" : ""
                  }`}
                >
                  {term.sold_out
                    ? "obsazeno · dáme vědět, až se uvolní"
                    : seatsLabel(term.seats_left)}
                </span>
              </li>
            ))}
          </ul>

          <div className="kurzyRezervace__teaserAction">
            <button
              type="button"
              className="kurzyRezervace__teaserButton"
              onClick={onReserveAction}
              {...editable(block, "accent.1")}
            >
              {ctaText} <i aria-hidden="true">↗</i>
            </button>
            {/* Varianta s počtem termínů se skládá z čísla, které zná jen Medusa —
                ta zůstává v kódu; editovatelná je věta bez počtu. */}
            <p {...editable(block, "accent.2")}>
              {terms.length > TEASER_COUNT
                ? `Všech ${terms.length} termínů s kalendářem, volnými místy a rezervací zabere minutu.`
                : teaserNote}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
