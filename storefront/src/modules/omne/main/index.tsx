import Image from "next/image";

export default function AboutMe () {
    return (
        <section className="AboutMe">
            <div className="Text__content">
                <div className="image__intro">
                    <div className="image__wrapper">
                        <Image src="/assets/img/ome/1.png" alt="intro__image" fill/>
                    </div>
                    <h1>
                        <span>
                            Jmenuji se
                        </span>
                        <span className="handwritten">
                            Lucie  Polanská
                        </span>
                    </h1>
                </div>
                <div className="greetings">
                    <Image src="/assets/icons/wawing_hand.png" alt="wawing hand icon" width={50} height={50}/>
                    <p>
                        Těší mě
                    </p>
                </div>
            </div>
            <div className="Images__content">
                <Image src="/assets/img/ome/2.png" alt="intro__image2" fill/>
            </div>
        </section>
    )
}