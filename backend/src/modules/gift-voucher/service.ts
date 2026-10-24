import {
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  MedusaService,
} from "@medusajs/framework/utils"
import type { Context } from "@medusajs/framework/types"
import type { EntityManager } from "@medusajs/framework/mikro-orm/knex"
import { GiftVoucher } from "./models/gift-voucher"
import { GiftVoucherRedemption } from "./models/gift-voucher-redemption"
import { generateVoucherCode, voucherState } from "./code"

export type CreateGiftVoucherInput = {
  kind: "physical" | "electronic"
  initial_value: number
  valid_until: Date
  recipient_name?: string | null
  recipient_email?: string | null
  dedication?: string | null
  buyer_name: string
  buyer_email?: string | null
  buyer_phone?: string | null
  note?: string | null
  payment_method: "cash" | "transfer" | "comgate" | "order"
  /** Hotově / převodem zaplaceno rovnou při vystavení. */
  paid?: boolean
  order_id?: string | null
  /** `{line_item_id}#{n}` u kusu koupeného v obchodě. */
  order_line_item_id?: string | null
}

export default class GiftVoucherModuleService extends MedusaService({
  GiftVoucher,
  GiftVoucherRedemption,
}) {
  /** Vystaví poukaz s novým jedinečným kódem (při kolizi zkusí jiný). */
  async issueVoucher(input: CreateGiftVoucherInput) {
    const value = Math.round(Number(input.initial_value))
    if (!(value > 0)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Hodnota poukazu musí být kladná.")
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateVoucherCode()
      const [taken] = await this.listGiftVouchers({ code } as never, { take: 1 } as never)
      if (taken) continue
      const paid = Boolean(input.paid)
      return this.createGiftVouchers({
        code,
        kind: input.kind,
        initial_value: value,
        balance: value,
        valid_until: input.valid_until,
        recipient_name: input.recipient_name || null,
        recipient_email: input.recipient_email || null,
        dedication: input.dedication || null,
        buyer_name: input.buyer_name,
        buyer_email: input.buyer_email || null,
        buyer_phone: input.buyer_phone || null,
        note: input.note || null,
        payment_method: input.payment_method,
        payment_status: paid ? "paid" : "pending",
        paid_at: paid ? new Date() : null,
        order_id: input.order_id || null,
        order_line_item_id: input.order_line_item_id || null,
      } as never)
    }
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Nepodařilo se vygenerovat jedinečný kód poukazu.")
  }

  /**
   * Odečte částku ze zůstatku a zapíše uplatnění — v jedné transakci, se
   * zámkem řádku poukazu, aby dvě současná uplatnění nepřečerpala zůstatek.
   */
  @InjectTransactionManager()
  async redeem(
    voucherId: string,
    input: { amount: number; order_id?: string | null; note?: string | null },
    @MedusaContext() context: Context<EntityManager> = {}
  ) {
    const manager = context.transactionManager!
    const amount = Math.round(Number(input.amount))
    if (!(amount > 0)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Uplatněná částka musí být kladná.")
    }
    const rows = await manager.execute(
      `select id, balance, status, payment_status, valid_until, refunded_at from gift_voucher where id = ? and deleted_at is null for update`,
      [voucherId]
    )
    const row = rows[0] as
      | { id: string; balance: number; status: string; payment_status: string; valid_until: Date; refunded_at: Date | null }
      | undefined
    if (!row) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Poukaz nebyl nalezen.")
    const state = voucherState({ ...row, balance: Number(row.balance) })
    if (state === "refunded") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Za poukaz už se vrátily peníze — uplatnit ho nejde.")
    if (state === "cancelled") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Poukaz je zrušený.")
    if (state === "pending_payment") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Poukaz ještě není zaplacený.")
    if (state === "expired") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Poukazu skončila platnost.")
    if (amount > Number(row.balance)) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Na poukazu zbývá jen ${Number(row.balance).toLocaleString("cs-CZ")} Kč.`
      )
    }
    await this.updateGiftVouchers({ id: voucherId, balance: Number(row.balance) - amount } as never, context)
    return this.createGiftVoucherRedemptions(
      { voucher_id: voucherId, amount, order_id: input.order_id || null, note: input.note || null } as never,
      context
    )
  }

  /** Vrátí uplatněnou částku zpět do zůstatku (odstoupení, překlik). */
  @InjectTransactionManager()
  async reverseRedemption(
    redemptionId: string,
    reverseNote: string | null,
    @MedusaContext() context: Context<EntityManager> = {}
  ) {
    const manager = context.transactionManager!
    const [redemption] = await this.listGiftVoucherRedemptions({ id: redemptionId } as never, {}, context)
    if (!redemption) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Uplatnění nebylo nalezeno.")
    if ((redemption as any).reversed_at) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Toto uplatnění už bylo vrácené.")
    }
    const voucherId = (redemption as any).voucher_id
    const rows = await manager.execute(
      `select id, balance from gift_voucher where id = ? and deleted_at is null for update`,
      [voucherId]
    )
    if (!rows[0]) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Poukaz nebyl nalezen.")
    await this.updateGiftVouchers(
      { id: voucherId, balance: Number(rows[0].balance) + Number((redemption as any).amount) } as never,
      context
    )
    return this.updateGiftVoucherRedemptions(
      { id: redemptionId, reversed_at: new Date(), reverse_note: reverseNote || null } as never,
      context
    )
  }
}
