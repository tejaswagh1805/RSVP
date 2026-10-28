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
function splitSqlStatements(source) {
  const statements = [];
  let current = '';
  let quote = null;
  let lineComment = false;
  let blockComment = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    if (lineComment) {
      current += char;
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      current += char;
      if (char === '*' && next === '/') { current += next; i += 1; blockComment = false; }
      continue;
    }
    if (quote) {
      current += char;
      if (char === quote) {
        if (next === quote) { current += next; i += 1; }
        else quote = null;
      } else if (char === '\\' && next) { current += next; i += 1; }
      continue;
    }
    if (char === '-' && next === '-') { current += char + next; i += 1; lineComment = true; continue; }
    if (char === '/' && next === '*') { current += char + next; i += 1; blockComment = true; continue; }
    if (char === "'" || char === '"') { quote = char; current += char; continue; }
    if (char === ';') {
      if (current.trim()) statements.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (quote) throw new Error('Unterminated quoted string or identifier in SQL file.');
  if (blockComment) throw new Error('Unterminated block comment in SQL file.');
  if (current.trim()) statements.push(current.trim());
  return statements;
}

const schema = await readFile(path.join(root, 'server/schema.sql'), 'utf8');
async function runQuery(query) {
  try {
    return await query();
  } catch (error) {
    const getCause = (candidate) => candidate?.sourceError?.cause || candidate?.cause;
    const isTransient = (candidate) => {
      const cause = getCause(candidate);
      return ['UND_ERR_CONNECT_TIMEOUT', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'].includes(cause?.code)
        || /fetch failed/i.test(candidate?.message || '');
    };
    const transient = isTransient(error);
    if (transient) {
      console.warn(`Neon connection failed${getCause(error)?.code ? ` (${getCause(error).code})` : ''}; retrying once in 2 seconds...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      try { return await query(); }
      catch (retryError) {
        if (isTransient(retryError)) {
          const code = getCause(retryError)?.code;
          const reason = code === 'UND_ERR_CONNECT_TIMEOUT' || code === 'ETIMEDOUT'
            ? 'Connection timed out. Check outbound HTTPS/proxy access to the Neon host and confirm that the Neon project is active.'
            : code === 'ENOTFOUND'
              ? 'The Neon hostname could not be resolved. Check DATABASE_URL and DNS.'
              : 'The connection to Neon was interrupted. Check the network/proxy and retry.';
          throw new Error(`${reason} No schema setup completed.`, { cause: retryError });
        }
        throw retryError;
      }
    }
    throw error;
  }
}
try {
  for (const statement of splitSqlStatements(schema)) {
    await runQuery(() => sql.query(statement));
  }
  const seed = await readFile(path.join(root, 'server/seed.sql'), 'utf8');
  for (const statement of splitSqlStatements(seed)) {
    await runQuery(() => sql.query(statement));
  }
  const pastEvents = await readFile(path.join(root, 'server/past-event-listings.sql'), 'utf8');
  for (const statement of splitSqlStatements(pastEvents)) {
    await runQuery(() => sql.query(statement));
  }
  const passwordHash = await hashPassword(admin.password);
  await runQuery(() => sql`INSERT INTO admin_users (id, name, email, password_hash, role, active) VALUES (${admin.id}, ${admin.name}, ${admin.email}, ${passwordHash}, ${admin.role}, TRUE) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, active = TRUE, updated_at = NOW()`);
  console.log('Neon schema, prototype records, and the admin account are ready.');
} catch (error) {
  const cause = error?.cause;
  if (cause) {
    console.error(error.message);
  } else {
    const code = error?.sourceError?.code || error?.sourceError?.cause?.code || error?.code;
    console.error(`Database setup failed${code ? ` (${code})` : ''}: ${error?.message || 'Unknown Neon error'}`);
  }
  process.exitCode = 1;
}
