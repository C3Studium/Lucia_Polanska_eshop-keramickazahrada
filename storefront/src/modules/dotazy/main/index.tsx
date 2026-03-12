import Image from "next/image"

const Images = [
    {
        src: "/assets/img/faq/FAQ1.png",
        alt: "packaking"
    },
    {
        src: "/assets/img/faq/FAQ2.png",
        alt: "owner"
    },
    {
        src: "/assets/img/faq/FAQ3.png",
        alt: "cat ceramic product"
    }
]

export default function DotazyMain () {
    return (
        <section className="DotazyMain">
            <div className="Images">
                { Images.map((img, index) => {
                    const { src, alt } = img
                    return (
                        <div className="image__wrapper">
                            <Image src={src} alt={alt} fill />
                        </div>
                    )
                })}
            </div> 

            <div className="Text">
                <h1>FAQ</h1>
            </div>
        </section>
    )
}