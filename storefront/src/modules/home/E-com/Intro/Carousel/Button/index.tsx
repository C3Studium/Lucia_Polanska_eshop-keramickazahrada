import Image from "next/image";

type CarouselButtonProps = {
    src: string;
    alt: string;
    left: boolean;
}

export default function CarouselButton ({src, alt}: CarouselButtonProps) {
    return (
        <button className="Carousel__button">
            <div className="image__bg">
                <Image src={src} alt={alt} fill={true} sizes="100%" quality={60}/>
            </div>
            <p>arrow</p>
        </button>
    )
}