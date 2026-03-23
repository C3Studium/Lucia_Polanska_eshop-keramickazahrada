"use client"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"
import WebButton from "@modules/common/components/Buttons/webButton"
import { Easing, motion } from "framer-motion"
import { useState } from "react"

type ItemProps = {
    id: number,
    title : string,
    description: string,
    image : string,
    href : string,
}

const opacityAnim = {
    initial: {
        opacitu: 0.8,
    },
    enter:{
        opacity: 0.4,
        transition: {
            duration: 0.45,
            ease: [ 0.76, 0, 0.24, 1] as Easing
        }
    },
    exit:{
        opacity: 0.8,
        transition: {
            duration: 0.45,
            ease: [ 0.76, 0, 0.24, 1] as Easing
        }
    }
}

export const VerticalItem = ({collection}: {collection: ItemProps}) => {
    const [ hover, setHover ] = useState<Boolean>(false)

    return (
        <LocalizedClientLink onMouseEnter={()=> setHover(true)} onMouseLeave={()=> setHover(false)} href={collection.href} className="vertical__item__wrapper" id={`collection-${collection.id}`}>
            <div className="image__container">
                <motion.div variants={opacityAnim} initial="initial" animate={hover ? "enter" : "exit"} className="black"/>
                <Image src={collection.image} alt={collection.title} fill/>
            </div>
            <div className="Item__content">
                <WebButton
                    title="Zobrazit" 
                    href={collection.href} 
                    img="/assets/links/home_img.png" 
                    alt={`View ${collection.title}`}
                    Kind="Link"
                />
                <h3>{collection.title}</h3>
                <p>
                    {collection.description}
                </p>
            </div>
        </LocalizedClientLink>
    )
}

export const HorizontalItem = ({collection}: {collection: ItemProps}) => {
    const [ hover, setHover ] = useState<Boolean>(false)

    return (
        <LocalizedClientLink onMouseEnter={()=> setHover(true)} onMouseLeave={()=> setHover(false)} href={collection.href} className="horizontal__item__wrapper" id={`collection-${collection.id}`}>
            <div className="image__container">
                <motion.div variants={opacityAnim} initial="initial" animate={hover ? "enter" : "exit"} className="black"/>
                <Image src={collection.image} alt={collection.title} fill/>
            </div>
            <div className="Item__content">
                <WebButton
                    title="Zobrazit" 
                    href={collection.href} 
                    img="/assets/links/home_img.png" 
                    alt={`View ${collection.title}`}
                    Kind="Link"
                />
                <h3>{collection.title}</h3>
                <p>
                    {collection.description}
                </p>
            </div>
        </LocalizedClientLink>
    )
}
