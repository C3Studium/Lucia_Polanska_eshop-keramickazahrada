import { Metadata } from "next"
import s from "../styles/profile.module.scss"

import { notFound, redirect } from "next/navigation"
import { listRegions } from "@lib/data/regions"
import { retrieveCustomer } from "@lib/data/customer"
import ProfileTemplate from "@modules/account/templates/profile-template"

export const metadata: Metadata = {
  title: "Můj profil",
  description: "Správa kontaktních a osobních údajů.",
}

export default async function Profile() {
  const customer = await retrieveCustomer()
  const regions = await listRegions()

  /*
   * Signed out is a redirect, not a 404 — telling someone their account does not exist because
   * their session expired is both wrong and a dead end. No country code needed: the middleware
   * resolves `/account` to the visitor's region and lands them on the login form.
   */
  if (!customer) {
    redirect("/account")
  }

  /* Missing regions is a real failure, and stays one. */
  if (!regions) {
    notFound()
  }

  // WIP: add password change functionality to the profile page

  return (
    <main className={s.root}>
      <ProfileTemplate customer={customer} regions={regions} />
    </main>
  )
}
