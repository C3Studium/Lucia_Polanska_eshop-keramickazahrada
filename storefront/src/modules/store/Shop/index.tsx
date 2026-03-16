"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Categories from "./Category";
import ProductList from "./List";
import NewsLetter from "./NewsLetter";
import SearchBar from "./SearchBar";
import Image from "next/image";
import { HttpTypes } from "@medusajs/types";
import { sdk } from "@lib/config";
import { getProductPrice } from "@lib/util/get-product-price";

type EComProps = {
  countryCode: string
  products: HttpTypes.StoreProduct[]
  categories?: HttpTypes.StoreProductCategory[]
  regionId?: string
}

const PRODUCT_LIMIT = 16;

const priceRangeDefs = [
  { min: 0, max: 300, label: "0 - 300" },
  { min: 300, max: 500, label: "300 - 500" },
  { min: 500, max: 1000, label: "500 - 1 000" },
  { min: 1000, max: 2500, label: "1 000 - 2 500" },
  { min: 2500, max: Infinity, label: "2 500+" },
];

const ECom = ({
  countryCode,
  products: initialProducts,
  categories = [],
  regionId,
}: EComProps) => {
  // Filter states
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory ] = useState("")
  const [pendingCategory, setPendingCategory] = useState("");
  const [search, setSearch] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [sale, setSale] = useState(false);
  const [isNew, setIsNew] = useState(false);

  // Infinite scroll & memoization
  const [products, setProducts] = useState<HttpTypes.StoreProduct[]>(initialProducts);
  const [offset, setOffset] = useState(initialProducts.length);
  const [loading, setLoading] = useState(false);
  const [allLoaded, setAllLoaded] = useState(false);

  const productListRef = useRef<HTMLDivElement>(null);

  // Enrich products with price info
  const enrichedProducts = useMemo(() =>
    products.map(product => {
      const { cheapestPrice } = getProductPrice({ product });
      return {
        ...product,
        cheapestPrice,
      };
    })
  , [products]);

  // Filtering logic
  const filteredProducts = useMemo(() => {
    let result = enrichedProducts;
    if (category) {
      const selectedCategory = categories.find(cat => cat.name === category);
      if (selectedCategory && Array.isArray(selectedCategory.products) && selectedCategory.products.length > 0) {
        const categoryProductIds = selectedCategory.products.map(p => p.id);
        result = result.filter(product => categoryProductIds.includes(product.id));

        if(subcategory) {
          result = result.filter(p => p.type?.value === subcategory && categoryProductIds.includes(p.id))
        }
      } else {
        return [];
      }
    } else if (subcategory) {
      // subcategory selected without category
      const allTypes = enrichedProducts.map(p => p.type?.value)
      if (!allTypes.includes(subcategory)) return []
      result = result.filter(p => p.type?.value === subcategory)
    }

    if(subcategory) {
      const allTypes = enrichedProducts.map(p => p.type?.value)
      if ( !allTypes.includes(subcategory)) {
        return []
      }
      result = result.filter(product => product.type?.value === subcategory)
    }
    if (priceRange) {
      const rangeDef = priceRangeDefs.find(r => r.label === priceRange);
      if (!rangeDef) return [];
      result = result.filter(product => {
        const price = Number(product.cheapestPrice?.calculated_price_number ?? NaN);
        if (isNaN(price)) return false;
        if (rangeDef.max === Infinity) {
          return price >= rangeDef.min;
        }
        return price >= rangeDef.min && price <= rangeDef.max;
      });
    }
    if (sale) {
      result = result.filter(product =>
        product.cheapestPrice?.price_type === "sale"
      );
    }
    if (isNew) {
      result = result.filter(product => product.created_at && new Date(product.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    }
    if (search) {
      result = result.filter(product =>
        product.title?.toLowerCase().includes(search.toLowerCase()) ||
        product.categories?.some(cat =>
          cat.name?.toLowerCase().includes(search.toLowerCase())
        ) || 
        product.type?.value.toLowerCase().includes(search.toLowerCase())
      );
    }
    return result;
  }, [enrichedProducts, category, priceRange, sale, isNew, search]);

  // Pagination logic (client-side, infinite scroll)
  const visibleProducts = useMemo(() => {
    return filteredProducts.slice(0, offset);
  }, [filteredProducts, offset]);

  // Fetch more products if filteredProducts is less than offset and not all loaded
  useEffect(() => {
    if (
      filteredProducts.length < offset &&
      !loading &&
      !allLoaded &&
      products.length < 1000 // or some max you expect
    ) {
      setLoading(true);
      sdk.client
        .fetch<{ products: HttpTypes.StoreProduct[] }>(
          "/store/products",
          {
            method: "GET",
            query: {
              limit: PRODUCT_LIMIT,
              offset: products.length,
              fields: "*bundle",
              region_id: regionId,
            },
          }
        )
        .then(({ products: newProducts }) => {
          if (newProducts.length === 0) setAllLoaded(true);
          setProducts(prev => {
            const ids = new Set(prev.map(p => p.id));
            return [...prev, ...newProducts.filter(p => !ids.has(p.id))];
          });
        })
        .finally(() => setLoading(false));
    }
  }, [filteredProducts.length, offset, loading, allLoaded, products.length, regionId]);

  // Infinite scroll effect (unchanged, but don't add filter params to query)
  useEffect(() => {
    if (loading || allLoaded) return;
    const handleScroll = () => {
      if (!productListRef.current) return;
      const rect = productListRef.current.getBoundingClientRect();
      if (
        window.innerHeight > rect.bottom + 50 &&
        !loading &&
        !allLoaded
      ) {
        setOffset(prev => prev + PRODUCT_LIMIT);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loading, allLoaded]);

  // Reset visible products and scroll when filters change
  useEffect(() => {
    setOffset(PRODUCT_LIMIT);
    setAllLoaded(false);
    window.scrollTo({ top: 25, behavior: "smooth" });
  }, [category, priceRange, sale, isNew, search, initialProducts]);

  // Show all price ranges in the UI
  const priceRanges = priceRangeDefs.map(range => range.label);

  useEffect(() => {
    const saved = localStorage.getItem("shopFilters");
    if (saved) {
      const { category, search, priceRange, sale, isNew } = JSON.parse(saved);
      setCategory(category || "");
      setSearch(search || "");
      setPriceRange(priceRange || "");
      setSale(sale || false);
      setIsNew(isNew || false);
    }
  }, []);

  return (
    <section className="ecom">
      <Categories
        category={category}
        setCategoryAction={setCategory}
        subcategory={subcategory}
        setSubcategoryAction={setSubcategory}
        categories={categories}
      />
      <div className="products__container">
        <SearchBar
          products={initialProducts}
          category={category}
          setCategoryAction={setCategory}
          subcategory={subcategory}
          setSubcategoryAction={setSubcategory}
          search={search}
          setSearchAction={setSearch}
          priceRange={priceRange}
          setPriceRangeAction={setPriceRange}
          sale={sale}
          setSaleAction={setSale}
          isNew={isNew}
          setIsNewAction={setIsNew}
          priceRanges={priceRanges}
          categories={categories}
          pendingCategory={pendingCategory}
          setPendingCategoryAction={setPendingCategory}
        />
        <ProductList
          products={visibleProducts}
          countryCode={countryCode}
          ref={productListRef}
        />
        {loading && <div style={{ textAlign: "center", margin: "1rem", color: "var(--Wtext)", fontFamily: "Sansation-Regular" }}>Načítání dalších produktů...</div>}
        {allLoaded && filteredProducts.length <= visibleProducts.length && (
          <div style={{ textAlign: "center", margin: "1rem", color: "var(--Wtext)", fontFamily: "Sansation-Regular" }}>
            Žádné další produkty k zobrazení
          </div>
        )}
      </div>
      <div className="ecom__scroll__to__top"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <button className="scroll__to__top__button">
          <Image
            src="/assets/icons/arrow_up_white.svg"
            alt="Scroll to top icon"
            width={20}
            height={20}
            className="scroll__to__top__icon"
            aria-label="Scroll to top"
          />
        </button>
      </div>
    </section>
  );
}

export default ECom