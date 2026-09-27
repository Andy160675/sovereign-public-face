/**
 * Paid-order operational stops. These are append-only JARUS ReceiptEngine
 * receipts in the provisioned connector journal, not a second audit chain.
 * Only closed codes and opaque local UUIDs enter this log. Provider IDs,
 * customer details, free-form error messages and raw payloads are excluded.
 *
 * The log covers a receiver that runs and reaches its journal. An absent
 * webhook or unavailable journal requires an independent reconciliation
 * monitor; this module cannot observe a request it never receives.
 */
import { randomUUID } from "node:crypto";
import type { ReceiptTransaction, ReceiptJournal } from "./stripe-receipt-store.js";

const stages = [
  "PAYMENT_BINDING", "PAID_ADMISSION", "INTAKE_REQUEST", "BRIEF_CONFIRMATION",
  "PRODUCTION", "QC", "DELIVERY", "ACCEPTANCE",
] as const;
const categories = ["CONFIG", "DATA", "AUTHORITY", "EXTERNAL", "EXECUTION", "RECONCILIATION"] as const;
const codes = [
  "WEBHOOK_SECRET_UNAVAILABLE", "RECEIPT_KEY_UNAVAILABLE", "CONNECTOR_NOT_ACTIVE",
  "CONNECTOR_MODE_MISMATCH", "EVENT_COLLISION", "EXPECTED_ORDER_MISSING",
  "PRICE_MISMATCH", "AUTHORITY_REFUSED", "ORDER_BINDING_MISSING", "BRIEF_MISSING",
  "INTAKE_REQUEST_FAILED", "PRODUCTION_HELD", "QC_FAILED", "DELIVERY_HELD",
  "ACCEPTANCE_PENDING", "RECONCILIATION_GAP", "PAID_ADMISSION_NOT_CONFIGURED",
  "BINDING_NOT_FOUND", "BINDING_INCOMPLETE", "BINDING_STORE_UNAVAILABLE",
  "METADATA_CONFLICT", "PRODUCT_MISMATCH", "PAYMENT_LINK_MISMATCH",
  "ACCOUNT_MISMATCH", "SESSION_MISMATCH", "MODE_MISMATCH",
  "PAYMENT_NOT_CONFIRMED", "AMOUNT_MISMATCH", "CURRENCY_MISMATCH",
  "CUSTOMER_MISMATCH", "PAYMENT_INTENT_MISMATCH", "CHARGE_MISMATCH",
  "REFUND_PRESENT", "PROVIDER_UNAVAILABLE", "CORRECTION_PROOF_UNAVAILABLE",
  "ADMISSION_STORE_UNAVAILABLE", "ADMISSION_RECEIPT_INVALID",
  "PAYMENT_NOT_ADMITTED", "BRIEF_CONTACT_MISSING", "BRIEF_TRANSPORT_HELD",
  "BRIEF_DELIVERY_UNCERTAIN", "BRIEF_REQUIRED", "BRIEF_CONFIRMATION_REQUIRED",
  "INTAKE_STORE_UNAVAILABLE", "INTAKE_STORE_MISMATCH",
  "UNCLASSIFIED_STOP",
] as const;
const heldEffects = ["PAID_ADMISSION", "INTAKE_REQUEST", "PRODUCTION", "DELIVERY", "ENTITLEMENT"] as const;
const owners = ["PRODUCTION_ENGINEERING", "PAYMENT_INTEGRATION", "ORDER_OPERATIONS", "CUSTOMER", "PAYMENT_PROVIDER"] as const;
const recoveries = [
  "CONFIGURE_WEBHOOK_AND_REPLAY", "CONFIGURE_RECEIPT_KEY_AND_REPLAY",
  "BIND_ORDER_AND_REPLAY", "REVIEW_CONNECTOR_AND_REPLAY", "REQUEST_BRIEF",
  "RETRY_INTAKE_REQUEST", "REVIEW_PRODUCTION", "REVIEW_QC", "REVIEW_DELIVERY",
  "AWAIT_CUSTOMER", "RECONCILE_PROVIDER_EVENTS", "REVIEW_AND_RETRY",
  "RESOLVE_IMMUTABLE_ORDER_BINDING", "INVESTIGATE_AND_RECONCILE",
  "RESOLVE_CUSTOMER_CONTACT", "CONFIRM_BRIEF",
] as const;
const exitChecks = [
  "SIGNED_EVENT_REPLAY_RECORDED", "ORDER_BOUND_TO_PAYMENT", "CONNECTOR_SCOPE_VERIFIED",
  "BRIEF_REQUEST_SENT", "BRIEF_RECEIVED", "PRODUCTION_VERIFIED", "QC_PASSED",
  "DELIVERY_VERIFIED", "CUSTOMER_ACCEPTED", "PROVIDER_EVENTS_RECONCILED",
  "REVIEWED_RECOVERY_VERIFIED",
  "EXACT_ACCOUNT_SESSION_PAYMENT_AND_ORDER_MATCH",
  "CUSTOMER_CONTACT_VERIFIED", "BRIEF_CONFIRMED",
] as const;

