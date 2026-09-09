"use client"
import { Easing, motion } from 'framer-motion';
import styles from './styles.module.scss';
import LocalizedClientLink from '@modules/common/components/localized-client-link';
import Image from 'next/image';
import { useState } from 'react';
import ArrowRight from '@modules/common/icons/arrow-right';

type NavButton = {
    title?: string;
    href?: string;
    img?: string;
    alt?: string;
    icon1?: string | undefined;
    icon2?: string | undefined;
    Kind: "Link" | "Button"
    onClickAction?: () => void
    onTagAction?: (payload: { input: string; state: boolean }) => void
    className?: string
    index?: number
    isActive?: boolean
    animationKey?: number
    onActiveChange?: (index: number | null) => void
}

/* A hover flip at 750ms is still turning over well after the pointer has arrived. 420ms keeps
   the same curve and reads as deliberate rather than slow (spec 8.2: 150-350ms for feedback,
   with a little more allowed for a 3D flip that travels further). */
const t = {
  duration: 0.42,
  ease: [0.76, 0, 0.24, 1] as Easing,
}

const textWrap = {
  rest: { rotateX: 0, transition: t },
  active: { rotateX: 90, transition: t },
}

const frontText = {
  rest: { y: "0%", opacity: 1, transition: t },
  active: { y: "-100%", opacity: 0, transition: t },
}

const backText = {
  rest: { opacity: 0, transition: t  },
  active: { opacity: 1, transition: t },
}

/*
 * Táž varianta pro POPISEK, jen s dojezdem do strany.
 *
 * Zadní strana nese navíc šipku, takže vystředěná dvojice popisek + šipka
 * sedí o její polovinu vlevo proti přednímu popisku — naměřeno −7.1px na
 * 1440. Obě strany se přitom jen prolnou, každá na své pozici, takže text
 * při překlopení skočí do strany. To je ten posun, co je vidět.
 *
 * Odsazení zleva o šířku šipky včetně mezery drží popisek na startu tam, kde
 * stál vepředu, a prolnutí ho během týchž 420 ms doveze na místo. V rem, ne
 * v px: nad 1921 roste s rampou stejně jako šipka (0.75rem) a mezera mezi
 * nimi (0.25rem) v Navbar/style.scss. Klidová hodnota 0.25rem je odsazení,
 * které tomu odstavci dává tentýž stylopis.
 *
 * Ikona (PerspectiveIcon) si bere `backText` beze změny — šipku nemá a
 * dojezd by ji jen odsunul.
 */
const backTextLabel = {
  rest: { opacity: 0, paddingLeft: "1.25rem", transition: t },
  active: { opacity: 1, paddingLeft: "0.25rem", transition: t },
}

export default function Button({title, href, img = "/assets/links/home_img.png", alt = 'bg__image', icon1, icon2, Kind, onClickAction, onTagAction, className, index, isActive = false, animationKey = 0, onActiveChange}: NavButton) {
    const [isTagActive, setIsTagActive] = useState<boolean>(false)
    const isControlled = index !== undefined && onActiveChange !== undefined

    const handleMouseEnter = () => onActiveChange?.(index ?? null)
    const handleMouseLeave = () => onActiveChange?.(null)

    const handleButtonClick = () => {
        if (Kind === "Button" && onTagAction && title) {
            const nextState = !isTagActive
            setIsTagActive(nextState)
            onTagAction({ input: title, state: nextState })
        }
        onClickAction?.()
    }
    
    const buttonAnim = {
        rest: {
            y: '100%',
            opacity: 1,
            transition: {
                delay: 0.1,
                duration: 0.35,
                ease: [ 0.910, 0.075, 0.250, 0.960 ] as Easing
            }
        },
        active: {
            y: '0%',
            opacity: 1,
            transition: {
                delay: 0.15,
                duration: 0.35,
                ease: [ 0.910, 0.075, 0.250, 0.960 ] as Easing
            }
        }
    }

    if(icon1) {
       return( 
            <LocalizedClientLink className={`${styles.buttonIcon} ${className ?? ""}`} href={href ?? "/"} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
                <motion.div 
                    key={animationKey}
                    className={styles.slider}
                    initial="rest"
                    animate={isActive ? "active" : "rest"}
                    whileHover={isControlled ? undefined : "active"}
                >
                    <motion.div className={styles.imgWrapper}
                        variants={buttonAnim} 
                        // this will be same animationas the perspective text but slighly skewed so its looks bit different but still connected to the perspective text
                    >
                        <PerspectiveImage img={img} alt={"bg__img"}/>
                    </motion.div>
                    <motion.div className={styles.el} style={styleObj}>
                        <PerspectiveIcon icon1={icon1} icon2={icon2} alt={alt} />
                    </motion.div>
                    <motion.div className={styles.el} style={styleObj}>
                        <PerspectiveIcon icon1={icon1} icon2={icon2} alt={alt} />
                    </motion.div>
                </motion.div>
            </LocalizedClientLink> 
       )
    }
  return (
    <>
    { Kind === "Link" ? (
        <LocalizedClientLink className={`${styles.button} ${className}`} href={href ?? "/"} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
            <motion.div 
                key={animationKey}
                className={styles.slider}
                initial="rest"
                animate={isActive ? "active" : "rest"}
                whileHover={isControlled ? undefined : "active"}
            >
                <motion.div className={styles.imgWrapper}
                    variants={buttonAnim} 
                    // this will be same animationas the perspective text but slighly skewed so its looks bit different but still connected to the perspective text
                >
                    <PerspectiveImage img={img} alt={"bg__img"}/>
                </motion.div>
                <motion.div className={styles.el} style={styleObj}>
                    <PerspectiveText label={title} color="var(--blackText)" />
                </motion.div>
                <motion.div className={styles.el} style={styleObj}>
                    <PerspectiveText label={title} color="var(--whiteText)" />
                </motion.div>
            </motion.div>
        </LocalizedClientLink>
    ):
    (
        <button className={`${styles.button} ${className}`} onClick={handleButtonClick} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
            <motion.div 
                key={animationKey}
                className={styles.slider}
                initial="rest"
                animate={isActive ? "active" : "rest"}
                whileHover={isControlled ? undefined : "active"}
            >
                <motion.div className={styles.imgWrapper}
                    variants={buttonAnim} 
                    // this will be same animationas the perspective text but slighly skewed so its looks bit different but still connected to the perspective text
                >
                    <PerspectiveImage img={img} alt={"bg__img"}/>
                </motion.div>
                <motion.div className={styles.el} style={styleObj}>
                    <PerspectiveText label={title} color="var(--blackText)" />
                </motion.div>
                <motion.div className={styles.el} style={styleObj}>
                <PerspectiveText label={title} color="var(--whiteText)" />
                </motion.div>
            </motion.div>
        </button>
    )}
    </>
  )
}

