import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { readFile } from 'node:fs/promises';

const databaseUrl = String(process.env.DATABASE_URL || '').trim();
if (!databaseUrl || /USER:PASSWORD|@HOST\/DBNAME/i.test(databaseUrl)) {
  throw new Error('Set a valid DATABASE_URL in the admin project .env before running this migration.');
}

const sql = neon(databaseUrl);
for (const file of ['001_event_ticket_inquiries.sql', '002_creator_pass_requests.sql']) {
  const migrationUrl = new URL(`./migrations/${file}`, import.meta.url);
  const migration = await readFile(migrationUrl, 'utf8');
  for (const statement of migration.split(';').map((part) => part.trim()).filter(Boolean)) {
    await sql.query(statement);
  }
}
console.info('Event ticket and creator pass request tables are ready.');
