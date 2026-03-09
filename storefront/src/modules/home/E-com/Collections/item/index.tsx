import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Button from "@modules/layout/Navbar/button"
import Image from "next/image"

type ItemProps = {
    id: number,
    title : string,
    description: string,
    image : string,
    href : string,
}

export const VerticalItem = ({collection}: {collection: ItemProps}) => {

    return (
        <LocalizedClientLink href={collection.href} className="vertical__item__wrapper" id={`collection-${collection.id}`}>
            <div className="image__container">
                <div className="black"/>
                <Image src={collection.image} alt={collection.title} fill/>
            </div>
            <div className="Item__content">
                <Button
                    // create a new button for this fitting the correct design and animation purpises
                title="Zobrazit" href={collection.href} img="/assets/links/home_img.png" alt={`View ${collection.title}`}/>
                <h3>{collection.title}</h3>
                <p>
                    {collection.description}
                </p>
            </div>
        </LocalizedClientLink>
    )
}

export const HorizontalItem = ({collection}: {collection: ItemProps}) => {

    return (
        <LocalizedClientLink href={collection.href} className="horizontal__item__wrapper" id={`collection-${collection.id}`}>
            <div className="image__container">
                <div className="black"/>
                <Image src={collection.image} alt={collection.title} fill/>
            </div>
            <div className="Item__content">
                <Button title="Zobrazit" href={collection.href} img="/assets/links/home_img.png" alt={`View ${collection.title}`}/>
                <h3>{collection.title}</h3>
                <p>
                    {collection.description}
                </p>
            </div>
        </LocalizedClientLink>
    )
}
