import { Easing, motion } from 'framer-motion';
import styles from './styles.module.scss';
import LocalizedClientLink from '@modules/common/components/localized-client-link';
import Image from 'next/image';

type NavButton = {
    title?: string;
    href: string;
    img: string;
    alt: string;
    icon1?: string;
    icon2?: string;
}

export default function Button({title, href, img, alt, icon1, icon2}: NavButton) {
  return (
    <LocalizedClientLink className={styles.button} href={href}>
        <motion.div 
            className={styles.slider}
        >
            <div className={styles.imgWrapper} 
                // this will be same animationas the perspective text but slighly skewed so its looks bit different but still connected to the perspective text
            >
                <PerspectiveImage img={img} alt={alt}/>
            </div>
            <div 
                className={styles.el}
            >
                <PerspectiveText label={title || ""} icon1={icon1} icon2={icon2}/>
            </div>
            <div 
                className={styles.el}
            >
                <PerspectiveText label={title || ""} icon1={icon1} icon2={icon2}/>
            </div>
        </motion.div>
    </LocalizedClientLink>
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
        </div>
    )
}