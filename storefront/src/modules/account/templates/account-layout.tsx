import React from "react"

import AccountNav from "../components/account-nav"
import { HttpTypes } from "@medusajs/types"
import s from "./styles/account-layout.module.scss"

interface AccountLayoutProps {
  customer: HttpTypes.StoreCustomer | null
  children: React.ReactNode
}

const AccountLayout: React.FC<AccountLayoutProps> = ({
  customer,
  children,
}) => {
  const isVerified = customer?.metadata?.email_verified as boolean

  return (
    <div className={s.section} data-testid="account-page">
      {customer && isVerified && (
        <div className={s.archiveWord} aria-hidden="true">ARCHIV</div>
      )}
      <div className={s.container}>
        {customer && isVerified && (
          <div className={s.verifiedGrid}>
            <div className={s.nav}>
              <AccountNav customer={customer} />
            </div>
            <div className={s.children}>
              {children}
            </div>
          </div>
        )}
        {!customer && (
          <div className={s.center}>
            {children}
          </div>
        )}
       {customer && !isVerified && (
         <div className={s.centerZ1}>
          {children}
        </div>
       )}
      </div>
    </div>
  )
}

export default AccountLayout
