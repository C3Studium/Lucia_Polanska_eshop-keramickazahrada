import MainButton from "@modules/common/components/Buttons/MainButton";
import Image from "next/image";

export default function AboutInfo () {
    return (
        <section className="AboutInfo">
            <div className="text__container">
                <div className="first__text">
                    <p>
                        <span> JSEM PÍSECKÁ RODAČKA, <Image src={"/assets/icons/study.png"} alt="study_icon" width={40} height={40}/>ABSOLVENTKA</span>
                        <span>SPŠ KERAMICKÁ V BECHYNI A MÁMA DVOU</span>
                        <span>ÚŽASNÝCH DĚTÍ. NAPLNO SE  <Image src={"/assets/icons/pot.png"} alt="pot_icon" width={40} height={40}/> KERAMICE</span>
                        <span>VĚNUJI OD R. 2014.</span>
                    </p>
                </div>
                <div className="divider__container">
                    <div className="divider"/>
                    <div className="buttons">
                        <p>
                            Chcete vidět jak<br/>
                            vyrábím mé výrobky?
                        </p>
                        <MainButton text="Výroba" type="button" kind="Link" href="/vyroba" className="link_button"/>
                    </div>
                </div>
            </div>
            <div className="Image__container">
                <div className="image__wrapper">
                    <Image src={"/assets/img/ome/3.png"} alt="owners__photo" fill />
                </div>
            </div>
            <div className="text__container">
                <div className="first__text">
                    <p>
                        <span>SVOU ORIGINÁLNÍ POETIKOU <Image src={"/assets/icons/dash.png"} alt="dash_icon" width={40} height={40}/> , PŘÍRODNÍM DESIGNEM </span>
                        <span>A VOLBOU VYSOCE KVALITNÍCH  <Image src={"/assets/icons/cube.png"} alt="cube_icon" width={40} height={40}/>  MATERIÁLŮ </span>
                        <span>MÁ KERAMIKA OSLOVÍ KAŽDÉHO, KDO HLEDÁ</span>
                        <span>VÝTVARNOU I ŘEMESLNOU KVALITU.</span>
                    </p>
                </div>
                <div className="divider__container">
                    <div className="divider"/>
                </div>
            </div>
        </section>
    )
}