"use client"

import Intro, { type KurzyIntroData } from "./Intro"

export default function Kurzy({ introData }: { introData?: KurzyIntroData }) {
  return (
    <main className="kurzy">
      <Intro data={introData} />
    </main>
  )
}
