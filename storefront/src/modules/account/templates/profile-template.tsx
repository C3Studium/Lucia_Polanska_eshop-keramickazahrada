import s from "./styles/profile.module.scss"

import ProfilePhone from "@modules/account/components/profile-phone"
import ProfileBillingAddress from "@modules/account/components/profile-billing-address"
import ProfileEmail from "@modules/account/components/profile-email"
import ProfileName from "@modules/account/components/profile-name"
import ProfilePassword from "@modules/account/components/profile-password"
import {
  AccountPageReveal,
  AccountSectionReveal,
} from "../components/account-page-reveal"

import { HttpTypes } from "@medusajs/types"

type ProfileTemplateProps = {
  customer: HttpTypes.StoreCustomer
  regions: HttpTypes.StoreRegion[]
}

export const ProfileTemplate = ({
  customer,
  regions,
}: ProfileTemplateProps) => {
  return (
    <AccountPageReveal className={s.content} data-testid="profile-page-wrapper">
      <AccountSectionReveal>
        <div className={s.header}>
          <p className={s.eyebrow}>Soukromý archiv · osobní údaje</p>
          <h1 className={s.title}>
            Váš <em>profil.</em>
          </h1>
          <Divider />
          <p className={s.desc}>
            Kontaktní údaje, heslo a fakturační informace přehledně na jednom
            místě.
          </p>
        </div>
      </AccountSectionReveal>
      <AccountSectionReveal className={s.body}>
        <ProfileName customer={customer} />
        <ProfileEmail customer={customer} />
        <ProfilePhone customer={customer} />
        <ProfilePassword customer={customer} />
        <ProfileBillingAddress customer={customer} regions={regions} />
      </AccountSectionReveal>
    </AccountPageReveal>
  )
}

export default ProfileTemplate

const Divider = () => <div className={s.divider} />
