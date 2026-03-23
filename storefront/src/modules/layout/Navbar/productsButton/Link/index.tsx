"use client";
import { Easing, motion } from 'framer-motion';
import { useState } from 'react';

import Arrow from '@modules/common/icons/arrow';

import styles from "./styles.module.scss"
import LocalizedClientLink from '@modules/common/components/localized-client-link';


type LinkButtonProps = {
    text: string;
    href: string; 
    className?: string;
    index?: number
    onClickAction?: () => void
}

const lineAnim = {
    initial: {
        x: "-100%",
    },
    enter: {
        x: "0%",
        transition: {
            duration: 0.45,
            ease: [0.76, 0, 0.24, 1] as Easing
        }
        
    },
    exit: {
        x: "-100%",
        transition: {
            delay: 0.15,
            duration: 0.45,
            ease: [0.76, 0, 0.24, 1] as Easing
        }
        
    },
}

export default function LinkCat({ text, href, className, index, onClickAction } : LinkButtonProps) {
    const [ isActive , setIsActive ] = useState<boolean>(false);
    return (
        <LocalizedClientLink href={href} className={`${className} ${styles.LinkCat}`} key={`LinkButton ${index}`}>
            <button 
                className={styles.button}
                onMouseEnter={() => setIsActive(true)}
                onMouseLeave={() => setIsActive(false)}
                onClick={onClickAction}
            >
                <motion.div 
                    className={styles.slider}
                    animate={{top: isActive ? "-100%" : "0%"}}
                    transition={{ duration: 0.5, type: "tween", ease: [0.76, 0, 0.24, 1]}}
                >
                    <div 
                        className={styles.el}
                    >
                        <PerspectiveText label={text}/>
                    </div>
                    <div 
                        className={styles.el}
                    >
                        <PerspectiveText label={text}/>
                    </div>
                </motion.div>
            </button>
            <motion.div className={styles.Line} variants={lineAnim} initial="initial" animate={isActive ? "enter" : "exit"}/>
        </LocalizedClientLink>
    )
}

function PerspectiveText({label}: {label: string}) {
    return (    
        <div className={styles.perspectiveText}>
            <p>{label}<span><Arrow size={15}/></span></p>
            <p>{label}<span><Arrow size={15}/></span></p>
        </div>
    )
}