import Image from "next/image"

const galleryArray= [
{
    src:"/assets/img/vyroba/1.png",
    alt:"navrh",
    text:"VŠECHNO ZAČÍNÁ POZOROVÁNÍM. V PŘÍRODĚ HLEDÁM TVAR, RYTMUS, PROPORCI I KLID — STRUKTURU POVRCHŮ, PŘIROZENÉ KŘIVKY, JEMNÉ NEPRAVIDELNOSTI I BAREVNOST, KTERÁ NEVZNIKÁ EFEKTEM, ALE ČASEM A MATERIÁLEM. Z TĚCHTO PODNĚTŮ VZNIKÁ PRVNÍ MYŠLENKA: K ČEMU BUDE VÝROBEK SLOUŽIT, JAK SE BUDE DRŽET V RUCE, JAK SE BUDE POUŽÍVAT A JAK BUDE PŮSOBIT V PROSTORU. NÁVRH PRO MĚ NENÍ JEN ESTETIKA. JE TO ROVNOVÁHA MEZI FUNKCÍ A CHARAKTEREM. ŘEŠÍM TLOUŠŤKU STĚN, STABILITU, ERGONOMII, OBJEM I DETAIL OKRAJE, KTERÝ ROZHODUJE O TOM, JAK SE Z VÝROBKU PIJE NEBO JAK SE S NÍM PRACUJE. TEPRVE KDYŽ JE FORMA I SMYSL JASNÝ, PŘICHÁZÍ ROZHODNUTÍ O POVRCHU, BARVĚ A PŘÍPADNÉM DEKORU.",
    title: "1. Návrh"
},
{
    src:"/assets/img/vyroba/2.png",
    alt:"modelovani",
    text:"VŠECHNO ZAČÍNÁ POZOROVÁNÍM. V PŘÍRODĚ HLEDÁM TVAR, RYTMUS, PROPORCI I KLID — STRUKTURU POVRCHŮ, PŘIROZENÉ KŘIVKY, JEMNÉ NEPRAVIDELNOSTI I BAREVNOST, KTERÁ NEVZNIKÁ EFEKTEM, ALE ČASEM A MATERIÁLEM. Z TĚCHTO PODNĚTŮ VZNIKÁ PRVNÍ MYŠLENKA: K ČEMU BUDE VÝROBEK SLOUŽIT, JAK SE BUDE DRŽET V RUCE, JAK SE BUDE POUŽÍVAT A JAK BUDE PŮSOBIT V PROSTORU. NÁVRH PRO MĚ NENÍ JEN ESTETIKA. JE TO ROVNOVÁHA MEZI FUNKCÍ A CHARAKTEREM. ŘEŠÍM TLOUŠŤKU STĚN, STABILITU, ERGONOMII, OBJEM I DETAIL OKRAJE, KTERÝ ROZHODUJE O TOM, JAK SE Z VÝROBKU PIJE NEBO JAK SE S NÍM PRACUJE. TEPRVE KDYŽ JE FORMA I SMYSL JASNÝ, PŘICHÁZÍ ROZHODNUTÍ O POVRCHU, BARVĚ A PŘÍPADNÉM DEKORU.",
    title: "2. Modelování"
},
{
    src:"/assets/img/vyroba/3.png",
    alt:"schnuti",
    text:"VŠECHNO ZAČÍNÁ POZOROVÁNÍM. V PŘÍRODĚ HLEDÁM TVAR, RYTMUS, PROPORCI I KLID — STRUKTURU POVRCHŮ, PŘIROZENÉ KŘIVKY, JEMNÉ NEPRAVIDELNOSTI I BAREVNOST, KTERÁ NEVZNIKÁ EFEKTEM, ALE ČASEM A MATERIÁLEM. Z TĚCHTO PODNĚTŮ VZNIKÁ PRVNÍ MYŠLENKA: K ČEMU BUDE VÝROBEK SLOUŽIT, JAK SE BUDE DRŽET V RUCE, JAK SE BUDE POUŽÍVAT A JAK BUDE PŮSOBIT V PROSTORU. NÁVRH PRO MĚ NENÍ JEN ESTETIKA. JE TO ROVNOVÁHA MEZI FUNKCÍ A CHARAKTEREM. ŘEŠÍM TLOUŠŤKU STĚN, STABILITU, ERGONOMII, OBJEM I DETAIL OKRAJE, KTERÝ ROZHODUJE O TOM, JAK SE Z VÝROBKU PIJE NEBO JAK SE S NÍM PRACUJE. TEPRVE KDYŽ JE FORMA I SMYSL JASNÝ, PŘICHÁZÍ ROZHODNUTÍ O POVRCHU, BARVĚ A PŘÍPADNÉM DEKORU.",
    title: "3. Schnutí"
},
{
    src:"/assets/img/vyroba/4.png",
    alt:"prezah",
    text:"VŠECHNO ZAČÍNÁ POZOROVÁNÍM. V PŘÍRODĚ HLEDÁM TVAR, RYTMUS, PROPORCI I KLID — STRUKTURU POVRCHŮ, PŘIROZENÉ KŘIVKY, JEMNÉ NEPRAVIDELNOSTI I BAREVNOST, KTERÁ NEVZNIKÁ EFEKTEM, ALE ČASEM A MATERIÁLEM. Z TĚCHTO PODNĚTŮ VZNIKÁ PRVNÍ MYŠLENKA: K ČEMU BUDE VÝROBEK SLOUŽIT, JAK SE BUDE DRŽET V RUCE, JAK SE BUDE POUŽÍVAT A JAK BUDE PŮSOBIT V PROSTORU. NÁVRH PRO MĚ NENÍ JEN ESTETIKA. JE TO ROVNOVÁHA MEZI FUNKCÍ A CHARAKTEREM. ŘEŠÍM TLOUŠŤKU STĚN, STABILITU, ERGONOMII, OBJEM I DETAIL OKRAJE, KTERÝ ROZHODUJE O TOM, JAK SE Z VÝROBKU PIJE NEBO JAK SE S NÍM PRACUJE. TEPRVE KDYŽ JE FORMA I SMYSL JASNÝ, PŘICHÁZÍ ROZHODNUTÍ O POVRCHU, BARVĚ A PŘÍPADNÉM DEKORU.",
    title: "4. Přežah"
},
{
    src:"/assets/img/vyroba/5.png",
    alt:"glayurovvani",
    text:"VŠECHNO ZAČÍNÁ POZOROVÁNÍM. V PŘÍRODĚ HLEDÁM TVAR, RYTMUS, PROPORCI I KLID — STRUKTURU POVRCHŮ, PŘIROZENÉ KŘIVKY, JEMNÉ NEPRAVIDELNOSTI I BAREVNOST, KTERÁ NEVZNIKÁ EFEKTEM, ALE ČASEM A MATERIÁLEM. Z TĚCHTO PODNĚTŮ VZNIKÁ PRVNÍ MYŠLENKA: K ČEMU BUDE VÝROBEK SLOUŽIT, JAK SE BUDE DRŽET V RUCE, JAK SE BUDE POUŽÍVAT A JAK BUDE PŮSOBIT V PROSTORU. NÁVRH PRO MĚ NENÍ JEN ESTETIKA. JE TO ROVNOVÁHA MEZI FUNKCÍ A CHARAKTEREM. ŘEŠÍM TLOUŠŤKU STĚN, STABILITU, ERGONOMII, OBJEM I DETAIL OKRAJE, KTERÝ ROZHODUJE O TOM, JAK SE Z VÝROBKU PIJE NEBO JAK SE S NÍM PRACUJE. TEPRVE KDYŽ JE FORMA I SMYSL JASNÝ, PŘICHÁZÍ ROZHODNUTÍ O POVRCHU, BARVĚ A PŘÍPADNÉM DEKORU.",
    title: "5. Dekor"
},
{
    src:"/assets/img/vyroba/6.png",
    alt:"vypal",
    text:"VŠECHNO ZAČÍNÁ POZOROVÁNÍM. V PŘÍRODĚ HLEDÁM TVAR, RYTMUS, PROPORCI I KLID — STRUKTURU POVRCHŮ, PŘIROZENÉ KŘIVKY, JEMNÉ NEPRAVIDELNOSTI I BAREVNOST, KTERÁ NEVZNIKÁ EFEKTEM, ALE ČASEM A MATERIÁLEM. Z TĚCHTO PODNĚTŮ VZNIKÁ PRVNÍ MYŠLENKA: K ČEMU BUDE VÝROBEK SLOUŽIT, JAK SE BUDE DRŽET V RUCE, JAK SE BUDE POUŽÍVAT A JAK BUDE PŮSOBIT V PROSTORU. NÁVRH PRO MĚ NENÍ JEN ESTETIKA. JE TO ROVNOVÁHA MEZI FUNKCÍ A CHARAKTEREM. ŘEŠÍM TLOUŠŤKU STĚN, STABILITU, ERGONOMII, OBJEM I DETAIL OKRAJE, KTERÝ ROZHODUJE O TOM, JAK SE Z VÝROBKU PIJE NEBO JAK SE S NÍM PRACUJE. TEPRVE KDYŽ JE FORMA I SMYSL JASNÝ, PŘICHÁZÍ ROZHODNUTÍ O POVRCHU, BARVĚ A PŘÍPADNÉM DEKORU.",
    title: "6. Výpal"
},
{
    src:"/assets/img/vyroba/6.png",
    alt:"expedice",
    text:"VŠECHNO ZAČÍNÁ POZOROVÁNÍM. V PŘÍRODĚ HLEDÁM TVAR, RYTMUS, PROPORCI I KLID — STRUKTURU POVRCHŮ, PŘIROZENÉ KŘIVKY, JEMNÉ NEPRAVIDELNOSTI I BAREVNOST, KTERÁ NEVZNIKÁ EFEKTEM, ALE ČASEM A MATERIÁLEM. Z TĚCHTO PODNĚTŮ VZNIKÁ PRVNÍ MYŠLENKA: K ČEMU BUDE VÝROBEK SLOUŽIT, JAK SE BUDE DRŽET V RUCE, JAK SE BUDE POUŽÍVAT A JAK BUDE PŮSOBIT V PROSTORU. NÁVRH PRO MĚ NENÍ JEN ESTETIKA. JE TO ROVNOVÁHA MEZI FUNKCÍ A CHARAKTEREM. ŘEŠÍM TLOUŠŤKU STĚN, STABILITU, ERGONOMII, OBJEM I DETAIL OKRAJE, KTERÝ ROZHODUJE O TOM, JAK SE Z VÝROBKU PIJE NEBO JAK SE S NÍM PRACUJE. TEPRVE KDYŽ JE FORMA I SMYSL JASNÝ, PŘICHÁZÍ ROZHODNUTÍ O POVRCHU, BARVĚ A PŘÍPADNÉM DEKORU.",
    title: "7. Expedice"
},

]

const Gallery = () => {
    const totalHeigt = galleryArray.length * 100

    return (
        <section className="Gallery" style={{ height: `${totalHeigt}vh`}}>
            <div className="galerry__sections">
                {galleryArray.map((item, index) => {
                    const {src, alt, text} = item
                    return (
                        <div className="proces" key={`gallery__vyroba${index}`}>
                            <p> 
                                {text}
                            </p>
                            <div className="img__gallery">
                                <Image src={src} alt={alt} fill />
                                <div className="overlay"/>
                            </div>
                        </div>

                    )
                })}
            </div>
            <div className="progress__bar">
                { galleryArray.map((item, index) => {
                    const { title } = item

                    return (
                        <div className="progress__bar__item" key={index}>
                            <p>{title}</p>
                            <div className="progress__line"/>
                        </div>
                    )
                })}
            </div>
        </section>
    )
}
export default Gallery