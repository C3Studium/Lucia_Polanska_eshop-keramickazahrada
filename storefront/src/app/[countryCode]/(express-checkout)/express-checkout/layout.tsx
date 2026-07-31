import GlobalLiquidEther from "@modules/layout/components/global-liquid-ether"
import Image from "next/image"
import Link from "next/link"
import styles from "./style.module.scss"

export default async function Layout ({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await params

  return (
    <>
      <GlobalLiquidEther />
      <section className={styles.shell}>
        <div className={styles.frame}>
          <header className={styles.brandHeader}>
            <Link
              href={`/${countryCode}`}
              className={styles.brand}
              aria-label="Keramická zahrada — zpět do obchodu"
            >
              <Image
                src="/assets/icons/logo.svg"
                alt=""
                width={54}
                height={32}
              />
              <span>
                Keramická <em>zahrada.</em>
              </span>
            </Link>
          </header>
          <div className={styles.flow}>
            {children}
          </div>
        </div>
      </section>
    </>
  )
}
