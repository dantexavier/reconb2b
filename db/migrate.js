/**
 * Runs db/schema.sql against DATABASE_URL. Avoids requiring the `psql`
 * CLI to be installed — uses the `pg` package already in dependencies.
 *
 * Usage: DATABASE_URL=postgres://... node db/migrate.js
 */
const fs = require('fs');
const path = require('path');
const { getPool } = require('../api/_lib/db');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const pool = getPool();
  console.log('Running schema.sql...');
  await pool.query(sql);
  console.log('Migration complete.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
