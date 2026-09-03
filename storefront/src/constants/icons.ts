// this folder constants are used to store static data like icons, links, etc.
//
// Ikony tu zůstávají a do CMS nepůjdou: je to chrom rozhraní, ne obsah. Klient
// je needituje a načítat je přes síť by jen zdrželo vykreslení. Obsah, který se
// upravuje, bydlí ve ValeCMS — viz `lib/data/site-copy.ts`.


export const iconLinks = [
    {
        src: "/assets/icons/search.svg",
        alt: "search Icon button",
        width: 24,
        height: 24,
        href: "/store"
    },
    {
        src: "/assets/icons/bookmark.svg",
        alt: "bookmark Icon button",
        width: 24,
        height: 24,
        href: "/account"
    },
    {
        src: "/assets/icons/cart.svg",
        alt: "cart Icon button",
        width: 24,
        height: 24,
        href: "/cart"
    },
    {
        src: "/assets/icons/user.svg",
        alt: "user Icon button",
        width: 30,
        height: 30,
        href: "/account"
    },
];

export const paymentIcons = [
    {
        src: "/assets/icons/comgate.png",
        alt: "Comgate Icon",
        href: "https://www.comgate.cz/",
    },
    {
        src: "/assets/icons/visa.png",
        alt: "Visa Icon",
        href: "https://www.visa.com/",
    },
    {
        src: "/assets/icons/mastercard.png",
        alt: "MasterCard Icon",
        href: "https://www.mastercard.com/",
    },
    {
        src: "/assets/icons/googlepay.png",
        alt: "Google Pay Icon",
        href: "https://pay.google.com/",
    },
    {
        src: "/assets/icons/applepay.png",
        alt: "Apple Pay Icon",
        href: "https://www.apple.com/apple-pay/",
    },
]

export const paymentIconsWhite = [
    {
        src: "/assets/icons/comgate_white.png",
        alt: "Comgate Icon",
        href: "https://www.comgate.cz/",
    },
    {
        src: "/assets/icons/visa_white.png",
        alt: "Visa Icon",
        href: "https://www.visa.com/",
    },
    {
        src: "/assets/icons/mastercard.png",
        alt: "MasterCard Icon",
        href: "https://www.mastercard.com/",
    },
    {
        src: "/assets/icons/googlepay.png",
        alt: "Google Pay Icon",
        href: "https://pay.google.com/",
    },
    {
        src: "/assets/icons/applepay.png",
        alt: "Apple Pay Icon",
        href: "https://www.apple.com/apple-pay/",
    },
]
