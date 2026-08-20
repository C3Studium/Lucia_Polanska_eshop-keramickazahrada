"use client"

import { useCallback, useRef, useState } from "react"

import type { CourseTerm } from "@lib/data/courses"
import Rezervace from "@modules/kurzy/Rezervace"
import RezervaceModal from "@modules/kurzy/RezervaceModal"

import Intro, { type KurzyIntroData } from "./Intro"

/**
 * The kurzy page: the pinned timeline, the reservation teaser, and — over
 * both — the reservation modal. „Vybrat termín" (in the timeline's third
 * audience block and in the teaser) opens it; whoever opened it gets their
 * focus back when it closes, the ContactDialog contract.
 */
export default function Kurzy({
  introData,
  terms,
}: {
  introData?: KurzyIntroData
  terms: CourseTerm[]
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const triggerRef = useRef<HTMLElement | null>(null)

  const openModal = useCallback(() => {
    triggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    setModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setModalOpen(false)
    triggerRef.current?.focus()
  }, [])

  return (
    <main className="kurzy">
      <Intro data={introData} onReserveAction={openModal} />
      <Rezervace terms={terms} onReserveAction={openModal} />
      <RezervaceModal
        open={modalOpen}
        onCloseAction={closeModal}
        initialTerms={terms}
      />
    </main>
  )
}
