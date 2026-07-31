import styles from "./styles/addresses-template.module.scss"


import { HttpTypes } from "@medusajs/types"
import AddressBook from "../components/address-book"
import { AccountPageReveal, AccountSectionReveal } from "../components/account-page-reveal"

type AddressesTemplateProps = {
    customer: HttpTypes.StoreCustomer
    region: HttpTypes.StoreRegion
}

export const AddressesTemplate = ({ customer, region }: AddressesTemplateProps) => {
    return (
        <section className={styles.content}>
            <AccountPageReveal className={styles.content} data-testid="addresses-page-wrapper">
                <AccountSectionReveal>
                <div className={styles.header}>
                    <p className={styles.eyebrow}>Soukromý archiv · doručení</p>
                    <h1 className={styles.title}>
                        Místa <em>doručení.</em>
                    </h1>
                    <Divider />
                    <p className={styles.desc}>
                        Uložte místa, kam mají vaše další objekty bezpečně
                        dorazit. Při příští objednávce je nabídneme automaticky.
                    </p>
                </div>
                </AccountSectionReveal>
                <AccountSectionReveal>
                    <AddressBook customer={customer} region={region} />
                </AccountSectionReveal>
            </AccountPageReveal>
        </section>
    )
}

export default AddressesTemplate

const Divider = () => <div className={styles.divider} />
