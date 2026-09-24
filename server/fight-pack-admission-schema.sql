-- Protected order store for the Josh-only full fight pack.
-- Schema is preparation only. No production migration or binding is performed
-- by importing this file. The application role must be SELECT on bindings and
-- INSERT/SELECT on admissions only; creating a binding or correction is a
-- separate authorised act with an external receipt.

CREATE TABLE IF NOT EXISTS fight_pack_payment_bindings (
  order_ref text PRIMARY KEY CHECK (order_ref ~ '^VF-[0-9]{4}-[0-9]{3,}$'),
  correlation_id uuid NOT NULL UNIQUE,
  product text NOT NULL CHECK (product = 'josh_full_fight_pack_v1'),
  account_id text NOT NULL,
  mode text NOT NULL CHECK (mode = 'live'),
  session_id text NOT NULL,
  payment_intent_id text NOT NULL,
  charge_id text NOT NULL,
  payment_link_id text NOT NULL,
  price_id text NOT NULL,
  product_id text NOT NULL,
  amount_minor integer NOT NULL CHECK (amount_minor = 1500),
  currency text NOT NULL CHECK (currency = 'gbp'),
  customer_email text NOT NULL,
  authority_receipt_ref text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, mode, session_id),
  UNIQUE (account_id, mode, payment_intent_id),
  UNIQUE (account_id, mode, charge_id)
);

-- An old Payment Link's stale metadata is not edited or silently overridden.
-- A separately signed, independently verified exact binding correction is
-- appended at most once. The service holds if it is absent or mismatched.
CREATE TABLE IF NOT EXISTS fight_pack_binding_corrections (
  order_ref text PRIMARY KEY REFERENCES fight_pack_payment_bindings(order_ref),
  correction_json jsonb NOT NULL,
  receipt_ref text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fight_pack_paid_admissions (
  order_ref text PRIMARY KEY REFERENCES fight_pack_payment_bindings(order_ref),
  account_id text NOT NULL,
  mode text NOT NULL CHECK (mode = 'live'),
  session_id text NOT NULL,
  payment_intent_id text NOT NULL,
  charge_id text NOT NULL,
  evidence jsonb NOT NULL,
  receipt_ref text NOT NULL UNIQUE,
  admitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, mode, session_id),
  UNIQUE (account_id, mode, payment_intent_id),
  UNIQUE (account_id, mode, charge_id)
);

CREATE OR REPLACE FUNCTION fight_pack_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'fight-pack receipt rows are append-only';
END;
$$;

DROP TRIGGER IF EXISTS fight_pack_binding_immutable ON fight_pack_payment_bindings;
CREATE TRIGGER fight_pack_binding_immutable BEFORE UPDATE OR DELETE
ON fight_pack_payment_bindings FOR EACH ROW EXECUTE FUNCTION fight_pack_append_only();
DROP TRIGGER IF EXISTS fight_pack_correction_immutable ON fight_pack_binding_corrections;
CREATE TRIGGER fight_pack_correction_immutable BEFORE UPDATE OR DELETE
ON fight_pack_binding_corrections FOR EACH ROW EXECUTE FUNCTION fight_pack_append_only();
DROP TRIGGER IF EXISTS fight_pack_admission_immutable ON fight_pack_paid_admissions;
CREATE TRIGGER fight_pack_admission_immutable BEFORE UPDATE OR DELETE
ON fight_pack_paid_admissions FOR EACH ROW EXECUTE FUNCTION fight_pack_append_only();
