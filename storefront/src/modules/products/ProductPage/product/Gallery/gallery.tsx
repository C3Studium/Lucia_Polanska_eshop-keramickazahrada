"use client"

import { HttpTypes } from "@medusajs/types";
import { motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";


type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
}

const Gallery: React.FC<ProductTemplateProps> = ({ product, region, countryCode }) => {
    const [ isHovered, setIsHovered ] = useState<boolean>(false);

    const images = useMemo(() => {
        return product.images || [];
    }, [product.images]);

    const [ currentIndex, setCurrentIndex ] = useState<number>(0);
    const length = images.length;

    useEffect(()=> {
        if(images.length > 0){
            setCurrentIndex(0);
        }
    },[images])

    const goNext = () => {
        if (images.length === 0) return;
        setCurrentIndex((i) => (i + 1) % images.length);
    };
    const goPrev = () => {
        if (images.length === 0) return;
        setCurrentIndex((i) => (i - 1 + images.length) % images.length);
    };

    return (
        <div className="product__image">
            <div className="Image__container">
                {(images.length > 1) ? (
                    <div className="Image__container__slider">
                        {images.map((image, idx) => (
                            <div
                                key={image.id}
                                className="product__image__item"
                                
                                onMouseEnter={() => setIsHovered(true)}
                                onMouseLeave={() => setIsHovered(false)}
                            >
                                {image.url ? (
                                    <Image
                                        src={image.url}
                                        alt={`Product image ${image.rank}`}
                                        layout="fill"
                                        objectFit="cover"
                                        className="image active"
                                    />
                                ) : (
                                    <div>No image available</div>
                                )}
                            </div>
                        ))}
                    </div>
                ):(
                    images[0] ? (
                        <motion.div
                            key={images[0].id}
                            className='product__image__item active'
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.3 }}
                        >
                            {!images[0].url ? (
                                <div>No image available</div>
                            ) : (
                                <Image
                                    key={images[0].id}
                                    src={images[0].url}
                                    alt={`Product image ${images[0].rank}`}
                                    layout="fill"
                                    objectFit="cover"
                                    className='image'
                                />
                            )}
                        </motion.div>
                    ) : (
                        <div>No image available</div>
                    )
                )}
            </div>
        </div>
    )
}

export default Gallery;