export type PaidOrderStage = typeof stages[number];
export type StopCategory = typeof categories[number];
export type StopCode = typeof codes[number];
export type HeldEffect = typeof heldEffects[number];
export type StopOwner = typeof owners[number];
export type Recovery = typeof recoveries[number];
export type ExitCheck = typeof exitChecks[number];

export interface OpenOperationalStop {
  /** A random local UUID. The private order ledger maps this to an order. */
  correlationId: string;
  stage: PaidOrderStage;
  category: StopCategory;
  code: StopCode;
  heldEffect: HeldEffect;
  owner: StopOwner;
  recovery: Recovery;
  exitCheck: ExitCheck;
  evidenceRefs: readonly string[];
}

export interface OpenStopReceipt {
  stop_id: string;
  correlation_id: string;
  at: string;
  state: "OPEN";
  stage: PaidOrderStage;
  category: StopCategory;
  code: StopCode;
  next_effect_held: HeldEffect;
  owner: StopOwner;
  recovery: Recovery;
  exit_check: ExitCheck;
  evidence_refs: string[];
}

export interface StopTransitionReceipt {
  stop_id: string;
  at: string;
  state: "RETRYING" | "RESOLVED";
  prior_state: "OPEN" | "RETRYING";
  evidence_refs: string[];
}

type StopReceipt = OpenStopReceipt | StopTransitionReceipt;
type Context = { clock?: () => string; idFactory?: () => string };
const uuid4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const evidencePattern = /^(?:issue:[1-9][0-9]*|(?:receipt|check|deployment):sha256:[a-f0-9]{64})$/;

/** Stable opaque UUID for a high-entropy SHA-256 reconciliation gap key. */
export function opaqueUuidFromHash(digest: string): string {
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error("INVALID_STOP_DIGEST");
  const hex = `${digest.slice(0, 12)}4${digest.slice(13, 16)}${(8 | (parseInt(digest[16]!, 16) & 3)).toString(16)}${digest.slice(17, 32)}`;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function oneOf<T extends string>(value: unknown, choices: readonly T[], field: string): asserts value is T {
  if (typeof value !== "string" || !choices.includes(value as T)) throw new Error(`INVALID_STOP_${field}`);
}

function evidence(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 8 || value.some((ref) =>
    typeof ref !== "string" || !evidencePattern.test(ref))) {
    throw new Error("INVALID_STOP_EVIDENCE");
  }
  return [...value];
}

function time(clock: () => string): string {
  const at = clock();
  if (typeof at !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(at)
      || Number.isNaN(Date.parse(at)) || new Date(at).toISOString() !== at) {
    throw new Error("INVALID_STOP_TIME");
  }
  return at;
}

