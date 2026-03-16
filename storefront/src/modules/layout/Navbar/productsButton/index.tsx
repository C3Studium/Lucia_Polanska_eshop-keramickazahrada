import { AnimatePresence, Easing, motion } from 'framer-motion';
import styles from './styles.module.scss';
import Image from 'next/image';
import LinkButton from '@modules/common/components/Buttons/LinkButton';
import MainButton from '@modules/common/components/Buttons/MainButton';
import LocalizedClientLink from '@modules/common/components/localized-client-link';


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



export function ProductButton({ onClickAction}: {onClickAction: () => void}) {
  return (
    <div className={styles.button} onClick={onClickAction}>
        <motion.div 
            className={styles.slider}
        >
            <div className={styles.imgWrapper} 
                // this will be same animationas the perspective text but slighly skewed so its looks bit different but still connected to the perspective text
            >
                <PerspectiveImage img={"/assets/links/home_img.png"} alt={"bg__img"}/>
            </div>
            <div 
                className={styles.el}
            >
                <PerspectiveText label="Produkty"/>
            </div>
            <div 
                className={styles.el}
            >
                <PerspectiveText label="Produkty"/>
            </div>
        </motion.div>
    </div>
  )
}

function PerspectiveText({label, icon1, icon2}: {label: string, icon1?: string, icon2?: string}) {
    if (icon1 && icon2) {
        return (
            <div className={styles.perspectiveText}>
                <Image src={icon1} alt={`${label}__icon1`} width={20} height={20}/>
                <Image src={icon2} alt={`${label}__icon2`} width={20} height={20}/>
            </div>
        )
    }
    return (    
        <div className={styles.perspectiveText}>
            <p>{label}</p>
            <p>{label}</p>
        </div>
    )
}

function PerspectiveImage({img, alt}: {img: string, alt: string}) {
    return (
        <div className={styles.perspectiveImage}>
            <Image src={img} alt={alt} fill style={{objectFit: 'cover'}}/>
            <div className={styles.overlay}/>
        </div>
    )
}

export function CollectionList ({ active, setActive } : { active: boolean, setActive: () => void}) {
    const currenTimeCES = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Prague",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(new Date());
    const currenTime = `${currenTimeCES} CES`
    const currentYear = new Date().getFullYear()

    const lines = Array.from(
        { length: Math.ceil(importantLinks.length / 2)},
        (_, i) => importantLinks.slice(i * 2, i * 2 + 2)
    )
    return (
        <AnimatePresence initial={false}>
            { active && 
                <motion.div 
                    className='Collection__List'
                    key="Collection__List-products"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                    style={{ overflow: "hidden" }}
                >
                    <div className='navigations'>
                    </div>
                    <div className='Collection__List__container'>
                        <div className='Collections__wrapper'>
                            {collections.map((collection) => {
                                const {id, title, description, image, href, products } = collection

                                return(
                                    <CollectionItem
                                        id={id}
                                        description={description}
                                        title={title}
                                        image={image}
                                        href={href}
                                        products={products}
                                        setActive={setActive}
                                    />
                                ) 
                            })}
                        </div>  

                        <div className='Links'>
                            {lines.map((line, index) => (
                                <div className='Links__line' key={`line-${index}`}>
                                    {line.map((cat) => {
                                        const { label, href } = cat 
                                        return (
                                            <LinkButton text={label} href={href} />
                                        )
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className='end__footer'>
                        <p>
                            Lucie Polanská - © {currentYear} všechna práva vyhrazena 
                        </p>
                        <p>
                            {currenTime}
                        </p>
                    </div>
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
    setActive: () => void
}


const CollectionItem = ({ title, id, href, products, image, description, setActive}: CollectionItemProps) => {
    return (
        <LocalizedClientLink onClick={setActive} href={href} className='Collection__item' key={`key ${id} ${title}`}>
            <div className='image__contents'>
                <div className='image__wrapper'>
                    <Image src={image} alt={title} fill/>
                    <div className='overlay'/>
                </div>
                <p>
                    {title}
                </p>
            </div>
            <ol className='categories'>
                {products.map((product, index) => {
                    const { label } = product

                    return (
                        <li className='category' key={`${product} ${index}`}>
                            {label}
                        </li>
                    )
                })}
            </ol>
        </LocalizedClientLink>
    )
}