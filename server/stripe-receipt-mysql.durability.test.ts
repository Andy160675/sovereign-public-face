/**
 * MySQL durability / concurrency / restart probes for MysqlReceiptJournal.
 * Non-prod Docker MySQL only. Stage-1 evidence — not production qualification.
 */
import { createPool } from "mysql2/promise";
import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MysqlReceiptJournal, recordHash, type RecordedEvent } from "./stripe-receipt-store";

const require = createRequire(import.meta.url);
function loadGenesis(): string {
  const path = process.env.JARUS_RECEIPT_ENGINE_PATH;
  if (!path) throw new Error("JARUS_RECEIPT_ENGINE_PATH required");
  const mod = require(path) as { GENESIS_HASH: string };
  if (!mod.GENESIS_HASH) throw new Error("GENESIS_HASH missing from ReceiptEngine entry");
  return mod.GENESIS_HASH;
}

const URI =
  process.env.STRIPE_RECEIPT_MYSQL_URI ??
  "mysql://stripe_test:forge_test_user_not_prod@127.0.0.1:3307/stripe_receipts_test";

const CONNECTOR = "stripe:mysql:durability";

async function seedConnector(uri: string, connector: string) {
  const pool = createPool(uri);
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    await db.execute("DELETE FROM stripe_recorded_events WHERE connector_id = ?", [connector]);
    await db.execute("DELETE FROM stripe_receipts WHERE connector_id = ?", [connector]);
    await db.execute("DELETE FROM stripe_receipt_connectors WHERE connector_id = ?", [connector]);
    await db.execute(
      "INSERT INTO stripe_receipt_connectors (connector_id, state, chain_length, head_hash) VALUES (?, 'ACTIVE', 0, ?)",
      [connector, loadGenesis()],
    );
    await db.commit();
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
    await pool.end();
  }
}

const runMysqlDurability = Boolean(
  process.env.STRIPE_RECEIPT_MYSQL_URI &&
  process.env.JARUS_RECEIPT_ENGINE_PATH &&
  process.env.JARUS_RECEIPT_ENGINE_SHA256,
);
describe.skipIf(!runMysqlDurability)("MysqlReceiptJournal durability (non-prod)", () => {
  let journal: MysqlReceiptJournal;

  beforeAll(async () => {
    if (!process.env.JARUS_RECEIPT_ENGINE_PATH || !process.env.JARUS_RECEIPT_ENGINE_SHA256) {
      throw new Error("JARUS_RECEIPT_ENGINE_PATH and JARUS_RECEIPT_ENGINE_SHA256 required");
    }
    await seedConnector(URI, CONNECTOR);
    journal = new MysqlReceiptJournal(URI);
  }, 60_000);

  afterAll(async () => {
    await journal?.close();
  });

  it("durability + restart: recorded event survives new MysqlReceiptJournal instance", async () => {
    const record: RecordedEvent = {
      eventId: "evt_mysql_restart_1",
      fingerprint: "fp_restart_1",
      deliveryId: "del_restart_1",
      disposition: "recorded",
      response: { status: 200, body: { disposition: "recorded" } },
    };
    const hash = recordHash(record);

    await journal.transact(CONNECTOR, async (tx) => {
      await tx.append("stripe.delivery", { event_id: null, delivery_id: record.deliveryId });
      await tx.append("stripe.signature", { event_id: record.eventId, pass: true });
      await tx.append("stripe.classification", {
        event_id: record.eventId,
        permitted_operation: "RECORD_ONLY",
        record_hash: hash,
      });
      await tx.append("stripe.execution", {
        event_id: record.eventId,
        result: "RECORDED_ONLY",
        record_hash: hash,
      });
      await tx.putEvent(record);
    });

    await journal.close();
    const restarted = new MysqlReceiptJournal(URI);
    const found = await restarted.transact(CONNECTOR, async (tx) => tx.getEvent(record.eventId));
    expect(found).not.toBeNull();
    expect(found!.eventId).toBe(record.eventId);
    expect(found!.disposition).toBe("recorded");

    const marker = await restarted.transact(CONNECTOR, async (tx) =>
      tx.append("stripe.observe", { note: "post-restart" }),
    );
    expect(marker.index).toBe(4);
    await restarted.close();
    journal = new MysqlReceiptJournal(URI);
  }, 60_000);

  it("concurrency: parallel writers serialize; indices contiguous and unique", async () => {
    const n = 8;
    const indices = await Promise.all(
      Array.from({ length: n }, (_, i) =>
        journal.transact(CONNECTOR, async (tx) => {
          const r = await tx.append("stripe.observe", { concurrent: true, i });
          return r.index;
        }),
      ),
    );
    expect(new Set(indices).size).toBe(n);
    const sorted = [...indices].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]).toBe(sorted[i - 1]! + 1);
    }
  }, 60_000);

  it("rollback: injected failure after Delivery leaves no processed event row", async () => {
    const eventId = "evt_mysql_rollback_1";
    await expect(
      journal.transact(CONNECTOR, async (tx) => {
        await tx.append("stripe.delivery", { event_id: null, delivery_id: "del_rb" });
        await tx.append("stripe.signature", { event_id: eventId, pass: true });
        throw new Error("INJECTED_FAIL");
      }),
    ).rejects.toThrow(/INJECTED_FAIL/);

    const found = await journal.transact(CONNECTOR, async (tx) => tx.getEvent(eventId));
    expect(found).toBeNull();
  }, 60_000);
});
