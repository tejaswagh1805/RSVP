import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { hashPassword } from './auth.js';

const databaseUrl = String(process.env.DATABASE_URL || '').trim();
if (!databaseUrl || /USER:PASSWORD|@HOST\/DBNAME/i.test(databaseUrl)) {
  console.error('A real DATABASE_URL is missing. Open the project-root .env, replace the example DATABASE_URL with the rotated Neon connection string, save the file, then run npm run db:setup again.');
  process.exit(1);
}

const admin = {
  id: 'admin-1',
  name: process.env.ADMIN_1_NAME?.trim(),
  email: process.env.ADMIN_1_EMAIL?.trim().toLowerCase(),
  password: process.env.ADMIN_1_PASSWORD,
  role: 'Owner',
};
if (!admin.name || !admin.email || !admin.password || admin.password.length < 12 || /replace-this|change-me|your-password/i.test(admin.password)) {
  console.error('Set ADMIN_1_NAME, ADMIN_1_EMAIL, and a private ADMIN_1_PASSWORD of at least 12 characters in .env. Replace the example values before running setup.');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sql = neon(databaseUrl);
const schema = await readFile(path.join(root, 'server/schema.sql'), 'utf8');
for (const statement of schema.split(';').map((value) => value.trim()).filter(Boolean)) {
  await sql.query(statement);
}
const seed = await readFile(path.join(root, 'server/seed.sql'), 'utf8');
for (const statement of seed.split(';').map((value) => value.trim()).filter(Boolean)) {
  await sql.query(statement);
}
const passwordHash = await hashPassword(admin.password);
await sql`INSERT INTO admin_users (id, name, email, password_hash, role, active) VALUES (${admin.id}, ${admin.name}, ${admin.email}, ${passwordHash}, ${admin.role}, TRUE) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, active = TRUE, updated_at = NOW()`;
console.log('Neon schema, prototype records, and the admin account are ready.');
