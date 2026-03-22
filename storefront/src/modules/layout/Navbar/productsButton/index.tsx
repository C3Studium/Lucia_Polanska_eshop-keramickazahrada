"use client"

import { AnimatePresence, type AnimationControls, Easing, motion, useAnimationControls } from 'framer-motion';
import styles from './styles.module.scss';
import Image from 'next/image';
import LinkButton from '@modules/common/components/Buttons/LinkButton';
import LocalizedClientLink from '@modules/common/components/localized-client-link';
import Arrow from '@modules/common/icons/arrow';
import { useEffect, useState } from 'react';
import ArrowRight from '@modules/common/icons/arrow-right';
import LinkCat from './Link';
import { usePathname } from 'next/navigation';


const collections = [
    {
        id: 1,
        title: "Nové kolekce",
        description: "Objevte naše nejnovější kolekce, které přinášejí svěží design a inovativní produkty pro váš domov.",
        image: "/assets/img/flowerphoto.png",
        href: "/store",
        products: [
            {
                label: "Kategorie 1",
                index: 1
            },
            {
                label: "Kategorie 1",
                index: 2
            },
            {
                label: "Kategorie 1",
                index: 3
            },
            {
                label: "Kategorie 1",
                index: 4
            },
            {
                label: "Kategorie 1",
                index: 5
            }
        ]

    },
    {
        id: 2,
        title: "Nejprodávanější",
        description: "Prohlédněte si naše nejprodávanější produkty, které si zákazníci zamilovali pro jejich kvalitu a styl.",
        image: "/assets/img/bearphoto.png",
        href: "/store",
        products: [
            {
                label: "Kategorie 1",
                index: 1
            },
            {
                label: "Kategorie 1",
                index: 2
            },
            {
                label: "Kategorie 1",
                index: 3
            },
            {
                label: "Kategorie 1",
                index: 4
            },
            {
                label: "Kategorie 1",
                index: 5
            }
        ]
    },
    {
        id: 3,
        title: "Limitované edice",
        description: "Nenechte si ujít naše limitované edice, které nabízejí exkluzivní designy a unikátní produkty pro váš domov.",
        image: "/assets/img/bearphoto.png",
        href: "/store",
        products: [
            {
                label: "Kategorie 1",
                index: 1
            },
            {
                label: "Kategorie 1",
                index: 2
            },
            {
                label: "Kategorie 1",
                index: 3
            },
            {
                label: "Kategorie 1",
                index: 4
            },
            {
                label: "Kategorie 1",
                index: 5
            }
        ]
    },
    {
        id: 4,
        title: "Dárkové sady",
        description: "Objevte naše dárkové sady, které jsou perfektním dárkem pro vaše blízké a přinášejí radost a styl do každého domova.",
        image: "/assets/img/flowerphoto.png",
        href: "/store",
        products: [
            {
                label: "Kategorie 1",
                index: 1
            },
            {
                label: "Kategorie 1",
                index: 2
            },
            {
                label: "Kategorie 1",
                index: 3
            },
            {
                label: "Kategorie 1",
                index: 4
            },
            {
                label: "Kategorie 1",
                index: 5
            }
        ]
    },
    {
        id: 5,
        title: "Kolekce pro venkovní prostory",
        description: "Prohlédněte si naši kolekci pro venkovní prostory, která nabízí odolné a stylové produkty pro vaši zahradu a terasu.",
        image: "/assets/img/bearphoto.png",
        href: "/store",
        products: [
            {
                label: "Kategorie 1",
                index: 1
            },
            {
                label: "Kategorie 1",
                index: 2
            },
            {
                label: "Kategorie 1",
                index: 3
            },
            {
                label: "Kategorie 1",
                index: 4
            },
            {
                label: "Kategorie 1",
                index: 5
            }
        ]
    },
    {
        id: 6,
        title: "Kolekce pro interiéry",
        description: "Prohlédněte si naši kolekci pro interiéry, která nabízí elegantní a stylové produkty pro vaše domácnosti.",
        image: "/assets/img/bearphoto.png",
        href: "/store",
        products: [
            {
                label: "Kategorie 1",
                index: 1
            },
            {
                label: "Kategorie 1",
                index: 2
            },
            {
                label: "Kategorie 1",
                index: 3
            },
            {
                label: "Kategorie 1",
                index: 4
            },
            {
                label: "Kategorie 1",
                index: 5
            }
        ]
    },
]