function validOpen(input: OpenOperationalStop): Omit<OpenStopReceipt, "stop_id" | "at" | "state"> {
  const allowed = ["correlationId", "stage", "category", "code", "heldEffect", "owner", "recovery", "exitCheck", "evidenceRefs"];
  if (!input || typeof input !== "object" || Object.keys(input).some((key) => !allowed.includes(key))) {
    throw new Error("INVALID_STOP_FIELDS");
  }
  if (typeof input.correlationId !== "string" || !uuid4.test(input.correlationId)) {
    throw new Error("INVALID_STOP_CORRELATION");
  }
  oneOf(input.stage, stages, "STAGE");
  oneOf(input.category, categories, "CATEGORY");
  oneOf(input.code, codes, "CODE");
  oneOf(input.heldEffect, heldEffects, "EFFECT");
  oneOf(input.owner, owners, "OWNER");
  oneOf(input.recovery, recoveries, "RECOVERY");
  oneOf(input.exitCheck, exitChecks, "EXIT_CHECK");
  return {
    correlation_id: input.correlationId,
    stage: input.stage,
    category: input.category,
    code: input.code,
    next_effect_held: input.heldEffect,
    owner: input.owner,
    recovery: input.recovery,
    exit_check: input.exitCheck,
    evidence_refs: evidence(input.evidenceRefs),
  };
}

/** Call inside the same transaction as the held effect, so failure rolls both back. */
export async function appendOperationalStop(
  tx: ReceiptTransaction,
  input: OpenOperationalStop,
  context: Context = {},
): Promise<OpenStopReceipt> {
  const safe = validOpen(input);
  const stopId = (context.idFactory ?? randomUUID)();
  if (!uuid4.test(stopId)) throw new Error("INVALID_STOP_ID");
  const existing = await tx.getStopEvents(stopId) as StopReceipt[];
  if (existing.length) {
    const opened = existing[0];
    if (opened?.state === "OPEN" && Object.entries(safe).every(([key, value]) =>
      JSON.stringify(opened[key as keyof OpenStopReceipt]) === JSON.stringify(value))) {
      if (existing.at(-1)?.state === "RESOLVED") throw new Error("STOP_RESOLVED_GAP_RECURRED");
      return opened;
    }
    throw new Error("STOP_ID_EXISTS");
  }
  const payload: OpenStopReceipt = {
    stop_id: stopId,
    at: time(context.clock ?? (() => new Date().toISOString())),
    state: "OPEN",
    ...safe,
  };
  await tx.append("ops.stop", payload);
  return payload;
}

export function createOperationalStopLog(
  journal: ReceiptJournal,
  connector: string,
  context: Context = {},
) {
  return {
    record(input: OpenOperationalStop): Promise<OpenStopReceipt> {
      return journal.transact(connector, (tx) => appendOperationalStop(tx, input, context));
    },
    async transition(
      stopId: string,
      transition: { state: "RETRYING" | "RESOLVED"; evidenceRefs: readonly string[] },
    ): Promise<StopTransitionReceipt> {
      if (!uuid4.test(stopId)) throw new Error("INVALID_STOP_ID");
      if (!transition || Object.keys(transition).some((key) => !["state", "evidenceRefs"].includes(key))
          || !["RETRYING", "RESOLVED"].includes(transition.state)) {
        throw new Error("INVALID_STOP_TRANSITION");
      }
      const refs = evidence(transition.evidenceRefs);
      if (!refs.length) throw new Error("STOP_EXIT_EVIDENCE_REQUIRED");
      return journal.transact(connector, async (tx) => {
        const events = await tx.getStopEvents(stopId) as StopReceipt[];
        if (!events.length || events[0]?.state !== "OPEN") throw new Error("STOP_NOT_FOUND");
        const prior = events.at(-1)!.state;
        if (prior === "RESOLVED") throw new Error("STOP_ALREADY_RESOLVED");
        const payload: StopTransitionReceipt = {
          stop_id: stopId,
          at: time(context.clock ?? (() => new Date().toISOString())),
          state: transition.state,
          prior_state: prior,
          evidence_refs: refs,
        };
        await tx.append("ops.stop", payload);
        return payload;
      });
    },
  };
}
