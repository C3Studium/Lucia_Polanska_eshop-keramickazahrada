"use client";
import { useEffect, useRef, useState } from "react";
import Magnetic from "../Buttons/Magnetic";
import { motion, useAnimationFrame, useMotionValue, useScroll, useSpring, useTransform, useVelocity, wrap } from 'framer-motion';
import { palette } from "styles/palette.generated"

export default function RotatingText({text, textColor = palette.black03}:{ text: string; textColor?: string }) {
    const [currentRadius, setCurrentRadius] = useState(90); // Default radius

    // Performance
    
    const { scrollY } = useScroll();
    const BaseVelocity = 50;

    const CurrentRotation = useMotionValue(0); // Single source of truth
    const isAnimating = useRef(true);

    const Velocity = useVelocity(scrollY)
    const SmoothVelocity = useSpring(Velocity, {
        stiffness: 400, 
        damping: 50
    });

    const velocityFactor = useTransform(SmoothVelocity, [0, 1000], [0, 5], {clamp: false}); //clamp: false => value will exceed the range if it is outside of the range

    const rotation = useTransform(CurrentRotation, (v) => `${wrap(0, 360, v)}deg`);

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
        CurrentRotation.set(CurrentRotation.get() + moveBy);
    });


    useEffect(() => {
        const updateRadius = () => {
            const width = window.innerWidth;
            
            // Check if viewport matches the specified range
            if (width >= 1260 && width <= 1420) {
                setCurrentRadius(80); 
            } else if (width >= 960 && width < 1260) {
                setCurrentRadius(75); 
            } else if(width <= 960) {
                setCurrentRadius(70); 
                setCurrentRadius(90); 
            }
        };

        // Initial check
        updateRadius();
        
        // Listen for window resize events
        window.addEventListener('resize', updateRadius);
        
        // Cleanup
        return () => {
            window.removeEventListener('resize', updateRadius);
        };
    }, []);

    return(
        <Magnetic>
            <div className="rotating-text">
                <motion.p className="rotating-text__text" style={{color: textColor, rotate: rotation }}>{circleText({text, textColor, currentRadius})}</motion.p>
            </div>
        </Magnetic>
    )
}

const circleText = ({ text, textColor = palette.black03, currentRadius  }: { text: string; textColor?: string; currentRadius: number}) => {
   const letters = text.split('');
   const totalLetters = letters.length;

   return letters.map((letter, index) => {
        const angle = ( 360 / totalLetters ) * index;
        return (
            <span
                key={index}
                className="circle-text__letter"
                style={{
                    color: textColor,
                    transform: `rotate(${angle}deg) translate(${currentRadius}px) rotate(${90}deg)`,
                    transformOrigin: "center center",
                }}
            >
                {letter}
            </span>
        )
   })
}