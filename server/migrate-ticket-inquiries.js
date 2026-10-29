import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { readFile } from 'node:fs/promises';

const databaseUrl = String(process.env.DATABASE_URL || '').trim();
if (!databaseUrl || /USER:PASSWORD|@HOST\/DBNAME/i.test(databaseUrl)) {
  throw new Error('Set a valid DATABASE_URL in the admin project .env before running this migration.');
}

const sql = neon(databaseUrl);
const migrationUrl = new URL('./migrations/001_event_ticket_inquiries.sql', import.meta.url);
const migration = await readFile(migrationUrl, 'utf8');
for (const statement of migration.split(';').map((part) => part.trim()).filter(Boolean)) {
  await sql.query(statement);
}
console.info('Event ticket inquiry table is ready.');
