"use server"

/**
 * The shop's voice — vacation + announcements from the backend
 * (GET /store/shop-status, public). Cached briefly: the banner may lag a
 * minute behind the admin, never a day.
 */
export type ShopStatus = {
  vacation: { until: string | null; message: string } | null
  announcement: { message: string; link?: string | null } | null
  commissions_paused: boolean
}

export async function getShopStatus(): Promise<ShopStatus | null> {
  const base =
    process.env.MEDUSA_BACKEND_URL ||
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
  if (!base) return null
  try {
    const response = await fetch(`${base.replace(/\/+$/, "")}/store/shop-status`, {
      next: { revalidate: 60 },
    })
    if (!response.ok) return null
    return (await response.json()) as ShopStatus
  } catch {
    // A missing banner must never break a page.
    return null
  }
}
