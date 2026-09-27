import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import type { ReceiptJournal, RecordedEvent } from "./stripe-receipt-store.js";
import { createReceiptGapStopWriter, createStripeReconProvider, reconcileCheckoutEvents, type StripeReconProvider } from "./stripe-reconciliation.js";

const accountId = "acct_ltd";
const from = 1_000;
const to = 2_000;
const now = 3_000;

function checkoutEvent(
  id: string,
  sessionId: string,
  paymentStatus: string = "paid",
  extra: Record<string, unknown> = {},
): Stripe.Event {
  return {
    id,
    object: "event",
    created: 1_500,
    livemode: true,
    type: "checkout.session.completed",
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        mode: "payment",
        payment_status: paymentStatus,
        payment_intent: "pi_exact",
        amount_total: 1_500,
        currency: "gbp",
        metadata: { vf: "VF-2026-002" },
        ...extra,
      },
    },
  } as unknown as Stripe.Event;
}

function provider(pages: Stripe.Event[][], opts: { account?: string; credentialMode?: "live" | "test" } = {}) {
  const queries: unknown[] = [];
  const source: StripeReconProvider = {
    credentialMode: opts.credentialMode ?? "live",
    async currentAccount() {
      return { id: opts.account ?? accountId };
    },
    async listEvents(query) {
      queries.push(query);
      const page = pages[queries.length - 1] ?? [];
      return { data: page, has_more: queries.length < pages.length };
    },
  };
  return { source, queries };
}

function journal(records: Map<string, RecordedEvent> = new Map()): ReceiptJournal {
  return {
    async transact(_connector, callback) {
      return callback({
        state: "ACTIVE",
        async getEvent(id) { return records.get(id) ?? null; },
        async append() { throw new Error("reconciliation must not append a receipt"); },
        async putEvent() { throw new Error("reconciliation must not admit a payment"); },
      });
    },
  };
}

const options = { accountId, connectorId: "stripe:ltd", mode: "live" as const, from, to, now };

function stopJournal() {
  let chain: Array<{ kind: string; payload: unknown }> = [];
  let failAppend = false;
  const store: ReceiptJournal = {
    async transact(_connector, callback) {
      const draft = [...chain];
      const result = await callback({
        state: "ACTIVE",
        async getEvent() { return null; },
        async getStopEvents(id) {
          return draft.filter((entry) => entry.kind === "ops.stop" &&
            (entry.payload as { stop_id: string }).stop_id === id).map((entry) => entry.payload);
        },
        async append(kind, payload) {
          if (failAppend) throw new Error("STOP_APPEND_FAILED");
          draft.push({ kind, payload });
          return { index: draft.length - 1, receiptId: "receipt", timestamp: "2026-09-24T00:00:00.000Z",
            prevHash: "", hash: "", kind, payload };
        },
        async putEvent() { throw new Error("monitor cannot write event records"); },
      });
      chain = draft;
      return result;
    },
  };
  return { store, get chain() { return chain; }, set failAppend(value: boolean) { failAppend = value; } };
}

