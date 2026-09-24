import { createHash } from "node:crypto";
import Stripe from "stripe";
import type { ReceiptJournal } from "./stripe-receipt-store.js";
import { createOperationalStopLog, opaqueUuidFromHash } from "./operational-stop-log.js";

export type ReconMode = "live" | "test";
export interface StripeReconProvider {
  credentialMode: ReconMode;
  currentAccount(): Promise<{ id: string }>;
  listEvents(query: {
    created: { gte: number; lt: number };
    types: ["checkout.session.completed", "checkout.session.async_payment_succeeded"];
    limit: number;
    starting_after?: string;
  }): Promise<{ data: Stripe.Event[]; has_more: boolean }>;
}

/** Dedicated read-only provider; never pass checkout's shared key by default. */
export function createStripeReconProvider(secretKey: string): StripeReconProvider {
  const match = /^(?:sk|rk)_(live|test)_[a-zA-Z0-9]+$/.exec(secretKey);
  if (!match) throw new Error("STRIPE_KEY_MODE_UNKNOWN");
  const credentialMode = match[1] as ReconMode;
  const stripe = new Stripe(secretKey, { apiVersion: "2026-02-25.clover" });
  return {
    credentialMode,
    async currentAccount() {
      // No ID argument: the account authenticated by this exact key.
      const account = await stripe.accounts.retrieve();
      return { id: account.id };
    },
    async listEvents(query) {
      const page = await stripe.events.list(query);
      return { data: page.data, has_more: page.has_more };
    },
  };
}

export interface ReconciliationGap {
  eventId: string;
  sessionId: string;
  paymentIntentId: string | null;
  accountId: string;
  mode: ReconMode;
  gapKey: string;
}

/** Persist a safe stop, once per exact event/account/mode gap, before checkpointing. */
export function createReceiptGapStopWriter(journal: ReceiptJournal, connectorId: string) {
  return async (gap: ReconciliationGap): Promise<void> => {
    const stopId = opaqueUuidFromHash(gap.gapKey);
    const log = createOperationalStopLog(journal, connectorId, { idFactory: () => stopId });
    await log.record({
      correlationId: stopId,
      stage: "PAYMENT_BINDING",
      category: "RECONCILIATION",
      code: "RECONCILIATION_GAP",
      heldEffect: "PAID_ADMISSION",
      owner: "PAYMENT_INTEGRATION",
      recovery: "RECONCILE_PROVIDER_EVENTS",
      exitCheck: "PROVIDER_EVENTS_RECONCILED",
      evidenceRefs: [`check:sha256:${gap.gapKey}`],
    });
  };
}

export interface ReconciliationOptions {
  provider: StripeReconProvider;
  journal: ReceiptJournal;
  connectorId: string;
  accountId: string;
  mode: ReconMode;
  from: number;
  to: number;
  now: number;
  startingAfter?: string;
  maxPages?: number;
  onGap?: (gap: ReconciliationGap) => Promise<void>;
}

/**
 * A bounded detector, not a payment admission or backfill mechanism. In
 * particular, neither amount nor Payment Link metadata associates an event
 * with a customer order. The only lookup is the exact Stripe event ID in the
 * journal belonging to the configured merchant connector.
 *
 * The caller must persist each gap through an idempotent stop writer before
 * treating a page's returned cursor as durable. Do not use the optional
 * callback to send mail, grant access or construct a receipt from Stripe.
 */
export async function reconcileCheckoutEvents(options: ReconciliationOptions): Promise<{
  complete: boolean;
  nextCursor: string | null;
  scanned: number;
  gaps: ReconciliationGap[];
}> {
  const { provider, journal, connectorId, accountId, mode, from, to, now } = options;
  const maxPages = options.maxPages ?? 10;
  if (
    !Number.isSafeInteger(from) || !Number.isSafeInteger(to) || !Number.isSafeInteger(now) ||
    from < now - 29 * 86_400 || from >= to || to > now - 300 ||
    !Number.isInteger(maxPages) || maxPages < 1 || maxPages > 10
  ) throw new Error("RECONCILIATION_WINDOW_INVALID");
  if (!/^acct_[a-zA-Z0-9]+$/.test(accountId) || !connectorId.trim()) {
    throw new Error("RECONCILIATION_SCOPE_INVALID");
  }
  if (provider.credentialMode !== mode) throw new Error("STRIPE_MODE_MISMATCH");
  const account = await provider.currentAccount();
  if (account.id !== accountId) throw new Error("STRIPE_ACCOUNT_MISMATCH");

  const gaps: ReconciliationGap[] = [];
  let cursor = options.startingAfter;
  let scanned = 0;
  for (let pageNo = 0; pageNo < maxPages; pageNo++) {
    const page = await provider.listEvents({
      created: { gte: from, lt: to },
      types: ["checkout.session.completed", "checkout.session.async_payment_succeeded"],
      limit: 100,
      starting_after: cursor,
    });
    if (!Array.isArray(page.data) || page.data.length > 100 ||
      (page.has_more && page.data.length === 0)) throw new Error("STRIPE_PAGINATION_INVALID");

    // Validate the whole page before writing any stop. Snapshot event payloads
    // have the Stripe API version at creation, so reject unknown structures.
    const paid: Array<{ id: string; sessionId: string; paymentIntentId: string | null }> = [];
    const seen = new Set<string>();
    for (const event of page.data) {
      if (!event || !/^evt_[a-zA-Z0-9]+$/.test(event.id) ||
        seen.has(event.id) || event.id === cursor ||
        !Number.isSafeInteger(event.created) || event.created < from || event.created >= to ||
        !["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
        throw new Error("STRIPE_EVENT_INVALID");
      }
      seen.add(event.id);
      if (event.livemode !== (mode === "live") ||
        (event.account != null && event.account !== accountId)) {
        throw new Error("STRIPE_EVENT_SCOPE_MISMATCH");
      }
      const session = event.data?.object as unknown as Record<string, unknown> | undefined;
      if (!session || session.object !== "checkout.session" ||
        typeof session.id !== "string" || !session.id.startsWith("cs_") ||
        typeof session.mode !== "string" || typeof session.payment_status !== "string" ||
        session.livemode != null && session.livemode !== event.livemode) {
        throw new Error("STRIPE_SESSION_INVALID");
      }
      if (session.mode !== "payment" || session.payment_status !== "paid") continue;
      const paymentIntent = session.payment_intent;
      const paymentIntentId = typeof paymentIntent === "string"
        ? paymentIntent
        : paymentIntent && typeof paymentIntent === "object" && "id" in paymentIntent &&
          typeof paymentIntent.id === "string" ? paymentIntent.id : null;
      paid.push({ id: event.id, sessionId: session.id, paymentIntentId });
    }

    const missing = await journal.transact(connectorId, async (tx) => {
      const found: typeof paid = [];
      for (const item of paid) {
        if (!await tx.getEvent(item.id)) found.push(item);
      }
      return found;
    });
    for (const item of missing) {
      const gapKey = createHash("sha256")
        .update(`stripe-reconcile:v1\0${accountId}\0${mode}\0${item.id}`)
        .digest("hex");
      const gap = {
        eventId: item.id, sessionId: item.sessionId,
        paymentIntentId: item.paymentIntentId, accountId, mode, gapKey,
      };
      // A failed stop write fails the run without yielding a cursor.
      await options.onGap?.(gap);
      gaps.push(gap);
    }
    scanned += page.data.length;
    if (!page.has_more) return { complete: true, nextCursor: null, scanned, gaps };
    cursor = page.data.at(-1)!.id;
  }
  return { complete: false, nextCursor: cursor ?? null, scanned, gaps };
}
