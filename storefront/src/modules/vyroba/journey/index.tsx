import type { CopyBlock } from "@lib/util/site-copy"
import Gallery from "@modules/vyroba/gallery"
import MainVyroba from "@modules/vyroba/main"

export default function VyrobaJourney({
  block,
  texts,
  hero,
}: {
  /** `vyroba.galerie` — sedm fotek postupu, v pořadí kroků. */
  block?: CopyBlock
  /** `vyroba.kroky` — jejich nadpisy a odstavce. */
  texts?: CopyBlock
  /** `vyroba.hero` — texty a fotky úvodní scény. */
  hero?: CopyBlock
}) {
  return (
    <div className="vyrobaJourney">
      <MainVyroba block={hero} texts={texts} galerie={block} />
      <Gallery block={block} texts={texts} />
    </div>
  )
}
