import { describe, expect, it } from "vitest";
import { createMemoryReceiptJournal, receiptRuntime } from "./stripe-receipt-store";
import {
  appendOperationalStop,
  createOperationalStopLog,
  opaqueUuidFromHash,
} from "./operational-stop-log";

const connector = "stripe:unit:test";
const correlationId = "9ee288ab-40a5-4fe4-a6d7-4b98a3d732d2";
const input = {
  correlationId,
  stage: "PAID_ADMISSION" as const,
  category: "DATA" as const,
  code: "EXPECTED_ORDER_MISSING" as const,
  heldEffect: "PAID_ADMISSION" as const,
  owner: "PRODUCTION_ENGINEERING" as const,
  recovery: "BIND_ORDER_AND_REPLAY" as const,
  exitCheck: "ORDER_BOUND_TO_PAYMENT" as const,
  evidenceRefs: ["issue:1223"],
};

describe("operational stop receipts", () => {
  it("appends an OPEN stop and resolution without changing earlier receipts", async () => {
    const journal = createMemoryReceiptJournal();
    const log = createOperationalStopLog(journal, connector, {
      clock: () => "2026-09-24T08:00:00.000Z",
      idFactory: () => "e9c09ae7-eb62-4a86-9f06-343921ebc91e",
    });
    const opened = await log.record(input);
    expect(opened).toMatchObject({
      stop_id: "e9c09ae7-eb62-4a86-9f06-343921ebc91e",
      state: "OPEN",
      correlation_id: correlationId,
      stage: "PAID_ADMISSION",
      category: "DATA",
      code: "EXPECTED_ORDER_MISSING",
      next_effect_held: "PAID_ADMISSION",
      owner: "PRODUCTION_ENGINEERING",
      recovery: "BIND_ORDER_AND_REPLAY",
      exit_check: "ORDER_BOUND_TO_PAYMENT",
      evidence_refs: ["issue:1223"],
      at: "2026-09-24T08:00:00.000Z",
    });
    const original = structuredClone(journal.chain[0]);
    const resolved = await log.transition(opened.stop_id, {
      state: "RESOLVED",
      evidenceRefs: [`receipt:sha256:${"a".repeat(64)}`],
    });
    expect(resolved).toMatchObject({
      stop_id: opened.stop_id, state: "RESOLVED", prior_state: "OPEN",
      evidence_refs: [`receipt:sha256:${"a".repeat(64)}`],
    });
    expect(journal.chain[0]).toEqual(original);
    expect(journal.chain.map((r) => r.kind)).toEqual(["ops.stop", "ops.stop"]);
    expect(receiptRuntime().verifyChain(journal.chain).valid).toBe(true);
  });

  it("rejects raw provider IDs, emails, arbitrary notes and unsupported evidence", async () => {
    const journal = createMemoryReceiptJournal();
    const log = createOperationalStopLog(journal, connector);
    for (const unsafe of ["pi_3UIjG0KEhGSsgw9f03NTU54h", "buyer@example.test", "VF-2026-003"]) {
      await expect(log.record({ ...input, correlationId: unsafe })).rejects.toThrow("INVALID_STOP_CORRELATION");
    }
    await expect(log.record({ ...input, evidenceRefs: ["payment:pi_123"] })).rejects.toThrow("INVALID_STOP_EVIDENCE");
    await expect(log.record({ ...input, customer_email: "buyer@example.test" } as never)).rejects.toThrow("INVALID_STOP_FIELDS");
    expect(journal.chain).toHaveLength(0);
  });

  it("fails closed if append or commit fails; never reports a persisted stop", async () => {
    const journal = createMemoryReceiptJournal();
    const log = createOperationalStopLog(journal, connector);
    journal.state.failKind = "ops.stop";
    await expect(log.record(input)).rejects.toThrow("injected write fault");
    expect(journal.chain).toHaveLength(0);
    journal.state.failKind = "";
    journal.state.failCommit = true;
    await expect(log.record(input)).rejects.toThrow("injected commit fault");
    expect(journal.chain).toHaveLength(0);
  });

  it("cannot resolve a missing stop, resolve without evidence, or resolve twice", async () => {
    const journal = createMemoryReceiptJournal();
    const log = createOperationalStopLog(journal, connector);
    const missingId = "c09bd57e-8f63-467a-af0e-b8ac3f5f4231";
    await expect(log.transition(missingId, { state: "RESOLVED", evidenceRefs: ["issue:1223"] }))
      .rejects.toThrow("STOP_NOT_FOUND");
    const opened = await log.record(input);
    await expect(log.transition(opened.stop_id, { state: "RESOLVED", evidenceRefs: [] }))
      .rejects.toThrow("STOP_EXIT_EVIDENCE_REQUIRED");
    await log.transition(opened.stop_id, { state: "RESOLVED", evidenceRefs: ["issue:1223"] });
    await expect(log.transition(opened.stop_id, { state: "RESOLVED", evidenceRefs: ["issue:1223"] }))
      .rejects.toThrow("STOP_ALREADY_RESOLVED");
    expect(journal.chain).toHaveLength(2);
  });

  it("can append atomically with a paid-order hold and rolls back both on a stop fault", async () => {
    const journal = createMemoryReceiptJournal();
    journal.state.failKind = "ops.stop";
    await expect(journal.transact(connector, async (tx) => {
      await tx.append("stripe.classification", { scope_decision: "hold" });
      await appendOperationalStop(tx, input);
    })).rejects.toThrow("injected write fault");
    expect(journal.chain).toHaveLength(0);
    journal.state.failKind = "";
    await journal.transact(connector, async (tx) => {
      await tx.append("stripe.classification", { scope_decision: "hold" });
      await appendOperationalStop(tx, input);
    });
    expect(journal.chain.map((r) => r.kind)).toEqual(["stripe.classification", "ops.stop"]);
  });

  it("records the same reconciliation gap once across retries, rejecting a changed story", async () => {
    const journal = createMemoryReceiptJournal();
    const gapHash = "b".repeat(64);
    const gapId = opaqueUuidFromHash(gapHash);
    const log = createOperationalStopLog(journal, connector, { idFactory: () => gapId });
    const gap = {
      ...input, correlationId: gapId, stage: "PAYMENT_BINDING" as const,
      category: "RECONCILIATION" as const, code: "RECONCILIATION_GAP" as const,
      recovery: "RECONCILE_PROVIDER_EVENTS" as const,
      exitCheck: "PROVIDER_EVENTS_RECONCILED" as const,
      evidenceRefs: [`check:sha256:${gapHash}`],
    };
    const first = await log.record(gap);
    const second = await log.record(gap);
    expect(second).toEqual(first);
    expect(journal.chain).toHaveLength(1);
    await expect(log.record({ ...gap, recovery: "REVIEW_AND_RETRY" })).rejects.toThrow("STOP_ID_EXISTS");
    expect(journal.chain).toHaveLength(1);
    await log.transition(first.stop_id, { state: "RESOLVED", evidenceRefs: ["issue:1223"] });
    await expect(log.record(gap)).rejects.toThrow("STOP_RESOLVED_GAP_RECURRED");
    expect(journal.chain).toHaveLength(2);
  });

  it("serializes concurrent transitions so only one resolution is appended", async () => {
    const journal = createMemoryReceiptJournal();
    const log = createOperationalStopLog(journal, connector);
    const opened = await log.record(input);
    const results = await Promise.allSettled([
      log.transition(opened.stop_id, { state: "RESOLVED", evidenceRefs: ["issue:1223"] }),
      log.transition(opened.stop_id, { state: "RESOLVED", evidenceRefs: ["issue:1223"] }),
    ]);
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "rejected"]);
    expect(journal.chain.filter((receipt) => receipt.kind === "ops.stop")).toHaveLength(2);
    expect(receiptRuntime().verifyChain(journal.chain).valid).toBe(true);
  });
});
