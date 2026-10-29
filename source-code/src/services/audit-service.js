const db = require('../config/database');

async function record({ userId, action, entityType = null, entityId = null, details = {}, ip = null }) {
  try {
    await db.query(
      `INSERT INTO audit_logs(user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
      [userId || null, action, entityType, entityId, JSON.stringify(details), ip || null]
    );
  } catch (error) {
    console.error('[audit] unable to record event:', error.message);
  }
}
module.exports = { record };
