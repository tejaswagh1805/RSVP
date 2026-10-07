import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

const argumentsList = process.argv.slice(2);
const inputPath = argumentsList.find((argument) => !argument.startsWith('--'));
const dryRun = argumentsList.includes('--dry-run');
const databaseUrl = String(process.env.DATABASE_URL || '').trim();
if (!inputPath) throw new Error('Usage: npm run db:import-members -- "path/to/rsvp-applications.csv"');

function parseCsv(source) {
  const records = [];
  let row = [];
  let field = '';
  let quoted = false;
  const input = source.replace(/^\uFEFF/, '');
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field.length === 0) quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some((value) => value.trim() !== '')) records.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted field.');
  if (field.length || row.length) { row.push(field); if (row.some((value) => value.trim() !== '')) records.push(row); }
  const [headers, ...values] = records;
  if (!headers) throw new Error('CSV is empty.');
  return values.map((valuesRow, rowIndex) => {
    if (valuesRow.length !== headers.length) throw new Error(`CSV row ${rowIndex + 2} has ${valuesRow.length} fields; expected ${headers.length}.`);
    return Object.fromEntries(headers.map((header, index) => [header.trim(), valuesRow[index]]));
  });
}

const clean = (value) => String(value ?? '').trim();
const trackMap = { influencer: 'Creators', creator: 'Creators', media: 'Media', tastemaker: 'Tastemakers', brand: 'Private Circle' };
const toTrack = (value) => trackMap[clean(value).toLowerCase()] || clean(value);
const toCount = (value) => {
  const normalized = clean(value).toLowerCase().replaceAll(',', '');
  const suffix = normalized.endsWith('k') ? 1_000 : normalized.endsWith('m') ? 1_000_000 : 1;
  const number = Number.parseFloat(normalized.replace(/[km]$/, ''));
  return Number.isFinite(number) && number > 0 ? Math.min(Math.round(number * suffix), 2_147_483_647) : 0;
};
const toPhone = (value) => clean(value).replace(/^="([\s\S]*)"$/, '$1');
const toDate = (value, rowNumber) => {
  const date = clean(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`CSV row ${rowNumber} has an invalid Joined date.`);
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) throw new Error(`CSV row ${rowNumber} has an invalid Joined date.`);
  return date;
};

const requiredHeaders = ['Name', 'Track', 'Profile', 'Handle', 'Platform', 'Followers', 'Email', 'Mobile', 'City', 'Outlet', 'Role', 'All profiles', 'Tier', 'Points', 'Status', 'Joined'];
const source = await readFile(inputPath, 'utf8');
const parsed = parseCsv(source);
if (!parsed.length) throw new Error('CSV has a header but no member rows.');
const actualHeaders = Object.keys(parsed[0]);
const missingHeaders = requiredHeaders.filter((header) => !actualHeaders.includes(header));
if (missingHeaders.length) throw new Error(`CSV is missing expected columns: ${missingHeaders.join(', ')}.`);

const emails = new Set();
let invalidEmailCount = 0;
const members = parsed.map((row, index) => {
  const name = clean(row.Name);
  const email = clean(row.Email).toLowerCase();
  if (!name) throw new Error(`CSV row ${index + 2} is missing a name.`);
  if (!email) throw new Error(`CSV row ${index + 2} is missing an email address.`);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalidEmailCount += 1;
  if (emails.has(email)) throw new Error(`CSV contains duplicate email addresses (first duplicate at row ${index + 2}).`);
  emails.add(email);
  const sourceTrack = clean(row.Track);
  const track = toTrack(sourceTrack);
  if (!['Media', 'Creators', 'Tastemakers', 'Private Circle'].includes(track)) throw new Error(`CSV row ${index + 2} has an unsupported track: ${sourceTrack}.`);
  const rank = clean(row.Tier) ? clean(row.Tier).toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Bronze';
  const id = `legacy-${createHash('sha256').update(email).digest('hex').slice(0, 24)}`;
  return [
    id, name, email, track, sourceTrack, rank, toCount(row.Points), 0, clean(row.City) || 'Unspecified', clean(row.Profile),
    clean(row.Handle), clean(row.Platform), toCount(row.Followers), toPhone(row.Mobile), clean(row.Outlet), clean(row.Role),
    clean(row['All profiles']), clean(row.Status).toLowerCase() || 'approved', toDate(row.Joined, index + 2),
  ];
});

const tracks = Object.fromEntries([...new Set(members.map((member) => member[3]))].map((track) => [track, members.filter((member) => member[3] === track).length]));
if (dryRun) {
  console.log(`Validated ${members.length} member rows; no database writes made. Invalid email formatting: ${invalidEmailCount}. Track totals: ${Object.entries(tracks).map(([track, count]) => `${track} ${count}`).join(', ')}.`);
} else {
  if (!databaseUrl || /USER:PASSWORD|@HOST\/DBNAME/i.test(databaseUrl)) throw new Error('A real DATABASE_URL is missing. Add the rotated Neon connection string to .env.');
  const columns = ['id', 'name', 'email', 'track', 'source_track', 'rank', 'points', 'events', 'city', 'profile_url', 'handle', 'platform', 'followers', 'mobile', 'outlet', 'member_role', 'all_profiles', 'status', 'joined'];
  const mutableColumns = columns.filter((column) => !['id', 'email'].includes(column));
  const sql = neon(databaseUrl);
  const batchSize = 80;
  for (let offset = 0; offset < members.length; offset += batchSize) {
    const batch = members.slice(offset, offset + batchSize);
    const values = batch.flat();
    const tuples = batch.map((_, rowIndex) => `(${columns.map((_, columnIndex) => `$${rowIndex * columns.length + columnIndex + 1}`).join(', ')})`).join(', ');
    const updates = mutableColumns.map((column) => `${column} = EXCLUDED.${column}`).join(', ');
    await sql.query(`INSERT INTO members (${columns.join(', ')}) VALUES ${tuples} ON CONFLICT (email) DO UPDATE SET ${updates}`, values);
  }
  console.log(`Imported or updated ${members.length} members by email. Invalid email formatting kept as provided: ${invalidEmailCount}. Track totals: ${Object.entries(tracks).map(([track, count]) => `${track} ${count}`).join(', ')}.`);
}
