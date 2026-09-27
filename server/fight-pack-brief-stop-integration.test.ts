import { describe, expect, it } from "vitest";
import { createFightPackBriefIntake } from "./fight-pack-brief-intake.mjs";
import { createMemoryReceiptJournal, receiptRuntime } from "./stripe-receipt-store";
import { createOperationalStopLog } from "./operational-stop-log";

const correlationId = "a0a0a0a0-0000-4000-8000-000000000003";

function service(journal: ReturnType<typeof createMemoryReceiptJournal>, admitted: boolean) {
  return createFightPackBriefIntake({
    admissionStore: {
      getBinding: async () => admitted ? {
        correlationId, orderRef: "VF-2026-003", product: "josh_full_fight_pack_v1",
        customerEmail: "private@example.test",
      } : null,
      getAdmitted: async () => admitted ? {
        orderRef: "VF-2026-003", receiptRef: "protected:test:admission",
      } : null,
    },
    store: {
      enqueue: async () => { throw new Error("not reached"); },
      getRequest: async () => null,
      claim: async () => null,
      markDispatched: async () => undefined,
      holdUncertain: async () => undefined,
      getActiveToken: async () => ({ correlationId, orderRef: "VF-2026-003" }),
      consume: async () => { throw new Error("not reached"); },
    },
    stops: createOperationalStopLog(journal, "stripe:paid:fixture"),
    publicOrigin: "https://example.test",
  });
}

describe("brief intake with the actual durable stop sink", () => {
  it("records missing paid admission using a fresh opaque correlation ID", async () => {
    const journal = createMemoryReceiptJournal();
    await expect(service(journal, false).queue({ orderRef: "VF-2026-003" }))
      .rejects.toMatchObject({ code: "PAYMENT_NOT_ADMITTED" });
    expect(journal.chain).toHaveLength(1);
    expect(journal.chain[0]).toMatchObject({
      kind: "ops.stop", payload: {
        state: "OPEN", code: "PAYMENT_NOT_ADMITTED", stage: "INTAKE_REQUEST",
        next_effect_held: "INTAKE_REQUEST", evidence_refs: [],
      },
    });
    expect(JSON.stringify(journal.chain)).not.toContain("VF-2026-003");
  });

  it("records a missing brief and holds production, without sending anything", async () => {
    const journal = createMemoryReceiptJournal();
    await expect(service(journal, true).submit({ token: "A".repeat(43), brief: "", factsConfirmed: false }))
      .rejects.toMatchObject({ code: "BRIEF_REQUIRED" });
    expect(journal.chain[0]).toMatchObject({
      kind: "ops.stop", payload: {
        correlation_id: correlationId, code: "BRIEF_REQUIRED", stage: "BRIEF_CONFIRMATION",
        next_effect_held: "PRODUCTION", owner: "ORDER_OPERATIONS",
        recovery: "REQUEST_BRIEF", exit_check: "BRIEF_RECEIVED",
      },
    });
    expect(JSON.stringify(journal.chain)).not.toContain("private@example.test");
    expect(receiptRuntime().verifyChain(journal.chain).valid).toBe(true);
  });

  it("fails closed when the no-brief stop cannot be appended", async () => {
    const journal = createMemoryReceiptJournal();
    journal.state.failKind = "ops.stop";
    await expect(service(journal, true).submit({ token: "A".repeat(43), brief: "", factsConfirmed: false }))
      .rejects.toMatchObject({ code: "STOP_LOG_UNAVAILABLE" });
    expect(journal.chain).toHaveLength(0);
  });
});
