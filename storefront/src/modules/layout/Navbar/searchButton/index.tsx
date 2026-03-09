import { Easing, motion } from 'framer-motion';
import styles from './styles.module.scss';
import LocalizedClientLink from '@modules/common/components/localized-client-link';
import Image from 'next/image';
import { search } from '@modules/search/actions';



export default function SearchButton() {
  return (
    <div className={styles.button}>
        <PerspectiveText img={"/assets/icons/search.svg"} alt={"search__icon"}/>
    </div>
  )
}

function PerspectiveText({alt, img}: {alt: string, img: string}) {
    return (    
        <div className={styles.perspectiveText}>
            <Image src={img} alt={`${alt}__icon1`} width={20} height={20}/>
            <Image src={img} alt={`${alt}__icon2`} width={20} height={20}/>
        </div>
    )
}
