"use client";
import { SoldImages } from 'constants/images';
import { motion, useAnimationFrame, useMotionValue, useScroll, useSpring, useTransform, useVelocity } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useRef } from 'react';

export default function SoldProducts () {
    return (
        <section className="soldProducts">
            <div className='soldProducts__title'>
                <div className='soldProducts__title__text'>
                    <Image 
                        src="/assets/icons/wheel_white.svg"
                        alt="Wheel Icon"
                        width={50}
                        height={50}  
                    />
                    <h2>Podobné Produkty</h2>
                    <Image 
                        src="/assets/icons/wheel_white.svg"
                        alt="Wheel Icon"
                        width={50}
                        height={50}  
                    />
                </div>
                <div className='divider'/>
            </div>

            <div className='soldProducts__image__bar'>
                <RotatingBar />
            </div>
        </section>
    );
}

const RotatingBar = () => {
    const {scrollY} = useScroll();
    const BaseVelocity = 100;

    const currentRotation = useMotionValue(0);
    const isAnimating = useRef(true);

    const velocity = useVelocity(scrollY);
    const SmoothVelocity = useSpring(velocity, {
        stiffness: 400, 
        damping: 50
    });


    const velocityFactor = useTransform(SmoothVelocity, [0, 1000], [0, 5], {clamp: false}); // clamp: false => value will exceed the range if it is outside of the range
    const x = useTransform(currentRotation, (v) => `${v}px`);
    const directionFactor = useRef(1);
    
    useAnimationFrame((t, delta) => {
        if (!isAnimating.current) return;

        let moveBy = directionFactor.current * BaseVelocity * (delta / 1000);

        if(velocityFactor.get() < 0) {
            directionFactor.current = -1;
        } else if (velocityFactor.get() > 0) {
            directionFactor.current = 1;
        }

        moveBy += directionFactor.current * moveBy * velocityFactor.get();
        currentRotation.set(currentRotation.get() + moveBy);
    })

    useEffect(() => {
        const unsubscribe = currentRotation.on("change", (v) => {
            if (v > 5000 || v < -5000) {
                currentRotation.set(0);
            }
        });
        return unsubscribe;
    }, [currentRotation]);
    // WIP: Create the list using sanity not medusa, it will be just so much easier

    return (
        <div className="soldProducts__rotating__bar">
            <motion.div style={{ x, }} className="soldProducts__rotating__bar__inner">
                <ImageBar />
                <ImageBar />
                <ImageBar />
                <ImageBar />
                <ImageBar />
            </motion.div>
        </div>
    )
}

const ImageBar = () => {

    return (
        <div className='soldProducts__image__bar'>
            {SoldImages.map((image, index) => {
                const { src, alt } = image;
                return (
                    <div key={index} className="soldProducts__image__bar__item">
                        <Image 
                            src={src} 
                            alt={alt} 
                            className="soldProducts__image__bar__item" 
                            fill={true} 
                            priority={index < 3}
                            sizes="50dvw"
                        />
                    </div>
                )
            })}
        </div>
    )
}