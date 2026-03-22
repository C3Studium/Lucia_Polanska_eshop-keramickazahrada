"use client";
import { Easing, motion } from 'framer-motion';
import { useState } from 'react';
import LocalizedClientLink from '../../localized-client-link';
import Arrow from '@modules/common/icons/arrow';

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

export default function LinkButton({ text, href, className, index, onClickAction } : LinkButtonProps) {
    const [ isActive , setIsActive ] = useState<boolean>(false);
    return (
        <LocalizedClientLink href={href} className={`${className} LinkButton`} key={`LinkButton ${index}`}>
            <button 
                className="button"
                onMouseEnter={() => setIsActive(true)}
                onMouseLeave={() => setIsActive(false)}
                onClick={onClickAction}
            >
                <motion.div 
                    className="slider"
                    animate={{top: isActive ? "-100%" : "0%"}}
                    transition={{ duration: 0.5, type: "tween", ease: [0.76, 0, 0.24, 1]}}
                >
                    <div 
                        className="el"
                        style={{ backgroundColor: "var(--darkOlive)" }}
                    >
                        <PerspectiveText label={text}/>
                    </div>
                    <div 
                        className="el"
                        style={{ backgroundColor: "var(--bgPrimary)" }}
                    >
                        <PerspectiveText label={text}/>
                    </div>
                </motion.div>
            </button>
            <motion.div className='Line' variants={lineAnim} initial="initial" animate={isActive ? "enter" : "exit"}/>
        </LocalizedClientLink>
    )
}

function PerspectiveText({label}: {label: string}) {
    return (    
        <div className="perspectiveText">
            <p>{label}<span><Arrow size={15} color='white'/></span></p>
            <p>{label}<span><Arrow size={15} color='white'/></span></p>
        </div>
    )
}