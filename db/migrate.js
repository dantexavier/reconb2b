/**
 * Runs db/schema.sql against DATABASE_URL. Avoids requiring the `psql`
 * CLI to be installed — uses the `pg` package already in dependencies.
 *
 * schema.sql has no IF NOT EXISTS / DROP guards, so re-running it against
 * a database that already has these tables would fail with "relation
 * already exists." Phase 1 is still under active schema iteration with
 * disposable seed data, so this drops and recreates the whole `public`
 * schema first — DESTRUCTIVE, wipes all existing data every time.
 *
 * Usage: DATABASE_URL=postgres://... node db/migrate.js
 */
const fs = require('fs');
const path = require('path');
const { getPool } = require('../api/_lib/db');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const pool = getPool();
  console.log('Dropping and recreating the public schema (all existing data will be lost)...');
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  console.log('Running schema.sql...');
  await pool.query(sql);
  console.log('Migration complete. Run npm run db:seed next to repopulate sample data.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
