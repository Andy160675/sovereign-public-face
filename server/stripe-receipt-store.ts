/**
 * Stripe receipt persistence adapter (UNVERIFIED until Blade forge tests pass).
 *
 * ReceiptEngine (@codex-sovereign/jarus) owns hashing/chaining.
 * This module owns durability, connector locking, and event dedup storage only.
 *
 * Packaging: pin @codex-sovereign/jarus OR set JARUS_RECEIPT_ENGINE_PATH (absolute)
 * + JARUS_RECEIPT_ENGINE_SHA256. Do NOT vend private jarus/ source into the
 * public sovereign-public-face repository.
 */
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import { createPool, type Pool } from "mysql2/promise";

export interface Receipt {
  index: number;
  receiptId: string;
  timestamp: string;
  prevHash: string;
  kind: string;
  payload: unknown;
  hash: string;
}

export type EventDisposition = "recorded" | "held" | "refused" | "ignored";

export interface RecordedEvent {
  eventId: string;
  fingerprint: string;
  deliveryId: string;
  disposition: EventDisposition;
  response: { status: number; body: Record<string, unknown> };
}

export interface ReceiptTransaction {
  state: string;
  append(kind: string, payload: unknown): Promise<Receipt>;
  getEvent(eventId: string): Promise<RecordedEvent | null>;
  putEvent(event: RecordedEvent): Promise<void>;
  /** Verified connector chain, scoped to a local opaque stop ID. */
  getStopEvents(stopId: string): Promise<unknown[]>;
}

export interface ReceiptJournal {
  transact<T>(connector: string, run: (tx: ReceiptTransaction) => Promise<T>): Promise<T>;
}

interface Engine {
  readonly chain: readonly Receipt[];
  readonly headHash: string;
  issue(kind: string, payload: unknown): Receipt;
  verify(): { valid: boolean; reason: string | null };
}

interface Runtime {
  ReceiptEngine: new (options?: { chain?: readonly Receipt[] }) => Engine;
  canonicalJson(value: unknown): string;
  verifyChain(chain: readonly Receipt[]): { valid: boolean; reason: string | null };
}

const require = createRequire(import.meta.url);

/**
 * Import the existing canonical engine — never implement a second receipt hash.
 * Production requires the reviewed SHA-256 of its bundled entry point. Tests
 * may inject a journal and use the locally installed canonical package.
 */
export function receiptRuntime(requirePin = false): Runtime {
  const supplied = process.env.JARUS_RECEIPT_ENGINE_PATH;
  if (supplied && !isAbsolute(supplied)) throw new Error("JARUS_PATH_MUST_BE_ABSOLUTE");
  const entry = supplied ?? require.resolve("@codex-sovereign/jarus");
  const pin = process.env.JARUS_RECEIPT_ENGINE_SHA256;
  if (requirePin && !pin) throw new Error("JARUS_RUNTIME_PIN_REQUIRED");
  if (pin && createHash("sha256").update(readFileSync(entry)).digest("hex") !== pin) {
    throw new Error("JARUS_RUNTIME_PIN_MISMATCH");
  }
  const runtime = require(entry) as Runtime;
  if (
    typeof runtime.ReceiptEngine !== "function" ||
    typeof runtime.canonicalJson !== "function" ||
    typeof runtime.verifyChain !== "function"
  ) {
    throw new Error("JARUS_RUNTIME_INVALID");
  }
  return runtime;
}

export function recordHash(value: unknown): string {
  return createHash("sha256").update(receiptRuntime().canonicalJson(value)).digest("hex");
}