function PerspectiveText({
  label,
  color,
}: {
  label?: string
  color: string
}) {
  return (
    <motion.div
      className={styles.perspectiveText}
      variants={textWrap}
      style={styleObj2}
    >
      <motion.p variants={frontText} style={{ color }}>
        {label}
      </motion.p>
      <motion.p variants={backTextLabel} style={backFace}>
        {label}
        <span>
            <ArrowRight size={15} color="var(--whiteText)"/>
        </span>
      </motion.p>
    </motion.div>
  )
}

function PerspectiveIcon({
  icon1, 
  icon2,
  alt,
}: {
  icon1: string | undefined
  icon2: string | undefined
  alt: string
}) {
  if (!icon1 || !icon2) {
    return null
  }

  return (
    <motion.div
      className={styles.PerspectiveIcon}
      variants={textWrap}
      style={styleObj2}
    >
      <motion.div variants={frontText} className={styles.image__wrapper}>
        <Image src={icon1} alt={alt} width={50} height={25} />
      </motion.div>
      <motion.div variants={backText} style={backFace}>
        <Image src={icon2} alt={alt} width={40} height={20}  />
      </motion.div>
    </motion.div>
  )
}
function PerspectiveImage({img, alt}: {img: string, alt: string}) {
    return (
        <div className={styles.perspectiveImage}>
            <div className={styles.img__wrapper}>
                <Image src={img} alt={alt} fill style={styleObj3}/>
                <div className={styles.overlay}/>
            </div>
        </div>
    )
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */

/* Geometrie překlopení — jedno místo pro obě zadní stěny. Odvozená od výšky tlačítka,
   perspektiva = 20x výška (800px u staré pevné výšky 40px) -> clamp(45rem, 74vh, 60rem).

   Hloubka se ale ČTE ze `--flip-depth` (styles.module.scss) a váže se na PÍSMO, ne na
   výšku tlačítka. Byl tu `clamp(0.675rem, 1.11vh, 0.9rem)`, dopočítaný jako 0.3x výška
   z téhož stylopisu — jenže Navbar tlačítkům výšku přebíjí svým `--nav-control-height`,
   což je jiný clamp. Na 1280 a 1440 vycházely obě shodou okolností stejně, na 1920 už
   ne: tlačítko 38.9px, hloubka 11.99 místo potřebných 11, a zadní popisek dosedl o 1px
   POD přední. Na výšce tlačítka to ale nestojí ani po opravě: měřením přes 36 až 51.8px
   vyšlo, že rozhoduje výška řádku, a 0.78em drží popisek na středu na všech. */
const FLIP_DEPTH = "var(--flip-depth, 0.78em)"
const styleObj = { perspective: "clamp(45rem, 74vh, 60rem)" }
const styleObj2 = { transformStyle: "preserve-3d" as const }
const styleObj3 = {objectFit: 'cover' as const}
const backFace = {
  color: "var(--whiteText)",
  position: "absolute" as const,
  transformOrigin: "bottom center",
  transform: `rotateX(-90deg) translateY(${FLIP_DEPTH})`,
}
