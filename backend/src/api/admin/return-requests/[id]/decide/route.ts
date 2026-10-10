import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { sendCustomerEmail } from "../../../../../lib/customer-email"
import { getMerchantSettings } from "../../../../../lib/merchant-settings"
import {
  claimEmailBase,
  claimService,
  decisionOutcome,
  regenerateProtocol,
  retrieveClaim,
} from "../../../../../lib/claims/admin"
import {
  RESOLUTIONS,
  type Resolution,
} from "../../../../../lib/claims/constants"
import { claimItemsText } from "../../../../../lib/claims/line-items"
import { goodsShipped, loadOrderMoney } from "../../../../../lib/claims/money"
import { MONEY_EPSILON } from "../../../../../lib/claims/refund-rules"
import { refundClaim } from "../../../../../lib/claims/refund-action"
import { cancelOrderForClaim } from "../../../../../lib/claims/cancel-order-action"

/**
 * POST /admin/return-requests/:id/decide — her one decision on a request
 * (docs/reklamace-a-zruseni.md §4).
 *
 * `approve` u reklamace vyžaduje `resolution` (oprava / výměna / sleva /
 * vrácení peněz — §2169–2172); u odstoupení a vrácení je to vždy vrácení peněz
 * a doplní se samo. `reject` requires a note, because the note *is* the
 * customer-visible reason in „return-rejected" (§19/3 ZOS: zamítnutí písemně
 * odůvodnit). Either way the request leaves the pending queue and cannot be
 * decided twice.
 */

type DecideBody = {
  decision?: "approve" | "reject"
  note?: string | null
  resolution?: string | null
  /**
   * Odstoupení / vrácení: rovnou vrátit vše, co zbývá (ComGate), a žádost
   * vyřídit — jedno kliknutí místo „Schválit → Vrátit peníze". U zboží, které
   * už odešlo, je to vědomé vzdání se čekání na zásilku (§ 1832/4).
   */
  refund_now?: boolean
  /** Po vyřízení rovnou zrušit objednávku a uvolnit sklad (jen když nic nezbývá). */
  cancel_order?: boolean
}

/** Lhůta do e-mailu „schváleno" — podle druhu a způsobu vyřízení. */
const deadlineCopy = (kind: string | null, resolution: Resolution): string => {
  if (kind === "reklamace") {
    return "vyřídíme do 30 dnů od uplatnění reklamace"
  }
  return resolution === "discount"
    ? "část ceny vrátíme do 14 dnů"
    : "peníze vrátíme do 14 dnů od přijetí zboží"
}

