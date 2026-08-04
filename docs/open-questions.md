# Open questions — Phases 5–12

Written while working through the remaining phases unattended. Nothing here
blocked the work unless it says **BLOCKING**; where a decision was needed I made
the reversible one and recorded it.

---

## 1. Storefront order URL — assumption made

Customer e-mails link to `{STOREFRONT_PUBLIC_URL}/objednavka/{order_id}`. I could
not verify that route exists in the storefront (it is a separate tree and out of
scope here). If the real path differs, it is one constant —
`orderLink()` in `backend/src/lib/customer-email.ts`.

Same for the balance-payment failure bounce, which redirects to
`{STOREFRONT_PUBLIC_URL}/doplatek?stav=…`.

## 2. `payment-received` five-minute rule

§16 says to skip „Platba přijata" when the capture happens at effectively the
same moment as the order, to avoid two near-identical mails. I chose **five
minutes** as the threshold. Arbitrary but safe: a ComGate capture on a normal
card payment lands within seconds, so anything later genuinely is a separate
event worth announcing.

## 3. Personal collection reuses the „doručeno" template

A collected order has no shipment to track, so `shipment.created` for a personal
pickup sends **`order-delivered`** rather than `order-shipment` — telling
somebody who just walked out with the piece to „track your parcel" would be
absurd. Worth a look during the copy pass.

## 4. E-mail copy has not been reviewed by a human

The templates were written before this work and I have wired them, not rewritten
them. P5-4 tightened subjects and data, but nobody has read the bodies as a
customer. Recommend one pass through the previews (`pnpm dev:email`) before the
shop takes real orders.
