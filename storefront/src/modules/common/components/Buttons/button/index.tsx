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

const t = {
  duration: 0.75,
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
                    <motion.div className={styles.el} style={{ perspective: 800 }}>
                        <PerspectiveIcon icon1={icon1} icon2={icon2} alt={alt} />
                    </motion.div>
                    <motion.div className={styles.el} style={{ perspective: 800 }}>
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
                <motion.div className={styles.el} style={{ perspective: 800 }}>
                    <PerspectiveText label={title} color="var(--blackText)" />
                </motion.div>
                <motion.div className={styles.el} style={{ perspective: 800 }}>
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
                <motion.div className={styles.el} style={{ perspective: 800 }}>
                    <PerspectiveText label={title} color="var(--blackText)" />
                </motion.div>
                <motion.div className={styles.el} style={{ perspective: 800 }}>
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
      style={{ transformStyle: "preserve-3d" }}
    >
      <motion.p variants={frontText} style={{ color }}>
        {label}
      </motion.p>
      <motion.p
        variants={backText}
        style={{
          color: "var(--whiteText)",
          position: "absolute",
          transformOrigin: "bottom center",
          transform: "rotateX(-90deg) translateY(12px)",
        }}
      >
        {label}
        <span>
            <ArrowRight size={15} color="white"/>
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
  return (
    <motion.div
      className={styles.PerspectiveIcon}
      variants={textWrap}
      style={{ transformStyle: "preserve-3d" }}
    >
      <motion.div variants={frontText} className={styles.image__wrapper}>
        <Image src={icon1} alt={alt} width={50} height={25} />
      </motion.div>
      <motion.div
        variants={backText}
        style={{
          color: "var(--whiteText)",
          position: "absolute",
          transformOrigin: "bottom center",
          transform: "rotateX(-90deg) translateY(12px)",
        }}
      >
        <Image src={icon2} alt={alt} width={40} height={20}  />
      </motion.div>
    </motion.div>
  )
}
function PerspectiveImage({img, alt}: {img: string, alt: string}) {
    return (
        <div className={styles.perspectiveImage}>
            <div className={styles.img__wrapper}>
                <Image src={img} alt={alt} fill style={{objectFit: 'cover'}}/>
                <div className={styles.overlay}/>
            </div>
        </div>
    )
}
