// PostgreSQL port for fight-pack-brief-intake. The caller supplies a trusted
// parameterized sql(query, params) operation returning rows; this module does
// not choose or configure a production database.
function row(value) {
  if (!value) return null;
  return {
    orderRef: value.order_ref, correlationId: value.correlation_id,
    receiptRef: value.receipt_ref, status: value.status,
    tokenHash: value.token_hash, expiresAt: value.expires_at,
    brief: value.brief, briefHash: value.brief_hash,
    createdAt: value.created_at, receivedAt: value.received_at,
  };
}

export function createFightPackBriefStore({ sql }) {
  if (typeof sql !== 'function') throw new TypeError('A parameterized database operation is required.');
  const one = async (query, params) => row((await sql(query, params))[0]);
  const getRequest = (orderRef) => one(
    'SELECT * FROM fight_pack_brief_requests WHERE order_ref = $1', [orderRef]);
  return {
    async enqueue(request) {
      const inserted = await one(`INSERT INTO fight_pack_brief_requests
        (order_ref, correlation_id, receipt_ref, status, token_hash, created_at)
        VALUES ($1, $2::uuid, $3, 'HELD_TRANSPORT', NULL, $4::timestamptz)
        ON CONFLICT (order_ref) DO NOTHING RETURNING *`,
      [request.orderRef, request.correlationId, request.receiptRef, request.createdAt]);
      return { row: inserted ?? await getRequest(request.orderRef), inserted: Boolean(inserted) };
    },
    getRequest,
    claim(orderRef, { tokenHash, expiresAt }) {
      return one(`UPDATE fight_pack_brief_requests
        SET status = 'DISPATCHING', token_hash = $2, expires_at = $3::timestamptz
        WHERE order_ref = $1 AND status = 'HELD_TRANSPORT' RETURNING *`,
      [orderRef, tokenHash, expiresAt]);
    },
    async markDispatched(orderRef) {
      const updated = await one(`UPDATE fight_pack_brief_requests
        SET status = 'AWAITING_BRIEF'
        WHERE order_ref = $1 AND status = 'DISPATCHING' RETURNING *`, [orderRef]);
      if (!updated) throw new Error('BRIEF_STORE_TRANSITION');
      return updated;
    },
    async holdUncertain(orderRef) {
      const updated = await one(`UPDATE fight_pack_brief_requests
        SET status = 'DELIVERY_UNCERTAIN'
        WHERE order_ref = $1 AND status = 'DISPATCHING' RETURNING *`, [orderRef]);
      if (!updated) throw new Error('BRIEF_STORE_TRANSITION');
      return updated;
    },
    getActiveToken(tokenHash, at) {
      return one(`SELECT * FROM fight_pack_brief_requests
        WHERE token_hash = $1 AND status = 'AWAITING_BRIEF'
          AND expires_at > $2::timestamptz`, [tokenHash, at]);
    },
    consume(tokenHash, brief, briefHash, at) {
      return one(`UPDATE fight_pack_brief_requests
        SET status = 'BRIEF_RECEIVED', token_hash = NULL,
            brief = $2::jsonb, brief_hash = $3, received_at = $4::timestamptz
        WHERE token_hash = $1 AND status = 'AWAITING_BRIEF'
          AND expires_at > $4::timestamptz RETURNING *`,
      [tokenHash, JSON.stringify(brief), briefHash, at]);
    },
  };
}
