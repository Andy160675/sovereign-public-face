CREATE TABLE IF NOT EXISTS promotion_fix_orders (
  id uuid PRIMARY KEY,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL CHECK (status IN ('READY_UNPAID','PAID')),
  input jsonb NOT NULL,
  result jsonb NOT NULL,
  result_hash text NOT NULL CHECK (result_hash ~ '^[0-9a-f]{64}$'),
  verification jsonb NOT NULL,
  usage jsonb NOT NULL,
  checkout_session_id text UNIQUE,
  stripe_mode text CHECK (stripe_mode IN ('live','test')),
  payment_kind text CHECK (payment_kind IN ('STRIPE','SYNTHETIC_TEST')),
  payment_receipt jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  CHECK (status <> 'PAID' OR (payment_kind IS NOT NULL AND payment_receipt IS NOT NULL AND paid_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS promotion_fix_rate_limits (
  key_hash text NOT NULL CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  window_start timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts BETWEEN 1 AND 10),
  PRIMARY KEY (key_hash, window_start)
);

CREATE INDEX IF NOT EXISTS promotion_fix_orders_created_idx ON promotion_fix_orders(created_at);
