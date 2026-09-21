-- STRIPE-RECEIPT-PATCH-001 non-prod migration (test DB only)
CREATE TABLE IF NOT EXISTS stripe_receipt_connectors (
  connector_id VARCHAR(191) NOT NULL PRIMARY KEY,
  state VARCHAR(64) NOT NULL,
  chain_length INT NOT NULL DEFAULT 0,
  head_hash VARCHAR(128) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS stripe_receipts (
  connector_id VARCHAR(191) NOT NULL,
  receipt_index INT NOT NULL,
  receipt_json JSON NOT NULL,
  PRIMARY KEY (connector_id, receipt_index),
  CONSTRAINT fk_stripe_receipts_connector
    FOREIGN KEY (connector_id) REFERENCES stripe_receipt_connectors(connector_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS stripe_recorded_events (
  connector_id VARCHAR(191) NOT NULL,
  event_id VARCHAR(191) NOT NULL,
  record_json JSON NOT NULL,
  PRIMARY KEY (connector_id, event_id),
  CONSTRAINT fk_stripe_events_connector
    FOREIGN KEY (connector_id) REFERENCES stripe_receipt_connectors(connector_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
