import Button from "@modules/common/components/Buttons/button";
import Image from "next/image";

export default function Courses() {
    return (
        <section className="courses__section">
            <div className="courses__wrapper">
                <div className="image__bg">
                    <div className="black"/>
                    <Image src="/assets/img/kittenphoto.png" alt="Courses background" fill/>
                </div>

                <div className="Courses__content">
                    <p>
                        PRO DĚTI A ŠKOLKY HRAVÉ OBJEVOVÁNÍ HLÍNY, <br /> RADOST Z TVOŘENÍ A PRVNÍ VLASTNÍ VÝTVORY.<br /> PRO DOSPĚLÉ PROSTOR PRO ZPOMALENÍ, KLID<br /> A POHODU U RUČNÍ PRÁCE.<br />
                        KURZY, KDE SE TVOŘENÍ STÁVÁ ZÁŽITKEM.
                    </p>
                    <div className="title">
                        <h2>Kurzy</h2>
                        <Button 
                            //rework this button
                        text="Více informací" href="/courses" />
                    </div>
                </div>
            </div>
        </section>
    )
}