export function sha256Bytes(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

function jsonParse<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

/**
 * In-memory transactional journal for unit tests.
 * Real canonical hashes via ReceiptEngine. NOT proof of MySQL locking/durability.
 * Serializes writers with a promise chain (in-process only).
 */
export function createMemoryReceiptJournal(seed?: {
  chain?: Receipt[];
  events?: Map<string, RecordedEvent>;
  mode?: string;
}) {
  let chain: Receipt[] = [...(seed?.chain ?? [])];
  let events = new Map<string, RecordedEvent>(seed?.events ?? []);
  let tail = Promise.resolve();
  const state = { mode: seed?.mode ?? "ACTIVE", failKind: "", failCommit: false };

  return {
    state,
    get chain() {
      return chain;
    },
    get events() {
      return events;
    },
    /** Snapshot for restart-recovery tests (simulates process restart). */
    snapshot() {
      return {
        chain: structuredClone(chain),
        events: new Map(structuredClone(Array.from(events.entries()))),
        mode: state.mode,
      };
    },
    async transact<T>(_connector: string, callback: (tx: ReceiptTransaction) => Promise<T>): Promise<T> {
      const previous = tail;
      let release!: () => void;
      tail = new Promise<void>((r) => {
        release = r;
      });
      await previous;
      try {
        const runtime = receiptRuntime(false);
        const engine = new runtime.ReceiptEngine({ chain });
        if (!engine.verify().valid) throw new Error("RECEIPT_CHAIN_INVALID");
        const draft = new Map(events);
        const tx: ReceiptTransaction = {
          state: state.mode,
          async append(kind: string, payload: unknown) {
            if (state.failKind === kind) throw new Error("injected write fault");
            return engine.issue(kind, payload);
          },
          async getEvent(id: string) {
            return draft.get(id) ?? null;
          },
          async putEvent(row: RecordedEvent) {
            if (draft.has(row.eventId)) throw new Error("duplicate primary key");
            draft.set(row.eventId, structuredClone(row));
          },
          async getStopEvents(stopId: string) {
            return engine.chain.filter((receipt) =>
              receipt.kind === "ops.stop" &&
              (receipt.payload as { stop_id?: unknown })?.stop_id === stopId,
            ).map((receipt) => structuredClone(receipt.payload));
          },
        };
        const result = await callback(tx);
        if (state.failCommit) throw new Error("injected commit fault");
        chain = [...engine.chain];
        events = draft;
        return result;
      } finally {
        release();
      }
    },
  };
}

export type MemoryReceiptJournal = ReturnType<typeof createMemoryReceiptJournal>;

/**
 * Persistence adapter only. ReceiptEngine remains the hash/chain owner.
 * All writers of a connector must acquire this row lock. No runtime DDL,
 * automatic genesis, fallback in-memory persistence, or network side effect.
 *
 * Required tables (migration NOT executed by this patch):
 *   stripe_receipt_connectors(connector_id PK, state, chain_length, head_hash)
 *   stripe_receipts(connector_id, receipt_index, receipt_json, PK(connector_id, receipt_index))
 *   stripe_recorded_events(connector_id, event_id, record_json, PK(connector_id, event_id))
 */
export class MysqlReceiptJournal implements ReceiptJournal {
  private pool: Pool | undefined;
  constructor(private readonly uri: string) {}

  async transact<T>(connector: string, run: (tx: ReceiptTransaction) => Promise<T>): Promise<T> {
    const runtime = receiptRuntime(true);
    this.pool ??= createPool(this.uri);
    const db = await this.pool.getConnection();
    try {
      await db.beginTransaction();
      const [heads] = await db.execute<any[]>(
        "SELECT state, chain_length, head_hash FROM stripe_receipt_connectors WHERE connector_id = ? FOR UPDATE",
        [connector],
      );
      if (heads.length !== 1) throw new Error("CONNECTOR_NOT_PROVISIONED");
      const head = heads[0];
      const [rows] = await db.execute<any[]>(
        "SELECT receipt_index, receipt_json FROM stripe_receipts WHERE connector_id = ? ORDER BY receipt_index",
        [connector],
      );
      const chain = rows.map((row) => jsonParse<Receipt>(row.receipt_json));
      const engine = new runtime.ReceiptEngine({ chain });
      if (
        !engine.verify().valid ||
        rows.some((row, i) => Number(row.receipt_index) !== i) ||
        Number(head.chain_length) !== chain.length ||
        head.head_hash !== engine.headHash
      ) {
        throw new Error("RECEIPT_HEAD_MISMATCH");
      }

      const tx: ReceiptTransaction = {
        state: String(head.state),
        async append(kind, payload) {
          const receipt = engine.issue(kind, payload);
          if (!engine.verify().valid) throw new Error("RECEIPT_CHAIN_INVALID");
          await db.execute(
            "INSERT INTO stripe_receipts (connector_id, receipt_index, receipt_json) VALUES (?, ?, ?)",
            [connector, receipt.index, JSON.stringify(receipt)],
          );
          await db.execute(
            "UPDATE stripe_receipt_connectors SET chain_length = ?, head_hash = ? WHERE connector_id = ?",
            [receipt.index + 1, receipt.hash, connector],
          );
          return receipt;
        },
        async getEvent(eventId) {
          const [found] = await db.execute<any[]>(
            "SELECT record_json FROM stripe_recorded_events WHERE connector_id = ? AND event_id = ?",
            [connector, eventId],
          );
          if (!found.length) return null;
          const record = jsonParse<RecordedEvent>(found[0].record_json);
          const hash = recordHash(record);
          const proof = engine.chain.some((receipt) => {
            const payload = receipt.payload as Record<string, unknown>;
            if (payload.event_id !== eventId || payload.record_hash !== hash) return false;
            if (record.disposition === "recorded") return receipt.kind === "stripe.execution";
            // held / refused / ignored bind via classification (or SAFE for hold triggers)
            return receipt.kind === "stripe.classification" || receipt.kind === "stripe.safe";
          });
          if (record.eventId !== eventId || !proof) throw new Error("EVENT_RECORD_EVIDENCE_MISMATCH");
          return record;
        },
        async putEvent(record) {
          await db.execute(
            "INSERT INTO stripe_recorded_events (connector_id, event_id, record_json) VALUES (?, ?, ?)",
            [connector, record.eventId, JSON.stringify(record)],
          );
        },
        async getStopEvents(stopId) {
          return engine.chain.filter((receipt) =>
            receipt.kind === "ops.stop" &&
            (receipt.payload as { stop_id?: unknown })?.stop_id === stopId,
          ).map((receipt) => structuredClone(receipt.payload));
        },
      };
      const result = await run(tx);
      await db.commit();
      return result;
    } catch (error) {
      try {
        await db.rollback();
      } catch {
        /* Commit outcome may be unknown: retry reads durable state. */
      }
      throw error;
    } finally {
      db.release();
    }
  }

  async close(): Promise<void> {
    await this.pool?.end();
  }
}

export function newDeliveryId(): string {
  return randomUUID();
}
