import Image from "next/image"

const process = [
    {
        src: "/assets/img/ome/4.png",
        alt: "study__image",
        text: "SVOU ORIGINÁLNÍ POETIKOU, PŘÍRODNÍM DESIGNEM A VOLBOU VYSOCE KVALITNÍCH MATERIÁLŮ MÁ KERAMIKA OSLOVÍ KAŽDÉHO, KDO HLEDÁ VÝTVARNOU I ŘEMESLNOU KVALITU."
    },
    {
        src: "/assets/img/ome/2.png",
        alt: "Family__image",
        text: "SVOU ORIGINÁLNÍ POETIKOU, PŘÍRODNÍM DESIGNEM A VOLBOU VYSOCE KVALITNÍCH MATERIÁLŮ MÁ KERAMIKA OSLOVÍ KAŽDÉHO, KDO HLEDÁ VÝTVARNOU I ŘEMESLNOU KVALITU."
    },
    {
        src: "/assets/img/ome/4.png",
        alt: "Inspiration__image",
        text: "SVOU ORIGINÁLNÍ POETIKOU, PŘÍRODNÍM DESIGNEM A VOLBOU VYSOCE KVALITNÍCH MATERIÁLŮ MÁ KERAMIKA OSLOVÍ KAŽDÉHO, KDO HLEDÁ VÝTVARNOU I ŘEMESLNOU KVALITU."
    }


]


export default function ProcessAbout () {
    const totalHeight = process.length * 100
    return (
        <section className="process" style={{ height: `${totalHeight + 50}vh`}}>
            <div className="sticky__container">             
                <div className="sticky__images">
                    {process.map((img, index) => {
                        const { src, alt } = img
                        return(
                            <div className="Image__wrapper" key={index} style={{ zIndex: index}}>
                                <Image src={src} alt={alt} fill/>
                            </div>
                        )
                    })}
                </div>
                <div className="progess__bar">
                    <div className="progress__text">
                        <p>Praxe / Studium</p>
                        <div className="line"/>
                        <p>Rodina</p>
                        <div className="line"/>
                        <p>Inspirace</p>
                    </div>
                    <div className="divider"/>
                </div>
            </div>
            <div className="text__container">
                {process.map((txt, index) => {
                    const { text } = txt
                    return (
                        <div className="text__wrapper" key={index}>
                            <p>{text}</p>
                        </div>
                    )
                })}
            </div>
        </section>
    )
}