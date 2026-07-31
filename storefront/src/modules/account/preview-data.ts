/**
 * Development-only account previews.
 *
 * The account pages use these records only when the backend returns an empty
 * collection in development. Production always renders real customer data or
 * the real empty state.
 */
export const accountPreviewReviews = [
  {
    id: "preview-review-01",
    title: "Objekt, který zklidnil celý stůl",
    content:
      "Naživo je ještě jemnější než na fotografii. Glazura se během dne mění se světlem a každý kus působí opravdu osobně.",
    rating: 5,
    created_at: "2026-06-18T10:30:00.000Z",
    product: {
      title: "Vlčí mák",
      thumbnail: "/assets/img/flowerphoto.png",
    },
  },
  {
    id: "preview-review-02",
    title: "Krásná ruční práce",
    content:
      "Balíček dorazil bezpečně a samotný objekt má příjemnou váhu i strukturu. Je vidět, že vznikal pomalu a pečlivě.",
    rating: 5,
    created_at: "2026-05-02T16:45:00.000Z",
    product: {
      title: "Pomněnka",
      thumbnail: "/assets/img/image14.png",
    },
  },
  {
    id: "preview-review-03",
    title: "Dárek, který si našel své místo",
    content:
      "Kupovala jsem jej jako dárek, ale nejraději bych si ho nechala. Barvy jsou přirozené a zpracování velmi čisté.",
    rating: 4,
    created_at: "2026-03-21T09:15:00.000Z",
    product: {
      title: "Keramický list",
      thumbnail: "/assets/img/image15.png",
    },
  },
]

export const accountPreviewWishlistItems = [
  {
    id: "preview-wishlist-01",
    product_variant: {
      title: "Základ",
      options: [{ value: "Přírodní" }],
      product: {
        title: "Vlčí mák",
        thumbnail: "/assets/img/flowerphoto.png",
      },
    },
  },
  {
    id: "preview-wishlist-02",
    product_variant: {
      title: "Základ",
      options: [{ value: "Ateliérová série" }],
      product: {
        title: "Pomněnka",
        thumbnail: "/assets/img/image14.png",
      },
    },
  },
  {
    id: "preview-wishlist-03",
    product_variant: {
      title: "Základ",
      options: [{ value: "Ručně modelováno" }],
      product: {
        title: "Keramický list",
        thumbnail: "/assets/img/image15.png",
      },
    },
  },
]
