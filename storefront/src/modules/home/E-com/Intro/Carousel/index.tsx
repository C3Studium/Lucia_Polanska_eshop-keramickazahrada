import Image from "next/image";
import CarouselButton from "./Button";
import Button from "@modules/common/components/Buttons/button";

export default function Carousel () {
  return (
    <div className="Intro__Carousel">
        <div className="Left__section">
            <div className="Content">
                <div className="text">
                    <p>Přiložené fotografie jsou pouze ilustrační…</p>
                </div>
                <div className="mouse__anim">
                    <div className="mouse">
                        <div className="wheel"></div>
                    </div>
                    <p>
                        Produkty dole
                    </p>
                </div>
                <div className="buttons">
                    <CarouselButton src="/assets/links/home_img.png" alt="left arrow" left={true}/>
                    <CarouselButton src="/assets/links/home_img.png" alt="right arrow" left={false}/>
                </div>
            </div>
            <div className="Images">
                <div className="Image__Wrapper">
                    <Image src="/assets/img/img/1.jpg" alt="Carousel Image" fill style={{objectFit: "cover"}}/>
                </div>
            </div>
        </div>
        <div className="Right__section">
            <div className="Images">
                <div className="Image__Wrapper">
                    <Image src="/assets/img/img/2.jpg" alt="Carousel Image" fill style={{objectFit: "cover"}}/>
                </div>
            </div>

            <div className="Custom__orders">
                <Button title="Zakázková výroba" href="/custom-orders" img="/assets/links/home_img.png" alt="Custom orders"/>
            </div>
        </div>
    </div>
  )
}