export const POST = async (
  req: MedusaRequest<DecideBody>,
  res: MedusaResponse
) => {
  const body = (req.body || {}) as DecideBody
  if (body.decision !== "approve" && body.decision !== "reject") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Neplatné rozhodnutí — očekává se „approve“, nebo „reject“."
    )
  }
  const note = typeof body.note === "string" ? body.note.trim() : ""
  if (body.decision === "reject" && !note) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Důvod zamítnutí je povinný — zákazník ho uvidí v e-mailu i v protokolu."
    )
  }

  const service = claimService(req.scope)
  const request = await retrieveClaim(req.scope, req.params.id)
  if (request.status !== "pending") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Žádost už byla rozhodnuta."
    )
  }

  // Způsob vyřízení: u reklamace si ho musí vybrat, u odstoupení/vrácení je
  // jediný možný. Zamítnutí žádný nemá.
  let resolution: Resolution | null = null
  if (body.decision === "approve") {
    if (request.kind === "reklamace") {
      if (!(RESOLUTIONS as readonly string[]).includes(body.resolution ?? "")) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "U reklamace zvolte způsob vyřízení — oprava, výměna, sleva, nebo vrácení peněz."
        )
      }
      resolution = body.resolution as Resolution
    } else {
      resolution = "refund"
    }
  }

  // Položky slovy — přednostně vybrané `line_items` (název · varianta · ks ·
  // částka), u starých řádků text zákazníka (§11.5).
  const itemsText = claimItemsText(request)

  const decidedAt = new Date()
  // Sdílené s řetězením na konci (refund_now / cancel_order).
  const resolvedNowRef = { value: false }
  const nothingToReturnRef = { value: false }
  const updated = await service.updateReturnRequests({
    id: request.id,
    status: body.decision === "approve" ? "approved" : "rejected",
    decision_note: note || null,
    decided_at: decidedAt,
    resolution,
  })

  // Protokol se dogeneruje s ROZHODNUTÍM (způsob + datum + poznámka). Číslo
  // zůstává; odkaz jde do e-mailu.
  const protocol = await regenerateProtocol(req.scope, updated, {
    outcome: decisionOutcome(updated),
    note: note || null,
    decidedAt,
  })

  if (body.decision === "approve") {
    const settings = await getMerchantSettings(req.scope).catch(() => null)
    const effective = resolution ?? "refund"

    // Odstoupení / vrácení PŘED odesláním (změřeno 9. 10. 2026 na #37, osobní
    // odběr zrušený hned po objednání): zboží nikdy neodešlo, takže zákazník
    // nic neposílá; peníze (jsou-li) jdou rovnou a při nule je žádost
    // vyřízená hned — majitelce zbývá jen „Zrušit objednávku a uvolnit sklad".
    const money =
      request.kind === "odstoupeni" || request.kind === "vraceni"
        ? await loadOrderMoney(req.scope, request.order_id).catch(() => null)
        : null
    const nothingToReturn = Boolean(money && !goodsShipped(money.order))
    const nothingToRefund = Boolean(money && money.state.remaining <= MONEY_EPSILON)
    const resolvedNow = nothingToReturn && nothingToRefund
    resolvedNowRef.value = resolvedNow
    nothingToReturnRef.value = nothingToReturn
    if (resolvedNow) {
      await service.updateReturnRequests({
        id: request.id,
        status: "resolved",
        resolved_at: decidedAt,
        resolution_note:
          "Objednávka neodešla a nebylo nic zaplaceno — není co vracet; zbývá zrušit objednávku.",
      })
    }
    // NOTE: if she ALSO creates a native Medusa return for this order, the
    // `order.return_requested` subscriber sends its own „return-approved"
    // under a different key — it checks for a decided request here and skips.
    await sendCustomerEmail(req.scope, {
      template: "return-approved",
      to: request.email,
      key: `return-approved:req:${request.id}`,
      orderId: request.order_id,
      data: {
        subject:
          request.kind === "reklamace" ? "Reklamace uznána" : "Vrácení schváleno",
        ...claimEmailBase(updated, protocol.url),
        returnReason: request.reason,
        ...(itemsText ? { approvedItems: itemsText } : {}),
        returnMethod: "Zásilka na adresu ateliéru",
        // Zboží se vrací vždy kromě slevy — ta ho nechává u zákazníka — a kromě
        // odstoupení před odesláním, kde nikdy neodešlo.
        goodsReturnRequired: effective !== "discount" && !nothingToReturn,
        nothingToReturn,
        returnAddress:
          settings?.return_address || "Keramická zahrada\nPutim 229\n397 01 Písek",
        ...(settings?.return_instructions?.trim()
          ? { returnInstructions: settings.return_instructions.trim() }
          : {}),
        returnDeadline: nothingToReturn
          ? nothingToRefund
            ? "nebylo zaplaceno — není co vracet"
            : "peníze vrátíme do 14 dnů"
          : deadlineCopy(request.kind ?? null, effective),
      },
    })
  } else {
    // Only what is real: items only when the customer named them, and the
    // rejection reason is her note, verbatim. ČOI věta je v šabloně natvrdo.
    await sendCustomerEmail(req.scope, {
      template: "return-rejected",
      to: request.email,
      key: `return-rejected:${request.id}`,
      orderId: request.order_id,
      data: {
        subject:
          request.kind === "reklamace"
            ? "Reklamaci nemůžeme uznat"
            : "Žádost o vrácení nemůžeme přijmout",
        ...claimEmailBase(updated, protocol.url),
        rejectionReason: note,
        ...(itemsText ? { rejectedItems: itemsText } : {}),
      },
    })
  }

  // „Schválit a vrátit peníze (a zrušit objednávku)" — odstoupení / vrácení
  // v jednom kroku. Refund jde toutéž cestou jako tlačítko „Vrátit peníze";
  // u zboží, které odešlo, se posílá vědomé `skip_goods_check`. Selhání
  // refundu (ComGate) se vrátí jako zpráva — schválení už platí, majitelka to
  // dokončí tlačítkem.
  const canChain =
    body.decision === "approve" &&
    (request.kind === "odstoupeni" || request.kind === "vraceni")
  let refund: Awaited<ReturnType<typeof refundClaim>> | null = null
  let cancel: Awaited<ReturnType<typeof cancelOrderForClaim>> | null = null
  const messages: string[] = ["Žádost schválena — zákazníkovi odešel e-mail."]

  if (canChain && body.refund_now && !resolvedNowRef.value) {
    try {
      refund = await refundClaim(req.scope, request.id, {
        skip_goods_check: nothingToReturnRef.value ? undefined : true,
        mark_resolved: true,
        ...(note ? { note } : {}),
      })
      messages.push(refund.message)
    } catch (error) {
      messages.push(
        `Peníze se nepodařilo vrátit: ${
          error instanceof Error ? error.message : String(error)
        } Dokončete to tlačítkem „Vrátit peníze".`
      )
    }
  }

  if (canChain && body.cancel_order) {
    try {
      cancel = await cancelOrderForClaim(
        req.scope,
        request.id,
        (req as any).auth_context?.actor_id || null
      )
      messages.push(cancel.message)
    } catch (error) {
      messages.push(
        `Objednávka nebyla zrušena: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }

  const latest = await retrieveClaim(req.scope, request.id).catch(() => updated)
  res.status(200).json({
    return_request: { ...latest, protocol_url: latest.protocol_url ?? protocol.url ?? updated.protocol_url },
    refund,
    cancel,
    message: messages.join(" "),
  })
}
