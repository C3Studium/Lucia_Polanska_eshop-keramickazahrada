import { Easing, motion } from 'framer-motion';
import styles from './styles.module.scss';
import Image from 'next/image';


export default function ProductButton() {
  return (
    <div className={styles.button}>
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
        </div>
    )
}