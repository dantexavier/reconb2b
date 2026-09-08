const { query } = require('./db');

async function addDocument({ vehicleId, dealerId, type, refId, title }, client) {
  const runner = client || { query };
  await runner.query(
    `INSERT INTO documents (vehicle_id, dealer_id, type, ref_id, title) VALUES ($1, $2, $3, $4, $5)`,
    [vehicleId, dealerId, type, refId, title || null]
  );
}

module.exports = { addDocument };
