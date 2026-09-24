-- Apply only after fight-pack-admission-schema.sql in the same authorised
-- PostgreSQL database. This does not bind the Stage-4 MySQL receipt journal.
CREATE TABLE IF NOT EXISTS fight_pack_brief_requests (
  order_ref text PRIMARY KEY REFERENCES fight_pack_paid_admissions(order_ref) ON DELETE RESTRICT,
  correlation_id uuid NOT NULL,
  receipt_ref text NOT NULL CHECK (length(receipt_ref) > 0),
  status text NOT NULL CHECK (status IN
    ('HELD_TRANSPORT','DISPATCHING','AWAITING_BRIEF','DELIVERY_UNCERTAIN','BRIEF_RECEIVED')),
  token_hash text UNIQUE CHECK (token_hash IS NULL OR token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz,
  brief jsonb,
  brief_hash text CHECK (brief_hash IS NULL OR brief_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz,
  CHECK (
    (status = 'HELD_TRANSPORT' AND token_hash IS NULL AND expires_at IS NULL)
    OR (status IN ('DISPATCHING','AWAITING_BRIEF','DELIVERY_UNCERTAIN')
        AND token_hash IS NOT NULL AND expires_at IS NOT NULL)
    OR (status = 'BRIEF_RECEIVED' AND token_hash IS NULL AND expires_at IS NOT NULL
        AND brief IS NOT NULL AND brief_hash IS NOT NULL AND received_at IS NOT NULL)
  ),
  CHECK (status = 'BRIEF_RECEIVED' OR
    (brief IS NULL AND brief_hash IS NULL AND received_at IS NULL))
);

CREATE INDEX IF NOT EXISTS fight_pack_brief_requests_pending_idx
  ON fight_pack_brief_requests(status, created_at)
  WHERE status IN ('HELD_TRANSPORT','DISPATCHING','DELIVERY_UNCERTAIN');
