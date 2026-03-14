import MouseAnim from "@modules/common/components/MouseAnim";
import Image from "next/image";

const MainVyroba = () => {

    return(
        <section className="main__vyroba">
            <div className="text__content">
                <div className="text__wrappper">
                    <p>
                        <span>
                            MOJE TVORBA 
                        </span>
                        VYCHÁZÍ Z PŘÍRODY, JEDNODUCHOSTI A TRADIČNÍHO ŘEMESLA. KAŽDÝ KUS VZNIKÁ RUČNĚ – OD PRVNÍ MYŠLENKY, PŘES MODELOVÁNÍ A POMALÉ SCHNUTÍ, AŽ PO DVA VÝPALLY PŘI VYSOKÝCH TEPLOTÁCH. PRACUJI S CERTIFIKOVANÝMI, ZDRAVOTNĚ NEZÁVADNÝMI MATERIÁLY A KAŽDÉMU KROKU VĚNUJI ČAS I POZORNOST. VÝSLEDKEM JE POCTIVÁ KERAMIKA S DUŠÍ, URČENÁ PRO KAŽDODENNÍ POUŽITÍ I DLOUHOU ŽIVOTNOST – UVNITŘ I VENKU.
                    </p>
                </div>
                <div className="mouse">
                    <MouseAnim />
                    <p>
                        Zjistit více
                    </p>
                </div>
            </div>
            <div className="image__container">
                <div className="image__wrapper">
                    <Image src="/assets/img/vyroba/main.png" alt="Výroba keramiky" fill />
                </div>
            </div>
        </section>
    )
}

export default MainVyroba;