const importantLinks = [
    {
        label: "Smluvní podmínky",
        href: "/smluvni-podminky"
    },
    {
        label: "Ochrana osobních údajů",
        href: "/ochrana-osobnich-udaju"
    },
    {
        label: "Obchodní podmínky",
        href: "/obchodni-podminky"
    },
    {
        label: "Odstoupení od smlouvy",
        href: "/odstoupeni_od_smlouvy"
    },
    {
        label: "Doprava a platba",
        href: "/doprava-a-platba"
    },
    {
        label: "Reklamační protokol",
        href: "/reklamacni-protokol"
    } 
]

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

export function ProductButton({ onClickAction, isActive }: {onClickAction: (next: boolean) => void, isActive: boolean}) {
  const pathname = usePathname();
  const [isHovered, setIsHovered] = useState(false);
  const backTextControls = useAnimationControls();
  const isPathActive = pathname === "/cz/store";
  const isButtonActive = isActive || isPathActive || isHovered;

  useEffect(() => {
    backTextControls.set(isButtonActive ? "flipped" : "rest");
  }, [isButtonActive, backTextControls]);

  const replayBackLayer = async () => {
    backTextControls.set("rest");
    await backTextControls.start("flipped");
  };

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
  const onClick = () => {
    if( isActive === true ) {
        onClickAction(false)
    }
  }

  const handleMouseEnter = async () => {
    setIsHovered(true);
    onClickAction(true);
    if (isPathActive) {
      await replayBackLayer();
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <div
        className={styles.button}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={onClick}
    >
        <motion.div 
            className={styles.slider}
        >
            <motion.div className={styles.imgWrapper}
                variants={buttonAnim} 
                initial="initial"
                animate={ isButtonActive ? "enter" : "exit"}
                // this will be same animationas the perspective text but slighly skewed so its looks bit different but still connected to the perspective text
            >
                <PerspectiveImage img={"/assets/links/home_img.png"} alt={"bg__img"}/>
            </motion.div>
            <motion.div className={styles.el} style={{ perspective: 800 }}>
                <PerspectiveText label="Produkty" active={isButtonActive} color="var(--blackText)" backControls={backTextControls} />
            </motion.div>
            <motion.div className={styles.el} style={{ perspective: 800 }}>
              <PerspectiveText label="Produkty" active={isButtonActive} color="var(--whiteText)" backControls={backTextControls} />
            </motion.div>
        </motion.div>
    </div>
  )
}

function PerspectiveText({
  label,
  active,
  color,
  backControls,
}: {
  label: string
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
        <span>
            <Arrow size={15}/>
        </span>
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

export function CollectionList ({ active, setActive } : { active: boolean, setActive: (next: boolean) => void}) {

    const childStagger = {
        hidden: {},
        show: (i: number = 0) => ({
            transition: {
                delayChildren: 0.1 * i,
                staggerChildren: 0.05,
            },
        }),
        exit: {
            transition: {
                staggerChildren: 0.06,
                staggerDirection: -1,
            },
        },
    };

    const childAnim = {
        hidden: {
            opacity: 0,
            y: -20,
        },
        show: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.35,
                ease: [0.76, 0, 0.24, 1] as Easing,
            },
        },
        exit: {
            opacity: 0,
            y: 12,
            transition: {
                duration: 0.25,
                ease: [0.76, 0, 0.24, 1] as Easing,
            },
        },
    };
    
    const currenTimeCET = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Prague",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(new Date());
    const currenTime = `${currenTimeCET} CET`
    const currentYear = new Date().getFullYear()

    const lines = Array.from(
        { length: Math.ceil(importantLinks.length / 2)},
        (_, i) => importantLinks.slice(i * 2, i * 2 + 2)
    )


    const ListAnim = {
        hidden: {
            height: 0,
            opacity: 0,
        },
        show: {
            height: "auto",
            opacity: 1,
            transition: {
                duration: 0.55,
                ease: [0.910, 0.075, 0.250, 0.960] as Easing
            }
        },
        exit: {
            height: 0,
            opacity: 0,
            transition: {
                delay: 0.2,
                duration: 0.5,
                ease: [0.910, 0.075, 0.250, 0.960] as Easing
            }
        }
    }
    return (
        <AnimatePresence initial={false}>
            { active && 
                <motion.div 
                    className={styles.Collection__List}
                    key="Collection__List-products"
                    variants={ListAnim}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    onMouseLeave={() => setActive(false)}
                    style={{ overflow: "hidden" }}
                >
                    <div className={styles.overlay} onMouseEnter={() => setActive(false)}/>
                    <motion.div className={styles.Collection__List__container} variants={childStagger} custom={0}>
                        <motion.div variants={childAnim} className={styles.navigations}>
                        </motion.div>
                        <motion.div className={styles.Collections___container} variants={childAnim}>
                            <motion.div className={styles.Collections__wrapper} variants={childStagger} custom={0.25}>
                                <div className={styles.rowLine} />
                                {collections.map((collection) => {
                                    const {id, title, description, image, href, products } = collection

                                    return(
                                        <motion.div variants={childAnim} key={id}>
                                            <CollectionItem
                                                id={id}
                                                description={description}
                                                title={title}
                                                image={image}
                                            href={href}
                                            products={products}
                                            setActive={setActive}
                                        />
                                    </motion.div>
                                ) 
                            })}
                            </motion.div>  
                        </motion.div>

                        <motion.div className={styles.Links__container} variants={childAnim}>
                            <motion.div className={styles.Links} variants={childStagger} custom={2}>
                                <div className={styles.rowLine} />
                                {lines.map((line, index) => (
                                    <motion.div className={styles.Links__line} key={`line-${index}`} variants={childAnim} custom={0.25}>
                                        {line.map((cat) => {
                                            const { label, href } = cat 
                                            return (
                                                <motion.div key={href} variants={childAnim}>
                                                    <LinkButton text={label} href={href} className={styles.ImportantLink}/>
                                                </motion.div>
                                            )
                                        })}
                                    </motion.div>
                                ))}
                            </motion.div>
                        </motion.div>

                        <motion.div className={styles.end__footer} variants={childAnim}>
                            <p>
                                Lucie Polanská - © {currentYear} všechna práva vyhrazena 
                            </p>
                            <p>
                                {currenTime}
                            </p>
                        </motion.div>
                    </motion.div>
                </motion.div>
            }
        </AnimatePresence>
        
    )
}

type CollectionItemProps = {
  id: number
  title: string
  description: string
  image: string
  href: string
  products: {
    label: string
    index: number
  }[]
  setActive: (next: boolean) => void
}


const CollectionItem = ({ title, id, href, products, image, description, setActive}: CollectionItemProps) => {
    const [ ishovered, setIsHovered ] = useState<boolean>(false)
    const setCategory = () => {

    }
    const listStagger = {
        hidden: {},
        show: {
            transition: {
                delay: 0.2,
                staggerChildren: 0.25,
            },
        },
        exit: {
            transition: {
                staggerChildren: 0.04,
                staggerDirection: -1,
            },
        },
    };

    const ImageAnim = {
        closed: {
            scale: 1,
            transition: {
                duration: 0.5,
                ease: [ 0.9, 0, 0.25, 0.9 ] as Easing
            }

        },
        active: {
            scale: 1.05,
            transition: {
                duration: 0.5,
                ease: [ 0.9, 0, 0.25, 0.9 ] as Easing
            }
        },
    }
    const overlayAnim = {
        closed: {
            opacity: 0.6,
            transition: {
                duration: 0.5,
                ease: [ 0.9, 0, 0.25, 0.9 ] as Easing
            }

        },
        active: {
            opacity: 0,
            transition: {
                duration: 0.5,
                ease: [ 0.9, 0, 0.25, 0.9 ] as Easing
            }
        },
    }

    return (
        <div onClick={() => setActive(false)} className={styles.Collection__item} key={`key ${id} ${title}`} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
            <LocalizedClientLink className={styles.image__contents} href={href} >
                <div className={styles.image__wrapper}>
                    <motion.div className={styles.image__container} variants={ImageAnim} initial="closed" animate={ishovered ? "active" : "closed"}>
                        <Image src={image} alt={title} fill/>
                        <motion.div className={styles.overlay} variants={overlayAnim} initial="closed" animate={ishovered ? "active" : "closed"}/>
                    </motion.div>
                </div>
                <p>
                    {title}
                </p>
            </LocalizedClientLink>
            <motion.ol
                className={styles.categories}
                variants={listStagger}
                initial="hidden"
                animate="show"
                exit="exit"
            >
                {products.map((product, index) => {
                    const { label } = product

                    return (
                        <LinkCat href={href} onClickAction={setCategory} text={label} index={index}/>
                    )
                })}
            </motion.ol>
        </div>
    )
}

