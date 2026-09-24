import { describe, expect, it } from "vitest";
import { createFightPackAdmission } from "./fight-pack-admission.mjs";
import { createMemoryReceiptJournal, receiptRuntime } from "./stripe-receipt-store";
import { createOperationalStopLog } from "./operational-stop-log";

function dependencies(journal: ReturnType<typeof createMemoryReceiptJournal>) {
  let providerReads = 0;
  const inaccessible = async () => { providerReads++; throw new Error("must not read without binding"); };
  const service = createFightPackAdmission({
    store: { getBinding: async () => null, admit: async () => { throw new Error("must not admit"); } },
    stripe: {
      retrieveAccount: inaccessible, retrieveSession: inaccessible,
      retrievePaymentIntent: inaccessible, retrieveCharge: inaccessible,
      retrieveSessionLineItems: inaccessible,
    },
    stops: createOperationalStopLog(journal, "stripe:paid:fixture"),
  });
  return { service, reads: () => providerReads };
}

describe("fight-pack admission with the actual durable stop sink", () => {
  it("holds missing exact order binding, appends safe evidence, and never reads provider", async () => {
    const journal = createMemoryReceiptJournal();
    const { service, reads } = dependencies(journal);
    await expect(service.reconcile({ orderRef: "VF-2026-003" })).rejects.toMatchObject({
      code: "BINDING_NOT_FOUND",
    });
    expect(reads()).toBe(0);
    expect(journal.chain).toHaveLength(1);
    expect(journal.chain[0]).toMatchObject({
      kind: "ops.stop",
      payload: {
        stage: "PAYMENT_BINDING", category: "CONFIG", code: "BINDING_NOT_FOUND",
        state: "OPEN", next_effect_held: "PAID_ADMISSION", owner: "PAYMENT_INTEGRATION",
        recovery: "INVESTIGATE_AND_RECONCILE",
        exit_check: "EXACT_ACCOUNT_SESSION_PAYMENT_AND_ORDER_MATCH", evidence_refs: [],
      },
    });
    expect(JSON.stringify(journal.chain)).not.toContain("VF-2026-003");
    expect(receiptRuntime().verifyChain(journal.chain).valid).toBe(true);
  });

  it("turns a failed stop append into STOP_LOG_UNAVAILABLE with no admission", async () => {
    const journal = createMemoryReceiptJournal();
    journal.state.failKind = "ops.stop";
    const { service, reads } = dependencies(journal);
    await expect(service.reconcile({ orderRef: "VF-2026-003" })).rejects.toMatchObject({
      code: "STOP_LOG_UNAVAILABLE",
    });
    expect(journal.chain).toHaveLength(0);
    expect(reads()).toBe(0);
  });
});