describe("read-only Stripe receipt reconciliation", () => {
  it("derives the credential mode from a dedicated Stripe key and refuses an unknown key format", () => {
    expect(createStripeReconProvider("rk_live_example").credentialMode).toBe("live");
    expect(createStripeReconProvider("sk_test_example").credentialMode).toBe("test");
    expect(() => createStripeReconProvider("opaque_unknown_key")).toThrow("STRIPE_KEY_MODE_UNKNOWN");
  });

  it("reports a paid Checkout event absent from the journal without trusting stale order metadata", async () => {
    const { source, queries } = provider([[checkoutEvent("evt_missing", "cs_exact")]]);
    const result = await reconcileCheckoutEvents({ ...options, provider: source, journal: journal() });

    expect(result).toMatchObject({ complete: true, nextCursor: null, scanned: 1 });
    expect(result.gaps).toEqual([{
      eventId: "evt_missing",
      sessionId: "cs_exact",
      paymentIntentId: "pi_exact",
      accountId,
      mode: "live",
      gapKey: expect.stringMatching(/^[a-f0-9]{64}$/),
    }]);
    expect(JSON.stringify(result)).not.toContain("VF-2026-002");
    expect(queries).toEqual([{
      created: { gte: from, lt: to },
      types: ["checkout.session.completed", "checkout.session.async_payment_succeeded"],
      limit: 100,
      starting_after: undefined,
    }]);
  });

  it("does not report an already recorded event or an unpaid Checkout Session", async () => {
    const rows = new Map<string, RecordedEvent>([["evt_present", {
      eventId: "evt_present", fingerprint: "opaque", deliveryId: "delivery",
      disposition: "recorded", response: { status: 200, body: {} },
    }]]);
    const { source } = provider([[
      checkoutEvent("evt_present", "cs_present"),
      checkoutEvent("evt_unpaid", "cs_unpaid", "unpaid"),
    ]]);
    const result = await reconcileCheckoutEvents({ ...options, provider: source, journal: journal(rows) });
    expect(result.gaps).toEqual([]);
    expect(result.scanned).toBe(2);
  });

  it("refuses a credential bound to another account or mode before listing events", async () => {
    const wrongAccount = provider([[checkoutEvent("evt_wrong", "cs_wrong")]], { account: "acct_other" });
    await expect(reconcileCheckoutEvents({ ...options, provider: wrongAccount.source, journal: journal() }))
      .rejects.toThrow("STRIPE_ACCOUNT_MISMATCH");
    expect(wrongAccount.queries).toEqual([]);

    const wrongMode = provider([[checkoutEvent("evt_wrong", "cs_wrong")]], { credentialMode: "test" });
    await expect(reconcileCheckoutEvents({ ...options, provider: wrongMode.source, journal: journal() }))
      .rejects.toThrow("STRIPE_MODE_MISMATCH");
    expect(wrongMode.queries).toEqual([]);
  });

  it("refuses a mismatched event account or mode and never advances its cursor", async () => {
    for (const bad of [
      checkoutEvent("evt_mode", "cs_mode", "paid", { livemode: false }),
      { ...checkoutEvent("evt_account", "cs_account"), account: "acct_connected_other" },
    ]) {
      const event = bad.id === "evt_mode" ? { ...bad, livemode: false } : bad;
      const { source } = provider([[event as Stripe.Event]]);
      await expect(reconcileCheckoutEvents({ ...options, provider: source, journal: journal() }))
        .rejects.toThrow("STRIPE_EVENT_SCOPE_MISMATCH");
    }
  });

  it("bounds pages and resumes the same fixed window with Stripe's starting_after cursor", async () => {
    const first = provider([[checkoutEvent("evt_newest", "cs_newest")], [checkoutEvent("evt_older", "cs_older")]]);
    const page1 = await reconcileCheckoutEvents({ ...options, provider: first.source, journal: journal(), maxPages: 1 });
    expect(page1).toMatchObject({ complete: false, nextCursor: "evt_newest", scanned: 1 });

    const resumed = provider([[checkoutEvent("evt_older", "cs_older")]]);
    const page2 = await reconcileCheckoutEvents({ ...options, provider: resumed.source, journal: journal(), startingAfter: page1.nextCursor! });
    expect(page2).toMatchObject({ complete: true, nextCursor: null, scanned: 1 });
    expect(resumed.queries[0]).toMatchObject({ created: { gte: from, lt: to }, starting_after: "evt_newest" });
    expect(page1.gaps[0].gapKey).not.toBe(page2.gaps[0].gapKey);

    const repeated = provider([[checkoutEvent("evt_newest", "cs_newest")]]);
    const page1Again = await reconcileCheckoutEvents({ ...options, provider: repeated.source, journal: journal(), maxPages: 1 });
    expect(page1Again.gaps[0].gapKey).toBe(page1.gaps[0].gapKey);
  });

  it("rejects an old or still-open window, and never silently accepts an empty Stripe page with has_more", async () => {
    const { source } = provider([[]]);
    await expect(reconcileCheckoutEvents({ ...options, provider: source, journal: journal(), from: -3_000_000 }))
      .rejects.toThrow("RECONCILIATION_WINDOW_INVALID");
    await expect(reconcileCheckoutEvents({ ...options, provider: source, journal: journal(), to: 2_950 }))
      .rejects.toThrow("RECONCILIATION_WINDOW_INVALID");
    const empty = provider([[], [checkoutEvent("evt_unseen", "cs_unseen")]]);
    await expect(reconcileCheckoutEvents({ ...options, provider: empty.source, journal: journal() }))
      .rejects.toThrow("STRIPE_PAGINATION_INVALID");
  });

  it("does not report a completed paid event as processed when the stop writer fails", async () => {
    const { source } = provider([[checkoutEvent("evt_missing", "cs_exact")]]);
    await expect(reconcileCheckoutEvents({
      ...options, provider: source, journal: journal(),
      async onGap() { throw new Error("STOP_LOG_UNAVAILABLE"); },
    })).rejects.toThrow("STOP_LOG_UNAVAILABLE");
  });

  it("appends one opaque stop across repeated scans and advances only after the stop commits", async () => {
    const backing = stopJournal();
    const writer = createReceiptGapStopWriter(backing.store, options.connectorId);
    const scan = () => {
      const { source } = provider([[checkoutEvent("evt_missing", "cs_exact")]]);
      return reconcileCheckoutEvents({ ...options, provider: source, journal: backing.store, onGap: writer });
    };

    backing.failAppend = true;
    await expect(scan()).rejects.toThrow("STOP_APPEND_FAILED");
    expect(backing.chain).toHaveLength(0);

    backing.failAppend = false;
    expect((await scan()).complete).toBe(true);
    expect((await scan()).complete).toBe(true);
    expect(backing.chain).toHaveLength(1);
    expect(backing.chain[0].kind).toBe("ops.stop");
    expect(backing.chain[0].payload).toMatchObject({
      state: "OPEN", stage: "PAYMENT_BINDING", category: "RECONCILIATION",
      code: "RECONCILIATION_GAP", next_effect_held: "PAID_ADMISSION",
      owner: "PAYMENT_INTEGRATION", recovery: "RECONCILE_PROVIDER_EVENTS",
      exit_check: "PROVIDER_EVENTS_RECONCILED",
      evidence_refs: [expect.stringMatching(/^check:sha256:[a-f0-9]{64}$/)],
    });
    expect(JSON.stringify(backing.chain)).not.toMatch(/evt_missing|cs_exact|pi_exact|VF-2026-002/);
  });
});
