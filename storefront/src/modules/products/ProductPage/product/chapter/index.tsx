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
      aria-label="Zkušenost s objektem"
    >
      <div className="product__chapterEnd">
        <motion.aside
          className="product__chapterCta"
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="product__chapterVisualHeader">
            <span>02 · Jak vzniká objekt</span>
            <i />
            <span>7 kroků</span>
          </div>

          <div className="product__chapterPreview" aria-hidden="true">
            <motion.figure
              className="product__chapterPreviewMain"
              initial={{ clipPath: "inset(8% 0 8% 0)" }}
              whileInView={{ clipPath: "inset(0% 0 0% 0)" }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{
                duration: 1.1,
                delay: 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
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
              initial={{ opacity: 0, x: 22 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{
                duration: 0.85,
                delay: 0.28,
                ease: [0.22, 1, 0.36, 1],
              }}
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
            <p>Od první myšlenky až po poslední výpal.</p>
            <WebButton
              Kind="Link"
              href="/vyroba"
              title="Objevit proces"
              className="product__chapterButton"
            />
          </div>
        </motion.aside>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.55 }}
          transition={{
            duration: 0.85,
            delay: 0.18,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          Vyrobeno pomalu.
          <em> Aby zůstalo dlouho.</em>
        </motion.p>
      </div>
    </section>
  )
}
