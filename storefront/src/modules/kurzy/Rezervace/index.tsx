"use client"

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
}

export default function Rezervace({ terms, onReserveAction }: Props) {
  const nearest = terms.slice(0, TEASER_COUNT)

  return (
    <section className="kurzyRezervace" id="rezervace" data-scroll-section>
      <header className="kurzyRezervace__head">
        <span>03 · Rezervace</span>
        <h2>
          Vyberte si termín.
          <em>Místo je vaše.</em>
        </h2>
        <p>
          Vypsané kurzy pro jednotlivce, dvojice i malé skupiny. Zaplatit
          můžete předem kartou, nebo až na místě.
        </p>
      </header>

      {terms.length === 0 ? (
        <div className="kurzyRezervace__empty">
          <h3>Právě nejsou vypsané žádné termíny.</h3>
          <p>
            Napište mi a dám vám vědět, jakmile vypíšu další — nebo se
            domluvíme na termínu jen pro vaši skupinu.
          </p>
          <ContactTrigger
            text="Dejte mi vědět"
            topic="Kurzy"
            className="kurzyRezervaceCtaButton"
          />
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
            >
              Vybrat termín <i aria-hidden="true">↗</i>
            </button>
            <p>
              {terms.length > TEASER_COUNT
                ? `Všech ${terms.length} termínů s kalendářem, volnými místy a rezervací zabere minutu.`
                : "Rezervace s kalendářem a volnými místy zabere minutu."}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
