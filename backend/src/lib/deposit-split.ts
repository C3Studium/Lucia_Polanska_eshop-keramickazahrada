/**
 * Splitting a customer-chosen payment across made-to-order lines.
 *
 * ## The rule this implements
 *
 * Customers never get „pay later". For commissions they instead choose *how
 * much* to pay now — a slider — bounded below by the owner's per-product
 * minimum and above by the full price. The floor is
 * `default_deposit_percentage` (variant override wins) and the slider UI is a
 * courtesy: **this module, called server-side, is the guard.**
 *
 * ## Why one shared function
 *
 * Two places compute money for the same choice: the checkout summary
 * (`production-payment-mode` route) and the payment itself
 * (`prepare-made-to-order-payment` workflow). If they each did their own
 * arithmetic the number the customer read and the number they were charged
 * would drift — the exact failure the old two-radio design avoided by
 * returning server-computed amounts. The slider keeps that property only if
 * both callers share the arithmetic, so here it is, importable by both and
 * unit-tested once.
 *
 * ## How the extra is distributed
 *
 * The chosen production payment `P` lies in `[Σfloor, Σceiling]`. Each line is
 * paid its floor, and the surplus `P − Σfloor` is spread **proportionally to
 * each line's headroom** (`ceiling − floor`). Proportional, because any other
 * rule (fill lines in order, evenly in absolute terms) pays off some
 * commissions faster than others for no reason the owner or customer chose —
 * and the per-line `deposit_amount` snapshots feed the production order's
 * outstanding sums, so they must reflect what was genuinely allotted to that
 * line.
 *
 * A line whose product forbids full prepayment contributes **zero headroom**
 * (its ceiling equals its floor): the slider simply cannot route money to it
 * beyond the minimum, which is what `allow_full_prepayment: false` means.
 *
 * ## Rounding
 *
 * Amounts are korunas with haléře, so every intermediate rounds to 2 dp and
 * the **last line with headroom absorbs the drift**, making the per-line sum
 * exactly equal the clamped target. Without that, a 3-line split of 0.10 Kč
 * surplus can sum a haléř off — invisible in the UI, but `agreed_total − paid`
 * would never reach zero and the order would owe 0.01 forever.
 */

export type DepositSplitLine = {
  /** Owner's minimum for this line — deposit at the floor percentage. */
  floor: number
  /** The most this line can take now — line total, or `floor` when full prepayment is forbidden. */
  ceiling: number
}

export type DepositSplitResult = {
  /** The production payment actually applied, after clamping. */
  applied: number
  /** Per-line amounts, same order as input, summing exactly to `applied`. */
  amounts: number[]
  /** True when the requested target had to be clamped to stay legal. */
  clamped: boolean
}

const round = (value: number) => Math.round(value * 100) / 100

/**
 * Distributes `target` across `lines`, clamping into `[Σfloor, Σceiling]`.
 *
 * Never throws on an out-of-range target — the caller decides whether an
 * illegal request is a 400 (checkout, where the customer can correct it) or a
 * silent clamp (payment prep, where the cart may have changed since the
 * choice was stored and failing the whole payment over it helps nobody).
 */
export const splitCustomPayment = (
  lines: DepositSplitLine[],
  target: number
): DepositSplitResult => {
  const floors = lines.map((line) => round(Math.max(0, line.floor)))
  const ceilings = lines.map((line, index) =>
    round(Math.max(floors[index], line.ceiling))
  )

  const floorSum = round(floors.reduce((sum, value) => sum + value, 0))
  const ceilingSum = round(ceilings.reduce((sum, value) => sum + value, 0))

  const applied = round(
    Math.min(ceilingSum, Math.max(floorSum, round(target)))
  )
  const clamped = applied !== round(target)

  let surplus = round(applied - floorSum)
  const headrooms = lines.map((_, index) =>
    round(ceilings[index] - floors[index])
  )
  const headroomSum = round(headrooms.reduce((sum, value) => sum + value, 0))

  const amounts = [...floors]

  if (surplus > 0 && headroomSum > 0) {
    let lastWithHeadroom = -1
    for (let index = 0; index < lines.length; index++) {
      if (headrooms[index] > 0) {
        lastWithHeadroom = index
      }
    }

    let distributed = 0
    for (let index = 0; index < lines.length; index++) {
      if (headrooms[index] <= 0) {
        continue
      }
      const share =
        index === lastWithHeadroom
          ? round(surplus - distributed) // absorb rounding drift
          : round((surplus * headrooms[index]) / headroomSum)
      const granted = Math.min(share, headrooms[index])
      amounts[index] = round(amounts[index] + granted)
      distributed = round(distributed + granted)
    }

    // If the drift-absorbing last line hit its own ceiling, sweep the
    // remainder into any line that still has room. One pass suffices: the
    // target is already clamped to Σceiling, so room exists somewhere.
    let remainder = round(surplus - distributed)
    for (let index = 0; remainder > 0 && index < lines.length; index++) {
      const room = round(ceilings[index] - amounts[index])
      if (room <= 0) {
        continue
      }
      const granted = Math.min(room, remainder)
      amounts[index] = round(amounts[index] + granted)
      remainder = round(remainder - granted)
    }
  }

  return { applied, amounts, clamped }
}
