import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';
import { hashPassword } from './auth.js';

const databaseUrl = String(process.env.DATABASE_URL || '').trim();
const email = String(process.env.ADMIN_1_EMAIL || '').trim().toLowerCase();
if (!databaseUrl || /USER:PASSWORD|@HOST\/DBNAME/i.test(databaseUrl)) throw new Error('Set a real DATABASE_URL in .env before resetting an admin password.');
if (!email) throw new Error('ADMIN_1_EMAIL is missing from .env.');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');
const previousEnv = await readFile(envPath, 'utf8');
const password = randomBytes(24).toString('base64url');
const hasPasswordLine = /^ADMIN_1_PASSWORD=.*$/m.test(previousEnv);
const nextEnv = hasPasswordLine
  ? previousEnv.replace(/^ADMIN_1_PASSWORD=.*$/m, `ADMIN_1_PASSWORD=${password}`)
  : `${previousEnv}${previousEnv.endsWith('\n') ? '' : '\n'}ADMIN_1_PASSWORD=${password}\n`;

await writeFile(envPath, nextEnv, 'utf8');
try {
  const sql = neon(databaseUrl);
  const passwordHash = await hashPassword(password);
  const updated = await sql`UPDATE admin_users SET password_hash = ${passwordHash}, active = TRUE, updated_at = NOW() WHERE lower(email) = ${email} RETURNING id`;
  if (!updated.length) throw new Error('No admin user matches ADMIN_1_EMAIL in .env.');
} catch (error) {
  await writeFile(envPath, previousEnv, 'utf8');
  throw error;
}

console.log(`Password reset for ${email}. New password: ${password}`);
