"use client"
import { AnimationControls, Easing, motion, useAnimationControls } from 'framer-motion';
import styles from './styles.module.scss';
import LocalizedClientLink from '@modules/common/components/localized-client-link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import ArrowRight from '@modules/common/icons/arrow-right';
import { usePathname } from 'next/navigation';

type NavButton = {
    title?: string;
    href?: string;
    img?: string;
    alt?: string;
    icon1?: string | undefined;
    icon2?: string | undefined;
    Kind: "Link" | "Button" | "Submit"
    onClickAction?: () => void
    onTagAction?: (payload: { input: string; state: boolean }) => void
    className?: string
}

const t = {
  duration: 0.75,
  ease: [0.76, 0, 0.24, 1] as Easing,
}

const textWrap = {
  rest: { rotateX: 0, transition: t },
  flipped: { rotateX: 90, transition: t },
}

const frontText = {
  rest: { y: "0%", opacity: 1, transition: t },
  flipped: { y: "-100%", opacity: 0, transition: t },
}

const backText = {
  rest: { opacity: 0, transition: t  },
  flipped: { opacity: 1, transition: t },
}

export default function HashTagButton({title, href, img = "/assets/links/home_img.png", alt = 'bg__image', icon1, icon2, Kind, onClickAction, onTagAction, className}: NavButton) {
    const pathname = usePathname()
    const [isHovered, setIsHovered] = useState<boolean>(false)
    const [isTagActive, setIsTagActive] = useState<boolean>(false)
    const backTextControls = useAnimationControls()
    const backIconControls = useAnimationControls()
    const isPathActive = pathname === `/cz${href}`
    const isActive = isPathActive || isHovered

    useEffect(() => {
        backTextControls.set(isActive ? "flipped" : "rest")
        backIconControls.set(isActive ? "flipped" : "rest")
    }, [isActive, backTextControls, backIconControls])

    const replayBackLayer = async () => {
        backTextControls.set("rest")
        backIconControls.set("rest")
        await Promise.all([
            backTextControls.start("flipped"),
            backIconControls.start("flipped"),
        ])
    }

    const handleMouseEnter = async () => {
        setIsHovered(true)
        if (isPathActive) {
            await replayBackLayer()
        }
    }

    const handleMouseLeave = () => {
        setIsHovered(false)
    }

    const handleButtonClick = () => {
        if (Kind === "Button" && onTagAction && title) {
            const nextState = !isTagActive
            setIsTagActive(nextState)
            onTagAction({ input: title, state: nextState })
        }
        onClickAction?.()
    }
    
    const buttonAnim = {
        initial: {
            y: '100%',
            opacity: 0
        },
        enter: {
            y: '0%',
            opacity: 1,
            transition: {
                delay: 0.15,
                duration: 0.35,
                ease: [ 0.910, 0.075, 0.250, 0.960 ] as Easing
            }
        },
        exit: {
            y: '100%',
            opacity: 1,
            transition: {
                delay: 0.1,
                duration: 0.35,
                ease: [ 0.910, 0.075, 0.250, 0.960 ] as Easing
            }
        }
    }

  return (
    <>
    { Kind === "Link" ? (
        <LocalizedClientLink className={`${styles.button} ${className}`} href={href}>
            <motion.div 
                className={styles.slider}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <motion.div className={styles.imgWrapper}
                    variants={buttonAnim} 
                    initial="initial"
                    animate={ isActive ? "enter" : "exit"}
                    // this will be same animationas the perspective text but slighly skewed so its looks bit different but still connected to the perspective text
                >
                    <PerspectiveImage img={img} alt={"bg__img"}/>
                </motion.div>
                <motion.div className={styles.el} style={{ perspective: 800 }}>
                    <PerspectiveText label={title} active={isActive} color="var(--blackText)" backControls={backTextControls} />
                </motion.div>
                <motion.div className={styles.el} style={{ perspective: 800 }}>
                    <PerspectiveText label={title} active={isActive} color="var(--whiteText)" backControls={backTextControls} />
                </motion.div>
            </motion.div>
        </LocalizedClientLink>
    ):
    (
        <button className={`${styles.button} ${className}`} onClick={handleButtonClick}>
            <motion.div 
                className={styles.slider}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <motion.div className={styles.imgWrapper}
                    variants={buttonAnim} 
                    initial="initial"
                    animate={ isActive ? "enter" : "exit"}
                    // this will be same animationas the perspective text but slighly skewed so its looks bit different but still connected to the perspective text
                >
                    <PerspectiveImage img={img} alt={"bg__img"}/>
                </motion.div>
                <motion.div className={styles.el} style={{ perspective: 800 }}>
                    <PerspectiveText label={title} active={isActive} color="var(--blackText)" backControls={backTextControls} />
                </motion.div>
                <motion.div className={styles.el} style={{ perspective: 800 }}>
                <PerspectiveText label={title} active={isActive} color="var(--whiteText)" backControls={backTextControls} />
                </motion.div>
            </motion.div>
        </button>
    )}
    </>
  )
}

function PerspectiveText({
  label,
  active,
  color,
  backControls,
}: {
  label?: string
  active: boolean
  color: string
  backControls?: AnimationControls
}) {
  return (
    <motion.div
      className={styles.perspectiveText}
      variants={textWrap}
      initial="rest"
      animate={active ? "flipped" : "rest"}
      style={{ transformStyle: "preserve-3d" }}
    >
      <motion.p variants={frontText} style={{ color }}>
        {label}
      </motion.p>
      <motion.p
        variants={backText}
        initial="rest"
        animate={backControls ?? (active ? "flipped" : "rest")}
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
