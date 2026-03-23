"use client";
import { HorizontalItem, VerticalItem } from "./item";
import { useMemo, useRef } from "react";
import { useScroll, motion, useSpring, useTransform, type MotionValue } from "framer-motion";

const collections = [
    {
        id: 1,
        title: "Nové kolekce",
        description: "Objevte naše nejnovější kolekce, které přinášejí svěží design a inovativní produkty pro váš domov.",
        image: "/assets/img/flowerphoto.png",
        href: "/collections/1",
        item: VerticalItem
    },
    {
        id: 2,
        title: "Nejprodávanější",
        description: "Prohlédněte si naše nejprodávanější produkty, které si zákazníci zamilovali pro jejich kvalitu a styl.",
        image: "/assets/img/bearphoto.png",
        href: "/collections/2",
        item: HorizontalItem
    },
    {
        id: 3,
        title: "Limitované edice",
        description: "Nenechte si ujít naše limitované edice, které nabízejí exkluzivní designy a unikátní produkty pro váš domov.",
        image: "/assets/img/bearphoto.png",
        href: "/collections/3",
        item: HorizontalItem
    },
    {
        id: 4,
        title: "Dárkové sady",
        description: "Objevte naše dárkové sady, které jsou perfektním dárkem pro vaše blízké a přinášejí radost a styl do každého domova.",
        image: "/assets/img/flowerphoto.png",
        href: "/collections/4",
        item: VerticalItem
    },
    {
        id: 5,
        title: "Kolekce pro venkovní prostory",
        description: "Prohlédněte si naši kolekci pro venkovní prostory, která nabízí odolné a stylové produkty pro vaši zahradu a terasu.",
        image: "/assets/img/bearphoto.png",
        href: "/collections/5",
        item: HorizontalItem
    },
    {
        id: 6,
        title: "Kolekce pro interiéry",
        description: "Prohlédněte si naši kolekci pro interiéry, která nabízí elegantní a stylové produkty pro vaše domácnosti.",
        image: "/assets/img/bearphoto.png",
        href: "/collections/6",
        item: HorizontalItem
    },
]
// najít způsob jak správně lokalizovat kolekce, tak aby byly správně za sebou s jejich obrázky, ty se asi budou muset přidat. 
// Nejdříve sem vrazit kolekce, potom zjisit kde jaká je, potom doplnit obrázkem a textem. 

const springConfig = {
  stiffness: 92,
  damping: 24,
  mass: 0.7,
}

const deterministicRandom = (seed: number) => {
  const x = Math.sin(seed * 999.91) * 10000
  return x - Math.floor(x)
}

type CollectionType = (typeof collections)[number]
type SpreadConfig = {
  startX: number
  midX: number
  endX: number
  startY: number
  endY: number
  startRotate: number
}

function CollectionCardMotion({
  collection,
  spread,
  progress,
  index,
  total,
}: {
  collection: CollectionType
  spread: SpreadConfig
  progress: MotionValue<number>
  index: number
  total: number
}) {
  const segment = 1 / total
  const overlap = segment * 0.38
  const start = Math.max(0, index * segment - overlap)
  const end = Math.min(1, (index + 1) * segment + overlap)

  // Local timeline per item, with overlap to avoid "one-by-one" robotic pacing.
  const localProgress = useTransform(progress, [start, end], [0, 1])

  const xRaw = useTransform(localProgress, [0, 0.75, 1], [spread.startX, spread.midX, 0])
  const yRaw = useTransform(localProgress, [0, 0.85, 1], [spread.startY, spread.endY, 0])
  const rotateRaw = useTransform(localProgress, [0, 0.7, 1], [spread.startRotate, spread.startRotate * 0.2, 0])
  const scaleRaw = useTransform(localProgress, [0, 0.2, 1], [0.93, 0.975, 1])
  const opacityRaw = useTransform(localProgress, [0, 0.2, 1], [0.72, 0.96, 1])

  const x = useSpring(xRaw, springConfig)
  const y = useSpring(yRaw, springConfig)
  const rotate = useSpring(rotateRaw, { stiffness: 82, damping: 21, mass: 0.75 })
  const scale = useSpring(scaleRaw, { stiffness: 88, damping: 22, mass: 0.75 })
  const opacity = useSpring(opacityRaw, { stiffness: 95, damping: 26, mass: 0.7 })

  return (
    <motion.div className="collection__cardMotion" style={{ x, y, rotate, scale, opacity }}>
      <collection.item collection={collection} />
    </motion.div>
  )
}

export default function Collections() {
    const ref = useRef(null)
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start 0.6", "end end"]
    })

    const xRaw = useTransform(scrollYProgress, [0, 1], ["38%", "-38%"])
    const yRaw = useTransform(scrollYProgress, [0, 1], ["7%", "-5%"])
    const wrapperScaleRaw = useTransform(scrollYProgress, [0, 0.25, 1], [0.97, 1, 1.015])
    const headerYRaw = useTransform(scrollYProgress, [0, 1], ["0%", "8%"])

    const x = useSpring(xRaw, springConfig)
    const y = useSpring(yRaw, springConfig)
    const wrapperScale = useSpring(wrapperScaleRaw, { stiffness: 95, damping: 24, mass: 0.7 })
    const headerY = useSpring(headerYRaw, { stiffness: 85, damping: 24, mass: 0.7 })

    const itemSpread = useMemo(
      () =>
        collections.map((collection, index) => {
          const side = index % 2 === 0 ? -1 : 1
          const spread = deterministicRandom(collection.id + index * 2.13)
          const depth = deterministicRandom(collection.id * 1.77 + index * 0.39)

          return {
            startX: side * (45 + spread * 80),
            midX: side * (16 + spread * 18),
            endX: side * (2 + spread * 4),
            startY: (depth - 0.5) * 50,
            endY: (depth - 0.5) * 14,
            startRotate: side * (1.5 + spread * 2.4),
          }
        }),
      []
    )

    return (
        <section className="Collections" ref={ref}>
            <div className="sticky">
                <motion.div className="sticky__Wrapper" style={{ y, scale: wrapperScale }}>
                    <motion.div className="header" style={{ y: headerY }}>
                        <p>
                            100% RUČNÍ PRACÍ NENÍ MOŽNÉ <br /> DOSÁHNOUT DVAKRÁT STEJNÉHO <br />VZHLEDU. ALE PRÁVĚ PROTO <br />JE KAŽDÝ KUS ORIGINÁL.
                        </p>
                    </motion.div>
                    <motion.div className="Collecion__wrapper" style={{ x }}>
                        {collections.map((collection, index) => (
                            <CollectionCardMotion
                                key={collection.id}
                                collection={collection}
                                progress={scrollYProgress}
                                index={index}
                                total={collections.length}
                                spread={itemSpread[index] ?? itemSpread[0]}
                            />
                        ))}
                    </motion.div>
                </motion.div>
            </div>
        </section>
    )
}
