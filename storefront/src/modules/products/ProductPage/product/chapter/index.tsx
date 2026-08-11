"use client"

import WebButton from "@modules/common/components/Buttons/webButton"
import { motion } from "framer-motion"
import Image from "next/image"

export default function ProductChapter() {
  return (
    <section
      className="productChapter"
      id="product-craft"
      data-scroll-section
      data-scroll-label="Výroba"
      aria-label="Jak keramika vzniká"
    >
      <div className="product__chapterEnd">
        <motion.aside
          className="product__chapterCta"
          initial={initial}
          whileInView={whileInView}
          viewport={viewport}
          transition={transition}
        >
          <div className="product__chapterVisualHeader">
            <span>02 · Jak to vzniká</span>
            <i />
            <span>7 kroků</span>
          </div>

          <div className="product__chapterPreview" aria-hidden="true">
            <motion.figure
              className="product__chapterPreviewMain"
              initial={{ clipPath: "inset(8% 0 8% 0)" }}
              whileInView={{ clipPath: "inset(0% 0 0% 0)" }}
              viewport={viewport2}
              transition={transition2}
            >
              <Image
                src="/assets/img/vyroba/5.png"
                alt=""
                fill
                sizes="(max-width: 900px) 88vw, 32vw"
                className="product__chapterPreviewImage"
              />
              <figcaption>Ruce · materiál · čas</figcaption>
            </motion.figure>

            <motion.figure
              className="product__chapterPreviewDetail"
              initial={initial2}
              whileInView={whileInView2}
              viewport={viewport3}
              transition={transition3}
            >
              <Image
                src="/assets/img/vyroba/1.png"
                alt=""
                fill
                sizes="(max-width: 900px) 34vw, 12vw"
                className="product__chapterPreviewImage"
              />
              <span>01</span>
            </motion.figure>
          </div>

          <div className="product__chapterAction">
            <p>Od prvního nápadu až po poslední výpal.</p>
            <WebButton
              Kind="Link"
              href="/vyroba"
              title="Objevit proces"
              className="product__chapterButton"
            />
          </div>
        </motion.aside>

        <motion.p
          initial={initial3}
          whileInView={whileInView}
          viewport={viewport4}
          transition={transition4}
        >
          Dělám to pomalu.
          <em> Aby vám to dlouho vydrželo.</em>
        </motion.p>
      </div>
    </section>
  )
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const initial = { opacity: 0, y: 28 }
const whileInView = { opacity: 1, y: 0 }
const viewport = { once: true, amount: 0.3 }
const transition = { duration: 0.9, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }
const viewport2 = { once: true, amount: 0.35 }
const transition2 = {
                duration: 1.1,
                delay: 0.08,
                ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
              }
const initial2 = { opacity: 0, x: 22 }
const whileInView2 = { opacity: 1, x: 0 }
const viewport3 = { once: true, amount: 0.5 }
const transition3 = {
                duration: 0.85,
                delay: 0.28,
                ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
              }
const initial3 = { opacity: 0, y: 24 }
const viewport4 = { once: true, amount: 0.55 }
const transition4 = {
            duration: 0.85,
            delay: 0.18,
            ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
          }
