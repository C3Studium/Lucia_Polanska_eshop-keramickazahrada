"use client";
import Image from "next/image";
import { AnimatePresence, Easing, motion } from "framer-motion";
import style from "./styles.module.scss"; 
import { HttpTypes } from "@medusajs/types";
import { useState } from "react";

type CategoryProps = {
    category: string;
    setCategoryAction: (c: string) => void;
    categories?: HttpTypes.StoreProductCategory[]
    subcategory: string;
    setSubcategoryAction: ( s: string) => void
};

export default function CategoryNav({ category, setCategoryAction, categories, subcategory, setSubcategoryAction }: CategoryProps) {
    const [ isOpen, setIsOpen ] = useState<boolean>(false)
    // Debug: log categories, products, and product types
    // if (categories) {
    //     console.log('Categories:', categories);
    //     categories.forEach((cat: any) => {
    //         console.log(`Category: ${cat.category}`);
    //         if (Array.isArray(cat.products)) {
    //             console.log('Products:', cat.products);
    //             cat.products.forEach((product: any) => {
    //                 console.log(`Product: ${product.title || product.name || product.id}`);
    //                 console.log('Product Type:', product.type);
    //             });
    //         }
    //     });
    // }
    // WIP: add a list of subcategories names, then map the handles and replace the text with the custom text, so it has diactritics and looks decent. 
    const perspective = {
        initial: {
            opacity: 0,
            rotateX: 90,
            translateY: 80,
            translateX: -20,
        },
        enter: (i: number) => ({
            opacity: 1,
            rotateX: 0,
            translateY: 0,
            translateX: 0,
            transition: {
                duration: 0.65, 
                delay: 0.5 + (i * 0.1), 
                ease: [.215,.61,.355,1] as Easing,
                opacity: { duration: 0.35}
            }
        }),
        exit: {
            opacity: 0,
            transition: { duration: 0.5, ease: [0.76, 0, 0.24, 1] as Easing }
        }
    }


    const dropdownMenuVariants = {
        hidden: {
            opacity: 0,
            height: 0,
            transition: {
                duration: 0.15,
                ease: [0.76, 0, 0.24, 1] as Easing,
                when: "afterChildren", 
                staggerChildren: 0.05,
                staggerDirection: -1 
            }
        },
        visible: {
            opacity: 1,
            height: "auto",
            transition: {
                duration: 0.15,
                ease: [0.76, 0, 0.24, 1] as Easing,
                when: "beforeChildren", 
                staggerChildren: 0.05,
                delayChildren: 0.05
            }
        }
    };

    const dropdownItemVariants = {
        hidden: {
            opacity: 0,
            y: -10,
            transition: {
                duration: 0.1,
                ease: [0.76, 0, 0.24, 1] as Easing,
            }
        },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.15,
                ease: [0.76, 0, 0.24, 1] as Easing,
            }
        }
    };

    const handleCategoryClick = (catName: string) => {
        if (category === catName) {
            setCategoryAction("");
        } else {
            setCategoryAction(catName);
        }
    }

    const handleSubcategoryClick = ( value: string) => {
        console.log("subcategory value: ", value, "subcategory: ",subcategory)
        if( subcategory === value) {
            setSubcategoryAction("")
        } else {
            setSubcategoryAction(value)
        }
    }

    return (
        <div className={style.navCat}>
            <div className={style.bodyCat}>
                {categories?.map((cat, i) => {
                    console.log("category products: ", cat.products)
                    return (
                    <div key={cat.id} className={style.linkContainerCat}>
                        <motion.div
                            custom={i}
                            variants={perspective}
                            initial="initial"
                            animate="enter"
                            exit="exit"
                            className={style.category__nav__item__container}
                        >
                            <div 
                                className={`${style.category__nav__item} ${category === cat.name ? style.active : ""}`}
                                onClick={() => handleCategoryClick(cat.name)}
                            >
                                <p
                                >
                                    {cat.name}
                                </p>
                                <motion.div className={`${style.category__icon} ${category === cat.name ? style.active : ''}`}
                                    initial={{ rotate: 0 }}
                                    animate={{ rotate: category === cat.name ? 180 : 0 }}
                                    transition={{ duration: 0.3 }}
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    style={{
                                        borderColor: category === cat.name ? "var(--bgWhite)" : "var(--shadows)",
                                    }}
                                >
                                    <AnimatePresence>
                                        {category === cat.name && (
                                            <Image 
                                                src="/assets/icons/arrow_up_white.svg"
                                                alt="arrow up icon" 
                                                width={20} 
                                                height={20} 
                                                className="arrow__icon"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setCategoryAction("");

                                                }}
                                            />
                                        )}
                                        {category !== cat.name && (
                                            <Image 
                                                src="/assets/icons/arrow_up.svg"
                                                alt="arrow right icon" 
                                                width={20} 
                                                height={20} 
                                                className={style.arrow__icon}
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    setCategoryAction("");
                                                }}
                                            />
                                        )}
                                    </AnimatePresence>   
                                </motion.div>
                            </div>

                                <AnimatePresence>
                                    { category === cat.name && (
                                        <motion.ul 
                                            className={style.category__nav__item__subcategories}
                                            variants={dropdownMenuVariants}
                                            initial="hidden"
                                            animate="visible"
                                            exit="hidden"
                                        >
                                            {Array.from(
                                            new Set(cat.products?.map((p) => p.type?.value).filter(Boolean))
                                            )
                                            .sort((a, b) => a!.localeCompare(b!)) // alphabetical sorting, handles strings safely
                                            .map((value) => (
                                                <motion.li 
                                                    key={value}
                                                    variants={dropdownItemVariants}
                                                >
                                                    <button
                                                        className={`${style.subcategoryButton} ${
                                                        subcategory === value ? style.active : ""
                                                        }`}
                                                        onClick={() => handleSubcategoryClick(value as string)}
                                                    >
                                                        <p>{value}</p>
                                                    </button>
                                                </motion.li>
                                            ))}
                                        </motion.ul>
                                    )}

                                </AnimatePresence>
                        </motion.div>
                    </div>
                )
                })}
            </div>
        </div>
    );
}