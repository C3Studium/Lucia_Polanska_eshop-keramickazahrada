import { recordCampaign, type CampaignHistoryStore } from "../route"

/**
 * The history row's life cycle around drafts: a draft that gets sent must
 * *become* the sent row (one row, whole story), a retried send must add to
 * its existing row instead of duplicating it, and a stray draft left behind
 * by a retry must not haunt the „Rozepsané" list. Faked store, same pattern
 * as the other newsletter specs.
 */

type FakeState = {
  rows: Array<Record<string, unknown>>
  created: Array<Record<string, unknown>>
  updated: Array<Record<string, unknown>>
  softDeleted: string[][]
}

const storeWith = (state: FakeState): CampaignHistoryStore => ({
  listNewsletterCampaigns: async (filter) => {
    const { campaign_key, id, status } = filter as {
      campaign_key?: string
      id?: string
      status?: string
    }
    return state.rows.filter(
      (row) =>
        (campaign_key === undefined || row.campaign_key === campaign_key) &&
        (id === undefined || row.id === id) &&
        (status === undefined || row.status === status)
    )
  },
  createNewsletterCampaigns: async (data) => {
    state.created.push(data as Record<string, unknown>)
    return data
  },
  updateNewsletterCampaigns: async (data) => {
    state.updated.push(data as Record<string, unknown>)
    return data
  },
  softDeleteNewsletterCampaigns: async (ids) => {
    state.softDeleted.push(ids)
    return ids
  },
})

const baseInput = {
  campaign_key: "blocks:2026-08-19:abc",
  subject: "Nové objekty",
  preheader: "Z pece",
  blocks: [{ type: "paragraph", text: "Ahoj", runs: [{ text: "Ahoj" }] }] as never,
  sent: 12,
  tag: "blocks_2026-08-19_abc-12345678",
}

describe("recordCampaign", () => {
  it("upgrades the named draft into the sent history row", async () => {
    const state: FakeState = {
      rows: [
        {
          id: "camp_draft",
          campaign_key: "draft:uuid-1",
          status: "draft",
          recipients: null,
          sent_at: null,
        },
      ],
      created: [],
      updated: [],
      softDeleted: [],
    }

    await recordCampaign(storeWith(state), {
      ...baseInput,
      draft_id: "camp_draft",
    })

    expect(state.created).toEqual([])
    expect(state.updated).toHaveLength(1)
    expect(state.updated[0]).toMatchObject({
      id: "camp_draft",
      campaign_key: "blocks:2026-08-19:abc",
      subject: "Nové objekty",
      recipients: 12,
      status: "sent",
      tag: "blocks_2026-08-19_abc-12345678",
    })
    expect(state.updated[0].sent_at).toBeInstanceOf(Date)
  })

  it("adds a retried send to the existing row and clears the leftover draft", async () => {
    const state: FakeState = {
      rows: [
        {
          id: "camp_sent",
          campaign_key: "blocks:2026-08-19:abc",
          status: "sent",
          recipients: 10,
          sent_at: new Date("2026-08-19T08:00:00Z"),
        },
        {
          id: "camp_draft",
          campaign_key: "draft:uuid-1",
          status: "draft",
        },
      ],
      created: [],
      updated: [],
      softDeleted: [],
    }

    await recordCampaign(storeWith(state), {
      ...baseInput,
      sent: 2,
      draft_id: "camp_draft",
    })

    expect(state.created).toEqual([])
    expect(state.updated[0]).toMatchObject({
      id: "camp_sent",
      recipients: 12,
      status: "sent",
    })
    // The existing row keeps its original send date.
    expect(state.updated[0].sent_at).toEqual(new Date("2026-08-19T08:00:00Z"))
    expect(state.softDeleted).toEqual([["camp_draft"]])
  })

  it("creates a fresh sent row when there is no draft and no existing key", async () => {
    const state: FakeState = { rows: [], created: [], updated: [], softDeleted: [] }

    await recordCampaign(storeWith(state), baseInput)

    expect(state.updated).toEqual([])
    expect(state.created).toHaveLength(1)
    expect(state.created[0]).toMatchObject({
      campaign_key: "blocks:2026-08-19:abc",
      recipients: 12,
      status: "sent",
      tag: "blocks_2026-08-19_abc-12345678",
    })
  })

  it("falls back to creating when the named draft no longer exists", async () => {
    const state: FakeState = { rows: [], created: [], updated: [], softDeleted: [] }

    await recordCampaign(storeWith(state), {
      ...baseInput,
      draft_id: "camp_gone",
    })

    expect(state.created).toHaveLength(1)
    expect(state.updated).toEqual([])
    expect(state.softDeleted).toEqual([])
  })

  it("never treats a sent row as a deletable draft", async () => {
    const state: FakeState = {
      rows: [
        {
          id: "camp_sent",
          campaign_key: "blocks:2026-08-19:abc",
          status: "sent",
          recipients: 10,
          sent_at: new Date("2026-08-19T08:00:00Z"),
        },
      ],
      created: [],
      updated: [],
      softDeleted: [],
    }

    await recordCampaign(storeWith(state), {
      ...baseInput,
      // Pathological caller: draft_id pointing at the sent row itself.
      draft_id: "camp_sent",
    })

    expect(state.softDeleted).toEqual([])
  })
})
