"use client";
import Image from "next/image";
import { AnimatePresence, Easing, motion } from "framer-motion";
import { useEffect, useState } from "react";
import CategoryNav from "./nav";
import CategoryButton from "./button";
import { HttpTypes } from "@medusajs/types";

type CategoryProps = {
    category: string;
    setCategoryAction: (c: string) => void;
    categories?: HttpTypes.StoreProductCategory[]
    subcategory: string;
    setSubcategoryAction: ( s: string) => void 
};

export default function Categories({ category, setCategoryAction, categories, subcategory, setSubcategoryAction }: CategoryProps) {
    const [isMobile, setIsMobile] = useState(false);
    const [isActive, setIsActive] = useState(false);
    
    // Detect viewport width < 500px and keep state in sync
    useEffect(() => {
        const updateIsMobile = () => setIsMobile(typeof window !== "undefined" && window.innerWidth < 500);
        updateIsMobile();
        window.addEventListener("resize", updateIsMobile);
        return () => window.removeEventListener("resize", updateIsMobile);
    }, []);

    // Mobile menu animation
    const menu = {
        open: {
            width: isMobile ? "90dvw" : "450px",
            height: isMobile ? "65dvh" : "65dvh",
            transition: { duration: 0.75, type: "tween" as const, ease: [0.76, 0, 0.24, 1] as Easing}
        },
        closed: {
            width: "50px",
            height: "50px",
            transition: { duration: 0.75, delay: 0.35, type: "tween" as const, ease: [0.76, 0, 0.24, 1] as Easing }
        }
    }

    // return (
    //     <div className="categories">
    //         <div className="categories__mobile">
    //             <motion.div 
    //                 className="categories__mobile__menu"
    //                 variants={menu}
    //                 animate={isActive ? "open" : "closed"}
    //                 initial="closed"
    //             >
    //                 <AnimatePresence>
    //                     {isActive && (
    //                         <CategoryNav 
    //                             category={category}
    //                             setCategoryAction={setCategoryAction}
    //                             categories={categories}
    //                             subcategory={subcategory}
    //                             setSubcategoryAction={setSubcategoryAction}
    //                         />
    //                     )}
    //                 </AnimatePresence>
    //                 <AnimatePresence>
    //                     {isActive && (
    //                         <motion.div className="categories__mobile__button__confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 , transition: { delay: 0.5}}} exit={{ opacity: 0 }}>
    //                             <button className="confirm__button" onClick={() => setIsActive(false)}>
    //                                 <p>Potvrdit</p>
    //                             </button>
    //                         </motion.div>
    //                     )}
    //                 </AnimatePresence>
    //             </motion.div>
    //             <CategoryButton 
    //                 isActive={isActive} 
    //                 toggleMenu={() => setIsActive(!isActive)}
    //             />
    //         </div>
    //     </div>
    // );

    return (
        <div className="categories">
            <div className="categories__mobile">
                <div 
                    className="categories__mobile__menu"
                >
                    <CategoryNav 
                        category={category}
                        setCategoryAction={setCategoryAction}
                        categories={categories}
                        subcategory={subcategory}
                        setSubcategoryAction={setSubcategoryAction}
                    />
                </div>
            </div>
        </div>
    );
}