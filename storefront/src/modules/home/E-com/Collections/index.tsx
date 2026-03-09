"use client";
import { usePathname } from "next/navigation";
import { HorizontalItem, VerticalItem } from "./item";

const collections = [
    {
        id: 1,
        title: "Nové kolekce",
        description: "Objevte naše nejnovější kolekce, které přinášejí svěží design a inovativní produkty pro váš domov.",
        image: "/assets/img/flowerphoto.png",
        href: "/collections/1",
        item: VerticalItem
    },
    {
        id: 2,
        title: "Nejprodávanější",
        description: "Prohlédněte si naše nejprodávanější produkty, které si zákazníci zamilovali pro jejich kvalitu a styl.",
        image: "/assets/img/bearphoto.png",
        href: "/collections/2",
        item: HorizontalItem
    },
    {
        id: 3,
        title: "Limitované edice",
        description: "Nenechte si ujít naše limitované edice, které nabízejí exkluzivní designy a unikátní produkty pro váš domov.",
        image: "/assets/img/bearphoto.png",
        href: "/collections/3",
        item: HorizontalItem
    },
    {
        id: 4,
        title: "Dárkové sady",
        description: "Objevte naše dárkové sady, které jsou perfektním dárkem pro vaše blízké a přinášejí radost a styl do každého domova.",
        image: "/assets/img/flowerphoto.png",
        href: "/collections/4",
        item: VerticalItem
    },
    {
        id: 5,
        title: "Kolekce pro venkovní prostory",
        description: "Prohlédněte si naši kolekci pro venkovní prostory, která nabízí odolné a stylové produkty pro vaši zahradu a terasu.",
        image: "/assets/img/bearphoto.png",
        href: "/collections/5",
        item: HorizontalItem
    },
    {
        id: 6,
        title: "Kolekce pro interiéry",
        description: "Prohlédněte si naši kolekci pro interiéry, která nabízí elegantní a stylové produkty pro vaše domácnosti.",
        image: "/assets/img/bearphoto.png",
        href: "/collections/6",
        item: HorizontalItem
    },
]
// najít způsob jak správně lokalizovat kolekce, tak aby byly správně za sebou s jejich obrázky, ty se asi budou muset přidat. 
// Nejdříve sem vrazit kolekce, potom zjisit kde jaká je, potom doplnit obrázkem a textem. 


export default function Collections() {

    const pathname = usePathname();
    // find the collection by its actual name and use its name for different shape of the collection item

    return (
        <section className="Collections">
            <div className="sticky">
                <div className="sticky__Wrapper">
                    <div className="header">
                        <p>
                            100% RUČNÍ PRACÍ NENÍ MOŽNÉ <br /> DOSÁHNOUT DVAKRÁT STEJNÉHO <br />VZHLEDU. ALE PRÁVĚ PROTO <br />JE KAŽDÝ KUS ORIGINÁL.
                        </p>
                    </div>
                    <div className="Collecion__wrapper">
                        {collections.map((collection) => (
                            <collection.item collection={collection} key={collection.id}/>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}