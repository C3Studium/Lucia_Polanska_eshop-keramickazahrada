"use client";
import Image from "next/image";
import { useEffect, useRef, useState, WheelEvent } from "react";
import { AnimatePresence, Easing, motion } from "framer-motion";
import { HttpTypes } from "@medusajs/types";

type SearchBarProps = {
  category: string;
  setCategoryAction: (c: string) => void;
  search: string;
  setSearchAction: (s: string) => void;
  priceRange: string;
  setPriceRangeAction: (r: string) => void;
  sale: boolean;
  setSaleAction: (b: boolean) => void;
  isNew: boolean;
  setIsNewAction: (b: boolean) => void;
  setPendingCategoryAction: (c: string) => void;
  priceRanges?: string[];
  categories?: { id: string; name: string }[];
  pendingCategory: string;
  subcategory: string;
  setSubcategoryAction: ( s: string) => void 
  products: HttpTypes.StoreProduct[]
};

export default function SearchBar({
  category,
  setCategoryAction,
  search,
  setSearchAction,
  priceRange,
  setPriceRangeAction,
  sale,
  setSaleAction,
  isNew,
  setIsNewAction,
  priceRanges,
  categories,
  pendingCategory,
  setPendingCategoryAction,
  subcategory,
  setSubcategoryAction,
  products
}: SearchBarProps) {
    const [ isMobile, setIsMobile ] = useState<boolean>(false);
    const [ isAnimated, setIsAnimated ] = useState<boolean>(false);
    const [ isOpen , setIsOpen ] = useState<boolean>(false);
    const [ isDropdownOpen, setIsDropdownOpen ] = useState<boolean>(false);
    const [ highlightedIndex, setHighlightedIndex ] = useState<number>(-1);
    const [ isTouchDevice, setIsTouchDevice ] = useState<boolean>(false);
    const searchBarRef = useRef<HTMLDivElement>(null);
    const priceDropdownRef = useRef<HTMLDivElement>(null);
    const itemsRef = useRef<HTMLDivElement | null>(null)

    // WIP: Make the dropdown menu scrollable, then add product names and types within from the categories object. so ti displayes also the names and subcategories within the filter system
    const searchMenu = {
        open: {
            width: "80%",
            transition: {
                duration: 1,
                ease: [0.76, 0, 0.24, 1] as Easing
            }
        },
        close: {
            width: "20%",
            transition: {
                duration: 1,
                ease: [0.76, 0, 0.24, 1] as Easing,
            }
        }
    }

    const childrenVariants = {
        initial: {
            opacity: 0,
            display: "none"
        },
        open: (i: number) => ({
            opacity: 1,
            display: "flex",
            transition: {
                duration: 0.5,
                delay: 0.15 * i,
                ease: [0.76, 0, 0.24, 1] as Easing,
            }
        }),
        close: (i: number) => ({
            opacity: 0,
            display: "none",
            transition: {
                duration: 0.3,
                delay: 0.15 * i,
                ease: [0.76, 0, 0.24, 1] as Easing,
            }
        })
    }
    const dropdownMenuVariants = {
        hidden: {
            opacity: 0,
            height: 0,
            transition: {
                duration: 0.25,
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
                duration: 0.25,
                ease: [0.76, 0, 0.24, 1] as Easing,
                when: "beforeChildren", 
                staggerChildren: 0.05,
                delayChildren: 0.1
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
    const filteredCategories = categories
    ? categories.filter(cat =>
        cat.name !== category &&
        (search.length === 0 || cat.name.toLowerCase().includes(search.toLowerCase()))
        )
    : [];

const productTypes = products
  ? products
      .filter(
        (p) =>
          p.type?.value && // remove undefined
          p.type.value !== subcategory &&
          (search.length === 0 || p.type.value.toLowerCase().includes(search.toLowerCase()))
      )
      // remove duplicates
      .filter(
        (p, index, self) =>
          index ===
          self.findIndex((t) => t.type?.value === p.type?.value)
      )
  : [];
    useEffect(() => {
        const updateDimensions = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            
            // Check if mobile (width smaller than height AND width below 550px)
            const isMobileDevice = width < height && width < 550;
            setIsMobile(isMobileDevice);
        };

        // Run on mount
        updateDimensions();

        // Add resize listener
        window.addEventListener('resize', updateDimensions);

        // Cleanup listener on unmount
        return () => {
            window.removeEventListener('resize', updateDimensions);
        };
    }, []);
    // Detect touch device
    useEffect(() => {
        const checkTouchDevice = () => {
            setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
        };
        
        checkTouchDevice();
        window.addEventListener('resize', checkTouchDevice);
        
        return () => window.removeEventListener('resize', checkTouchDevice);
    }, []);

    useEffect(() => {
        if ( search === "" && pendingCategory){
            setCategoryAction(pendingCategory);
            setPendingCategoryAction("");
        }
    },[search, pendingCategory, setCategoryAction, setPendingCategoryAction]);

    // Handle clicks outside search dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                searchBarRef.current &&
                !searchBarRef.current.contains(event.target as Node)
            ) {
                setIsDropdownOpen(false);
            }
        };
        if (isDropdownOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        } else {
            document.removeEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    },[isDropdownOpen]);

    // Handle clicks outside price dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                priceDropdownRef.current &&
                !priceDropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        } else {
            document.removeEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    },[isOpen]);

    useEffect(() => {
        setHighlightedIndex(-1); // Reset highlighted index when dropdown opens or search changes
    }, [isDropdownOpen, search]);



    const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
        const el = itemsRef.current
        if (!el) return
    
        const delta = e.deltaY
        const atTop = el.scrollTop === 0
        const atBottom = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight
    
        const tryingToScrollUpPastTop = atTop && delta < 0
        const tryingToScrollDownPastBottom = atBottom && delta > 0
    
        // If the container can scroll in the wheel direction, keep the event inside.
        // If the user is trying to scroll past the top or bottom, prevent the event so the page doesn't scroll.
        const canScrollUp = el.scrollTop > 0
        const canScrollDown = Math.ceil(el.scrollTop + el.clientHeight) < el.scrollHeight
    
        if ((delta < 0 && canScrollUp) || (delta > 0 && canScrollDown)) {
          // inner scrolling — stop propagation so the page doesn't pick up the event
          e.stopPropagation()
          return
        }
    
        if (tryingToScrollUpPastTop || tryingToScrollDownPastBottom) {
          // prevent the page from scrolling when flinging past edges
          e.preventDefault()
          e.stopPropagation()
        }
    }

    return (
        <div className="search__bar">
            <div className="search__bar__container" ref={searchBarRef}>
                <div className="search__bar__container__categories">
                    {/* <div 
                        className="search__bar__container__main" 
                        ref={priceDropdownRef}
                    >
                        <button 
                            className="dropdown__button"
                            onMouseEnter={() => !isTouchDevice && setIsOpen(true)}
                            onMouseLeave={() => !isTouchDevice && setIsOpen(false)}
                            onClick={() =>  isTouchDevice && setIsOpen(!isOpen)}
                        >
                            <p> Cena </p>
                            <motion.div
                                animate={{ rotate: isOpen ? 180 : 0 }}
                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                className="arrow__container"
                            >
                                <Image 
                                    src={"/assets/icons/arrow_up.svg"}
                                    alt="Arrow Down Icon"
                                    width={20}
                                    height={20}
                                    className={`arrow__icon ${isOpen ? "open" : ""}`}
                                />
                            </motion.div>
                        </button>
                      <AnimatePresence mode="wait">
                        {isOpen && (
                            <motion.div 
                                className="dropdown__menu"
                                variants={dropdownMenuVariants}
                                initial="hidden"
                                animate="visible"
                                exit="hidden"
                                key="price-dropdown-menu"
                                onMouseEnter={() => !isTouchDevice && setIsOpen(true)}
                                onMouseLeave={() => !isTouchDevice && setIsOpen(false)}
                            >
                                {priceRanges?.map((range, index) => (
                                    <motion.button
                                        key={index}
                                        className={`dropdown__menu__item ${priceRange === range ? "active" : ""}`}
                                        variants={dropdownItemVariants}
                                        onClick={() => {
                                            if (priceRange === range) {
                                                setPriceRangeAction("");
                                            } else {
                                                setPriceRangeAction(range);
                                            }
                                            setIsOpen(false);
                                        }}
                                    >
                                        <p>{range},-</p>
                                    </motion.button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                    </div>
                    <div className="search__bar__container__main">
                        <button onClick={() => setSaleAction(!sale)} className={`filter__button ${sale ? "active" : ""}`}>
                            <p>Slevy</p>
                        </button>
                    </div>
                    <div className="search__bar__container__main">
                        <button onClick={() => setIsNewAction(!isNew)} className={`filter__button ${isNew ? "active" : ""}`}>
                            <p>Novinky</p>
                        </button>
                    </div> */}
                    <p>Novinky</p>
                    <p>Slevy</p>
                    <p>Balíčky</p>
                </div>

                {!isMobile && (<div 
                    className="search__bar__container__search"
                >
                    <div className="search__bar__subcontainer__search">
                        <div 
                            className="search__icon"
                        >
                            <Image 
                                src={"/assets/icons/search.svg"}
                                alt="Search Icon"
                                width={35}
                                height={35}
                                className="search__icon__image"
                            />
                        </div>
                        <input
                            type="text"
                            placeholder="Hledat výrobky..."
                            className="search__input"
                            value={search}
                            onChange={e => {
                                setSearchAction(e.target.value);
                                setIsDropdownOpen(true);
                                if (category && !pendingCategory) {
                                    setPendingCategoryAction(category);
                                    setCategoryAction("");
                                }
                            }}
                            onFocus={() => setIsDropdownOpen(true)}
                            onKeyDown={e => {
                                if (!isDropdownOpen || filteredCategories.length === 0) return;
                                if (e.key === "ArrowDown") {
                                    setHighlightedIndex(prev =>
                                        prev < filteredCategories.length - 1 ? prev + 1 : 0
                                    );
                                    e.preventDefault();
                                } else if (e.key === "ArrowUp") {
                                    setHighlightedIndex(prev =>
                                        prev > 0 ? prev - 1 : filteredCategories.length - 1
                                    );
                                    e.preventDefault();
                                } else if (e.key === "Enter" && highlightedIndex >= 0) {
                                    setCategoryAction(filteredCategories[highlightedIndex].name);
                                    setSearchAction("");
                                    setIsDropdownOpen(false);
                                    setHighlightedIndex(-1);
                                    e.preventDefault();
                                }
                            }}
                        />

                        <div className="search__icon__close">
                            <AnimatePresence>
                                {(search || isDropdownOpen) && (
                                    <motion.div 
                                        className="close__icon__container"
                                        key="close-container"
                                        initial={{ opacity: 0, scale: 1 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 1 }}
                                        transition={{ duration: 0.3, ease: "easeInOut" }}
                                        onClick={() => {
                                            setSearchAction("");
                                            setIsDropdownOpen(false);
                                            setIsAnimated(false);
                                        }}
                                        
                                    >
                                        <Image
                                            src={"/assets/icons/close.svg"}
                                            alt="Close Icon"
                                            width={20}
                                            height={20}
                                            className="close__icon"
                                        />
                                        <p>Zrušit</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                    <div className="search__bar__container__search__container">
                        { isDropdownOpen && (
                            <div className="search-bar-container__search__container" ref={itemsRef} onWheel={handleWheel}>
                                <ul>
                                    {category && (
                                        <li
                                            key={category}
                                            className="active"
                                            onMouseDown={() => {
                                                setCategoryAction("");
                                                setSearchAction("");
                                                setIsDropdownOpen(false);
                                                setHighlightedIndex(-1);
                                                setPendingCategoryAction("");
                                            }}
                                            >
                                            <p>{category}</p>
                                        </li>
                                    )}
                                    {subcategory && (
                                        <li
                                            key={subcategory}
                                            className="active"
                                            onMouseDown={() => {
                                                setSubcategoryAction("");
                                                setSearchAction("");
                                                setIsDropdownOpen(false);
                                                setHighlightedIndex(-1);
                                                setPendingCategoryAction("");
                                            }}
                                            >
                                            <p>{subcategory}</p>
                                        </li>
                                    )}
                                    {filteredCategories.map((cat, idx) => (
                                        <li
                                            key={cat.id}
                                            className={highlightedIndex === idx ? "highlighted" : ""}
                                            onMouseDown={() => {
                                                setCategoryAction(cat.name);
                                                setSearchAction("");
                                                setIsDropdownOpen(false);
                                                setHighlightedIndex(-1);
                                                setPendingCategoryAction("");
                                            }}
                                            style={{
                                                background: highlightedIndex === idx ? "var(--bgPrimary)" : undefined,
                                            }}
                                        >
                                            <p>{cat.name}</p>
                                        </li>
                                    ))}
                                    {productTypes.map((product, idx ) => (
                                        <li
                                            key={product.id}
                                            className={highlightedIndex === idx ? "highlighted" : ""}
                                            onMouseDown={() => {
                                                setSubcategoryAction(product.type?.value as string);
                                                setSearchAction("");
                                                setIsDropdownOpen(false);
                                                setHighlightedIndex(-1);
                                                setPendingCategoryAction("");
                                            }}
                                            style={{
                                                background: highlightedIndex === idx ? "var(--bgPrimary)" : undefined,
                                            }}
                                        >
                                            <p>{product.type?.value}</p>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>)}

                { isMobile && (
                    <motion.div 
                        className="search__bar__container__search"
                        animate={isAnimated ? "open" : "close"}
                        variants={searchMenu}
                    >
                        <div className="search__bar__subcontainer__search">
                            <button 
                                className="search__icon"
                                onClick={() => {
                                    if (isAnimated) {
                                        // When closing, reset all search-related states
                                        setSearchAction("");
                                        setIsDropdownOpen(false);
                                        setHighlightedIndex(-1);
                                        if (pendingCategory) {
                                            setCategoryAction(pendingCategory);
                                            setPendingCategoryAction("");
                                        }
                                    }
                                    setIsAnimated(!isAnimated);
                                }}
                                
                            >
                                <Image 
                                    src={"/assets/icons/search.svg"}
                                    alt="Search Icon"
                                    width={35}
                                    height={35}
                                    className="search__icon__image"
                                />
                            </button>
                            <AnimatePresence>
                                {isAnimated && (<motion.input
                                    type="text"
                                    placeholder="Hledat výrobky..."
                                    className="search__input"
                                    value={search}
                                    onChange={e => {
                                        setSearchAction(e.target.value);
                                        setIsDropdownOpen(true);
                                        if (category && !pendingCategory) {
                                            setPendingCategoryAction(category);
                                            setCategoryAction("");
                                        }
                                    }}
                                    key="search-input"
                                    onFocus={() => setIsDropdownOpen(true)}
                                    onKeyDown={e => {
                                        if (!isDropdownOpen || filteredCategories.length === 0) return;
                                        if (e.key === "ArrowDown") {
                                            setHighlightedIndex(prev =>
                                                prev < filteredCategories.length - 1 ? prev + 1 : 0
                                            );
                                            e.preventDefault();
                                        } else if (e.key === "ArrowUp") {
                                            setHighlightedIndex(prev =>
                                                prev > 0 ? prev - 1 : filteredCategories.length - 1
                                            );
                                            e.preventDefault();
                                        } else if (e.key === "Enter" && highlightedIndex >= 0) {
                                            setCategoryAction(filteredCategories[highlightedIndex].name);
                                            setSearchAction("");
                                            setIsDropdownOpen(false);
                                            setHighlightedIndex(-1);
                                            e.preventDefault();
                                        }
                                    }}
                                    custom={1}
                                    variants={childrenVariants}
                                    initial="initial"
                                    animate="open"
                                    exit="close"
                                />)}

                                {(isAnimated && <motion.div 
                                    className="search__icon__close" 
                                    key="search-close-icon"
                                    custom={2}
                                    variants={childrenVariants}
                                    initial="initial"
                                    animate="open"
                                    exit="close"
                                >
                                    <AnimatePresence>
                                        {(search || isDropdownOpen) && (
                                            <motion.div 
                                                className="close__icon__container"
                                                key="close-container"
                                                initial={{ opacity: 0, scale: 1 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 1 }}
                                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                                onClick={() => {
                                                    setSearchAction("");
                                                    setIsDropdownOpen(false);
                                                    setIsAnimated(false);
                                                }}
                                                
                                            >
                                                <Image
                                                    src={"/assets/icons/close.svg"}
                                                    alt="Close Icon"
                                                    width={20}
                                                    height={20}
                                                    className="close__icon"
                                                />
                                                <p>Zrušit</p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>)}
                            </AnimatePresence>
                        </div>
                        <div className="search__bar__container__search__container">
                            <AnimatePresence>
                                { isDropdownOpen && (
                                    <motion.div className="search-bar-container__search__container" ref={itemsRef} onWheel={handleWheel}>
                                        <ul>
                                            {category && (
                                                <li
                                                    key={category}
                                                    className="active"
                                                    >
                                                    <p>{category}</p>
                                                </li>
                                            )}
                                            {filteredCategories.map((cat, idx) => (
                                                <li
                                                    key={cat.id}
                                                    className={highlightedIndex === idx ? "highlighted" : ""}
                                                    onMouseDown={() => {
                                                        setCategoryAction(cat.name);
                                                        setSearchAction("");
                                                        setIsDropdownOpen(false);
                                                        setHighlightedIndex(-1);
                                                        setPendingCategoryAction("");
                                                    }}
                                                    style={{
                                                        background: highlightedIndex === idx ? "var(--bgPrimary)" : undefined,
                                                    }}
                                                >
                                                    <p>{cat.name}</p>
                                                </li>
                                            ))}
                                        </ul>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                )}
            </div>

            <div className="active__filters__bar">
                {category && (
                    <span className="active__filter">
                        {category}
                        <Image
                            src="/assets/icons/close.svg"
                            alt="Zrušit kategorii"
                            width={16}
                            height={16}
                            className="filter__close__icon"
                            onClick={() => setCategoryAction("")}
                        />
                    </span>
                )}
                {subcategory && (
                    <span className="active__filter">
                        {subcategory}
                        <Image
                            src="/assets/icons/close.svg"
                            alt="Zrušit kategorii"
                            width={16}
                            height={16}
                            className="filter__close__icon"
                            onClick={() => setSubcategoryAction("")}
                        />
                    </span>
                )}
                {priceRange && (
                    <span className="active__filter">
                        {priceRange}
                        <Image
                            src="/assets/icons/close.svg"
                            alt="Zrušit cenový filtr"
                            width={16}
                            height={16}
                            className="filter__close__icon"
                            onClick={() => setPriceRangeAction("")}
                        />
                    </span>
                )}
                {sale && (
                    <span className="active__filter">
                        Slevy
                        <Image
                            src="/assets/icons/close.svg"
                            alt="Zrušit slevy"
                            width={16}
                            height={16}
                            className="filter__close__icon"
                            onClick={() => setSaleAction(false)}
                        />
                    </span>
                )}
                {isNew && (
                    <span className="active__filter">
                        Novinky
                        <Image
                            src="/assets/icons/close.svg"
                            alt="Zrušit novinky"
                            width={16}
                            height={16}
                            className="filter__close__icon"
                            onClick={() => setIsNewAction(false)}
                        />
                    </span>
                )}
            </div>
        </div>
    );
}