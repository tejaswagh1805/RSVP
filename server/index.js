import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { neon } from '@neondatabase/serverless';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { clearSessionCookie, createSessionToken, getSessionToken, hashPassword, hashSessionToken, setSessionCookie, verifyPassword } from './auth.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const databaseUrl = String(process.env.DATABASE_URL || '').trim();
const sql = databaseUrl && !/USER:PASSWORD|@HOST\/DBNAME/i.test(databaseUrl) ? neon(databaseUrl) : null;
if (databaseUrl && !sql) console.warn('DATABASE_URL still contains the example placeholder; API is using demo data. Update the project-root .env to use Neon.');
const now = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const sessionLifetime = 7 * 24 * 60 * 60 * 1000;
const demoSessions = new Map();
const dashboardTrack = { influencer: 'Creators', creator: 'Creators', media: 'Media', tastemaker: 'Tastemakers', brand: 'Private Circle' };
const normalizeTrack = (track) => dashboardTrack[String(track || '').trim().toLowerCase()] || String(track || 'Creators').trim();
const text = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const demoAdmins = sql ? [] : await Promise.all([
  { id: 'admin-1', name: process.env.ADMIN_1_NAME || 'Tejas Nair', email: (process.env.ADMIN_1_EMAIL || 'tejas@rsvpdxb.local').toLowerCase(), password: process.env.ADMIN_1_PASSWORD || 'demo1234', role: 'Owner' },
  { id: 'admin-2', name: process.env.ADMIN_2_NAME || 'RSVP DXB Admin', email: (process.env.ADMIN_2_EMAIL || 'admin@rsvpdxb.local').toLowerCase(), password: process.env.ADMIN_2_PASSWORD || 'demo1234', role: 'Admin' },
].map(async (admin) => ({ ...admin, passwordHash: await hashPassword(admin.password) })));

app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json({ limit: '1mb' }));

async function currentAdmin(req) {
  const token = getSessionToken(req);
  if (!token) return null;
  const tokenHash = hashSessionToken(token);
  if (!sql) {
    const session = demoSessions.get(tokenHash);
    if (!session || session.expiresAt <= Date.now()) { demoSessions.delete(tokenHash); return null; }
    const { password, passwordHash, ...admin } = demoAdmins.find((item) => item.id === session.adminId) || {};
    return admin.id ? admin : null;
  }
  const rows = await sql`SELECT a.id, a.name, a.email, a.role FROM admin_sessions s JOIN admin_users a ON a.id = s.admin_id WHERE s.token_hash = ${tokenHash} AND s.expires_at > NOW() AND a.active = TRUE LIMIT 1`;
  return rows[0] || null;
}

const demo = {
  applications: [
    { id: 'app-1', name: 'Layla Haddad', email: 'layla@thegulfedit.com', track: 'Media', city: 'Dubai', detail: 'Senior editor, The Gulf Edit — food & travel', followers: '—', submitted: '2026-09-29', status: 'pending' },
    { id: 'app-2', name: 'Omar Rashid', email: 'omar.creates@gmail.com', track: 'Creators', city: 'Dubai', detail: 'Lifestyle & fashion, IG + TikTok', followers: '128k', submitted: '2026-09-29', status: 'pending' },
    { id: 'app-3', name: 'Chef Marco Vitale', email: 'marco@casavitale.ae', track: 'Tastemakers', city: 'Dubai', detail: 'Executive chef, Casa Vitale', followers: '22k', submitted: '2026-09-28', status: 'pending' },
    { id: 'app-4', name: 'A. Al Suwaidi', email: 'office@alsuwaidi-group.ae', track: 'Private Circle', city: 'Abu Dhabi', detail: 'Referred by member #0142 — assistant contact on file', followers: 'Private', submitted: '2026-09-27', status: 'pending' },
    { id: 'app-5', name: 'Sofia Mendes', email: 'sofia@luxereport.co', track: 'Creators', city: 'Dubai', detail: 'Beauty creator — YouTube + IG', followers: '41k', submitted: '2026-09-26', status: 'pending' },
  ],
  members: [
    { id: 'm1', name: 'Tejas Nair', track: 'Creators', rank: 'Gold', points: 640, events: 18, city: 'Dubai' },
    { id: 'm2', name: 'Hala Zayed', track: 'Media', rank: 'Diamond', points: 1180, events: 31, city: 'Dubai' },
    { id: 'm3', name: 'Rami Fawaz', track: 'Tastemakers', rank: 'Silver', points: 310, events: 9, city: 'Sharjah' },
    { id: 'm4', name: 'Private #0142', track: 'Private Circle', rank: 'Bronze', points: 0, events: 6, city: 'Dubai' },
    { id: 'm5', name: 'Nadia Khan', track: 'Creators', rank: 'Platinum', points: 2740, events: 58, city: 'Dubai' },
    { id: 'm6', name: 'Jon Abela', track: 'Media', rank: 'Silver', points: 220, events: 7, city: 'Dubai' },
  ],
  events: [
    { id: 'atlantis-chef-table', title: "Chef's Table at Ossiano", brand: 'Atlantis The Royal', date: '2026-10-03', time: '19:30', venue: 'Ossiano, Atlantis The Royal', area: 'Palm Jumeirah', category: 'Dining', tracks: ['Media', 'Tastemakers'], capacity: 24, confirmed: 21, status: 'published' },
    { id: 'jumeirah-spring-launch', title: 'Spring Collection Launch', brand: 'Maison Dalia', date: '2026-10-04', time: '20:00', venue: 'Alserkal Avenue, Warehouse 42', area: 'Al Quoz', category: 'Fashion', tracks: ['Creators', 'Media'], capacity: 120, confirmed: 120, status: 'published' },
    { id: 'dubai-hills-preview', title: 'Private Residence Preview', brand: 'Vantage Developments', date: '2026-10-08', time: '18:00', venue: 'Dubai Hills Estate', area: 'Dubai Hills', category: 'Property', tracks: ['Private Circle'], capacity: 16, confirmed: 9, status: 'published' },
    { id: 'marina-sunset-session', title: 'Sunset Listening Session', brand: 'Nuvo Audio', date: '2026-10-11', time: '17:30', venue: 'Bluewaters Terrace', area: 'Bluewaters', category: 'Music', tracks: ['Creators', 'Tastemakers'], capacity: 80, confirmed: 54, status: 'published' },
    { id: 'difc-art-night', title: 'Collectors Night', brand: 'Gallery Seventeen', date: '2026-10-16', time: '19:00', venue: 'DIFC Gate Village 9', area: 'DIFC', category: 'Art', tracks: ['Private Circle', 'Tastemakers'], capacity: 40, confirmed: 28, status: 'published' },
    { id: 'beach-club-opening', title: 'Season Opening Brunch', brand: 'Sirene Beach Club', date: '2026-10-18', time: '13:00', venue: 'Jumeirah Beach Road', area: 'Jumeirah', category: 'Nightlife', tracks: ['Creators', 'Media', 'Tastemakers'], capacity: 200, confirmed: 142, status: 'pending' },
  ],
  wall: [
    { id: 'w1', brand: 'Sirene Beach Club', type: 'Places Just Opened', body: 'Six places just opened for Season Opening Brunch this Saturday. First come, first served.', posted: '2h ago', boosted: true, status: 'live', eventId: 'beach-club-opening' },
    { id: 'w2', brand: 'Maison Dalia', type: 'New Event', body: 'Spring Collection Launch — Alserkal Avenue, 4 October. Creators and fashion press only.', posted: '5h ago', boosted: false, status: 'live', eventId: 'jumeirah-spring-launch' },
    { id: 'w3', brand: 'Nuvo Audio', type: 'Member Offer', body: '20% member discount on the terrace menu all October. Show your digital pass.', posted: 'Yesterday', boosted: false, status: 'live' },
    { id: 'w4', brand: 'Atlantis The Royal', type: 'Recap', body: "Thank you to everyone who joined last week's Chef's Table. 41 pieces of content collected.", posted: '2 days ago', boosted: false, status: 'live' },
    { id: 'w5', brand: 'Gallery Seventeen', type: 'Sponsored', body: 'Collectors Night at DIFC — a curator-led evening with the artists present.', posted: 'Pending review', boosted: false, status: 'pending', eventId: 'difc-art-night' },
  ],
  clients: [
    { id: 'b1', name: 'Atlantis The Royal', package: 'Signature', credits: 42, events: 11, status: 'active' },
    { id: 'b2', name: 'Maison Dalia', package: 'Launch', credits: 8, events: 3, status: 'active' },
    { id: 'b3', name: 'Sirene Beach Club', package: 'Season', credits: 26, events: 7, status: 'active' },
    { id: 'b4', name: 'Vantage Developments', package: 'Private', credits: 15, events: 2, status: 'trial' },
    { id: 'b5', name: 'Nuvo Audio', package: 'Launch', credits: 4, events: 1, status: 'active' },
  ],
  guests: [
    { id: 'g1', name: 'Tejas Nair', track: 'Creators', eventId: 'marina-sunset-session', plusOnes: 1, code: 'RSVP-4471' },
    { id: 'g2', name: 'Hala Zayed', track: 'Media', eventId: 'marina-sunset-session', plusOnes: 0, code: 'RSVP-2208' },
    { id: 'g3', name: 'Rami Fawaz', track: 'Tastemakers', eventId: 'marina-sunset-session', plusOnes: 1, code: 'RSVP-9014' },
    { id: 'g4', name: 'Nadia Khan', track: 'Creators', eventId: 'marina-sunset-session', plusOnes: 2, code: 'RSVP-7731' },
    { id: 'g5', name: 'Jon Abela', track: 'Media', eventId: 'marina-sunset-session', plusOnes: 0, code: 'RSVP-5520' },
  ],
};

const tableFor = { applications: 'applications', members: 'members', events: 'events', wall: 'wall_posts', clients: 'clients', guests: 'guests' };
const selectFor = {
  applications: 'SELECT id, name, email, track, city, detail, followers, profile_url AS "profileUrl", handle, platform, mobile, outlet, application_role AS role, all_profiles AS "allProfiles", source_track AS "sourceTrack", submitted::text AS submitted, status FROM applications ORDER BY submitted DESC',
  members: 'SELECT id, name, email, track, source_track AS "sourceTrack", rank, points, events, city, profile_url AS "profileUrl", handle, platform, followers, mobile, outlet, member_role AS role, all_profiles AS "allProfiles", status, joined::text AS joined FROM members ORDER BY name',
  events: 'SELECT id, title, brand, venue, date::text AS date, time, area, category, tracks, capacity, confirmed, status FROM events ORDER BY date',
  wall_posts: 'SELECT id, brand, type, body, posted, boosted, status, event_id AS "eventId" FROM wall_posts ORDER BY created_at DESC',
  clients: 'SELECT id, name, package, credits, events, status FROM clients ORDER BY name',
  guests: 'SELECT id, name, track, event_id AS "eventId", plus_ones AS "plusOnes", code, checked_in_at AS "checkedInAt", status FROM guests ORDER BY name',
};
const getRows = async (table) => {
  if (sql) return sql.query(selectFor[table]);
  const rows = structuredClone(demo[table]);
  return ['applications', 'members'].includes(table) ? rows.map(({ passwordHash: _passwordHash, ...row }) => row) : rows;
};

app.get('/api/health', (_req, res) => res.json({ ok: true, database: Boolean(sql) }));
app.get('/api/auth/me', async (req, res, next) => {
  try { res.json({ admin: await currentAdmin(req), demoMode: !sql }); } catch (error) { next(error); }
});
app.post('/api/auth/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const admin = sql
      ? (await sql`SELECT id, name, email, password_hash, role FROM admin_users WHERE lower(email) = ${email} AND active = TRUE LIMIT 1`)[0]
      : demoAdmins.find((item) => item.email === email);
    const passwordHash = admin?.password_hash || admin?.passwordHash;
    if (!admin || !await verifyPassword(password, passwordHash)) return res.status(401).json({ error: 'Email or password is incorrect.' });
    const token = createSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + sessionLifetime);
    if (sql) {
      await sql`DELETE FROM admin_sessions WHERE expires_at <= NOW()`;
      await sql`INSERT INTO admin_sessions (token_hash, admin_id, expires_at) VALUES (${tokenHash}, ${admin.id}, ${expiresAt.toISOString()})`;
    } else demoSessions.set(tokenHash, { adminId: admin.id, expiresAt: expiresAt.getTime() });
    setSessionCookie(res, token, Math.floor(sessionLifetime / 1000));
    const { password: _password, passwordHash: _passwordHash, password_hash: _databasePasswordHash, ...safeAdmin } = admin;
    res.json({ admin: safeAdmin, demoMode: !sql });
  } catch (error) { next(error); }
});
app.post('/api/auth/logout', async (req, res, next) => {
  try {
    const token = getSessionToken(req);
    if (token) {
      const tokenHash = hashSessionToken(token);
      if (sql) await sql`DELETE FROM admin_sessions WHERE token_hash = ${tokenHash}`;
      else demoSessions.delete(tokenHash);
    }
    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (error) { next(error); }
});
app.post('/api/register', async (req, res, next) => {
  try {
    const name = text(req.body.name, 160);
    const email = text(req.body.email, 254).toLowerCase();
    const password = String(req.body.password || '');
    const track = normalizeTrack(req.body.track);
    const city = text(req.body.city, 120) || 'Dubai';
    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter your name and a valid email address.' });
    if (password.length < 12) return res.status(400).json({ error: 'Password must be at least 12 characters.' });
    if (!['Media', 'Creators', 'Tastemakers', 'Private Circle'].includes(track)) return res.status(400).json({ error: 'Choose a valid member track.' });
    const profileUrl = text(req.body.profileUrl, 500);
    if (profileUrl) {
      try { if (!['http:', 'https:'].includes(new URL(profileUrl).protocol)) throw new Error('invalid protocol'); }
      catch { return res.status(400).json({ error: 'Profile URL must start with http:// or https://.' }); }
    }
    if (sql) {
      const existing = await sql`SELECT email FROM members WHERE lower(email) = ${email} UNION ALL SELECT email FROM applications WHERE lower(email) = ${email} LIMIT 1`;
      if (existing.length) return res.status(409).json({ error: 'An account or application already uses this email.' });
    } else if ([...demo.members, ...demo.applications].some((row) => row.email?.toLowerCase() === email)) {
      return res.status(409).json({ error: 'An account or application already uses this email.' });
    }
    const passwordHash = await hashPassword(password);
    const application = {
      id: `application-${crypto.randomUUID()}`, name, email, track, city,
      detail: text(req.body.role, 180), followers: String(Math.max(0, Number.parseInt(req.body.followers, 10) || 0)),
      profileUrl, handle: text(req.body.handle, 120), platform: text(req.body.platform, 80),
      mobile: text(req.body.mobile, 40), outlet: text(req.body.outlet, 160), role: text(req.body.role, 160),
      allProfiles: text(req.body.allProfiles, 2000), sourceTrack: track, submitted: new Date().toISOString().slice(0, 10), status: 'pending',
    };
    if (sql) {
      await sql`INSERT INTO applications (id, name, email, track, city, detail, followers, profile_url, handle, platform, mobile, outlet, application_role, all_profiles, source_track, password_hash, submitted, status) VALUES (${application.id}, ${name}, ${email}, ${track}, ${city}, ${application.detail}, ${application.followers}, ${application.profileUrl}, ${application.handle}, ${application.platform}, ${application.mobile}, ${application.outlet}, ${application.role}, ${application.allProfiles}, ${track}, ${passwordHash}, CURRENT_DATE, 'pending')`;
    } else {
      application.passwordHash = passwordHash;
      demo.applications.unshift(application);
    }
    res.status(201).json({ ok: true, status: 'pending', message: 'Your application was submitted for admin review.' });
  } catch (error) { next(error); }
});
app.use('/api', async (req, res, next) => {
  if (req.path === '/health' || req.path.startsWith('/auth/')) return next();
  try {
    const admin = await currentAdmin(req);
    if (!admin) return res.status(401).json({ error: 'Your admin session has ended. Sign in again.' });
    req.admin = admin;
    next();
  } catch (error) { next(error); }
});
app.get('/api/dashboard', async (_req, res, next) => {
  try {
    if (sql) {
      const [counts] = await sql`
        SELECT
          (SELECT COUNT(*)::int FROM applications WHERE status = 'pending') AS "pendingApplications",
          (SELECT COUNT(*)::int FROM members) AS members,
          (SELECT COALESCE(SUM(confirmed), 0)::int FROM events WHERE status = 'published') AS "weeklyRsvps",
          (SELECT COUNT(*)::int FROM guests WHERE checked_in_at IS NOT NULL) AS "checkedIn",
          (SELECT COUNT(*)::int FROM guests) AS expected,
          (SELECT COUNT(*)::int FROM events WHERE status = 'pending') AS "pendingEvents",
          (SELECT COUNT(*)::int FROM wall_posts WHERE status = 'pending') AS "pendingPosts",
          (SELECT COUNT(*)::int FROM clients WHERE credits < 10) AS "lowCreditClients"
      `;
      return res.json(counts);
    }
    const [applications, members, events, guests, clients, wall] = await Promise.all([
      getRows(tableFor.applications), getRows(tableFor.members), getRows(tableFor.events), getRows(tableFor.guests), getRows(tableFor.clients), getRows(tableFor.wall),
    ]);
    const live = events.filter((event) => event.status === 'published');
    res.json({ pendingApplications: applications.filter((item) => item.status === 'pending').length, members: members.length, weeklyRsvps: live.reduce((sum, event) => sum + Number(event.confirmed || 0), 0), checkedIn: guests.filter((guest) => guest.checkedInAt).length, expected: guests.length, pendingEvents: events.filter((event) => event.status === 'pending').length, pendingPosts: wall.filter((post) => post.status === 'pending').length, lowCreditClients: clients.filter((client) => client.credits < 10).length });
  } catch (error) { next(error); }
});
for (const [resource, table] of Object.entries(tableFor)) app.get(`/api/${resource === 'guests' ? 'door/guests' : resource}`, async (_req, res, next) => {
  try { res.json(await getRows(table)); } catch (error) { next(error); }
});

app.patch('/api/applications/:id', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Choose approved or rejected.' });
    if (!sql) {
      const item = demo.applications.find((row) => row.id === req.params.id);
      if (!item) return res.status(404).json({ error: 'Application not found.' });
      item.status = status;
      if (status === 'approved' && !demo.members.some((member) => member.email === item.email)) demo.members.unshift({ id: `m-${item.id}`, name: item.name, email: item.email, track: item.track, sourceTrack: item.sourceTrack || item.track, rank: 'Bronze', points: 10, events: 0, city: item.city, profileUrl: item.profileUrl || '', handle: item.handle || '', platform: item.platform || '', followers: Number(item.followers) || 0, mobile: item.mobile || '', outlet: item.outlet || '', role: item.role || '', allProfiles: item.allProfiles || '', status: 'approved', joined: item.submitted, passwordHash: item.passwordHash });
      const { passwordHash: _passwordHash, ...safeItem } = item;
      return res.json(safeItem);
    }
    const rows = await sql`UPDATE applications SET status = ${status}, updated_at = NOW() WHERE id = ${req.params.id} RETURNING id, name, email, track, city, detail, followers, profile_url, handle, platform, mobile, outlet, application_role, all_profiles, source_track, password_hash, submitted, status`;
    const item = rows[0];
    if (!item) return res.status(404).json({ error: 'Application not found.' });
    if (status === 'approved') await sql`INSERT INTO members (name, email, track, source_track, rank, points, events, city, profile_url, handle, platform, followers, mobile, outlet, member_role, all_profiles, status, joined, password_hash) VALUES (${item.name}, ${item.email}, ${item.track}, ${item.source_track || item.track}, 'Bronze', 10, 0, ${item.city}, ${item.profile_url || ''}, ${item.handle || ''}, ${item.platform || ''}, ${Number.parseInt(item.followers, 10) || 0}, ${item.mobile || ''}, ${item.outlet || ''}, ${item.application_role || ''}, ${item.all_profiles || ''}, 'approved', ${item.submitted}, ${item.password_hash}) ON CONFLICT (email) DO NOTHING`;
    const { password_hash: _passwordHash, ...safeItem } = item;
    res.json(safeItem);
  } catch (error) { next(error); }
});

app.post('/api/events', async (req, res, next) => {
  try {
    const { title, brand, venue = '', date, time = '', capacity = 80, category = 'Dining', tracks = [], status = 'draft' } = req.body;
    if (!title?.trim() || !brand?.trim() || !date) return res.status(400).json({ error: 'Event title, brand and date are required.' });
    const id = `event-${crypto.randomUUID()}`;
    const event = { id, title: title.trim(), brand: brand.trim(), venue, date, time, capacity: Number(capacity), confirmed: 0, category, tracks, status };
    if (!sql) demo.events.unshift(event);
    else await sql`INSERT INTO events (id, title, brand, venue, date, time, capacity, confirmed, category, tracks, status) VALUES (${id}, ${event.title}, ${event.brand}, ${event.venue}, ${event.date}, ${event.time}, ${event.capacity}, 0, ${category}, ${tracks}, ${status})`;
    res.status(201).json(event);
  } catch (error) { next(error); }
});

app.patch('/api/events/:id', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['published', 'closed', 'pending', 'draft'].includes(status)) return res.status(400).json({ error: 'Invalid event status.' });
    if (!sql) { const item = demo.events.find((row) => row.id === req.params.id); if (!item) return res.status(404).json({ error: 'Event not found.' }); item.status = status; return res.json(item); }
    const rows = await sql`UPDATE events SET status = ${status}, updated_at = NOW() WHERE id = ${req.params.id} RETURNING *`;
    if (!rows[0]) return res.status(404).json({ error: 'Event not found.' });
    res.json(rows[0]);
  } catch (error) { next(error); }
});

app.patch('/api/wall/:id', async (req, res, next) => {
  try {
    const { action } = req.body;
    if (!['approve', 'boost', 'remove'].includes(action)) return res.status(400).json({ error: 'Choose approve, boost or remove.' });
    if (!sql) {
      const index = demo.wall.findIndex((row) => row.id === req.params.id);
      if (index < 0) return res.status(404).json({ error: 'Post not found.' });
      if (action === 'remove') demo.wall.splice(index, 1);
      else if (action === 'approve') demo.wall[index] = { ...demo.wall[index], status: 'live', posted: 'Just now' };
      else demo.wall[index].boosted = !demo.wall[index].boosted;
      return res.json({ ok: true });
    }
    if (action === 'remove') await sql`DELETE FROM wall_posts WHERE id = ${req.params.id}`;
    if (action === 'approve') await sql`UPDATE wall_posts SET status = 'live', posted = 'Just now', updated_at = NOW() WHERE id = ${req.params.id}`;
    if (action === 'boost') await sql`UPDATE wall_posts SET boosted = NOT boosted, updated_at = NOW() WHERE id = ${req.params.id}`;
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.post('/api/clients/:id/credits', async (req, res, next) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isInteger(amount) || amount <= 0 || amount > 10000) return res.status(400).json({ error: 'Enter a valid credit amount.' });
    if (!sql) { const item = demo.clients.find((row) => row.id === req.params.id); if (!item) return res.status(404).json({ error: 'Client not found.' }); item.credits += amount; return res.json(item); }
    const rows = await sql`UPDATE clients SET credits = credits + ${amount}, updated_at = NOW() WHERE id = ${req.params.id} RETURNING *`;
    if (!rows[0]) return res.status(404).json({ error: 'Client not found.' });
    res.json(rows[0]);
  } catch (error) { next(error); }
});

app.post('/api/door/scan', async (req, res, next) => {
  try {
    const code = String(req.body.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ error: 'Enter an RSVP code.' });
    let guest;
    let justCheckedIn = false;
    if (!sql) guest = demo.guests.find((row) => row.code.toUpperCase() === code);
    else {
      const checkedInAt = now();
      const updated = await sql`UPDATE guests SET checked_in_at = ${checkedInAt} WHERE upper(code) = ${code} AND checked_in_at IS NULL RETURNING id, name, track, plus_ones AS "plusOnes", checked_in_at AS "checkedInAt"`;
      guest = updated[0];
      justCheckedIn = Boolean(guest);
      if (!guest) {
        const existing = await sql`SELECT id, name, track, plus_ones AS "plusOnes", checked_in_at AS "checkedInAt" FROM guests WHERE upper(code) = ${code} LIMIT 1`;
        guest = existing[0];
      }
    }
    if (!guest) return res.json({ tone: 'red', title: 'Not on list', detail: `No guest found for ${code}` });
    if (guest.checkedInAt && !justCheckedIn) return res.json({ tone: 'amber', title: 'Already scanned', detail: `${guest.name} checked in at ${guest.checkedInAt}` });
    if (!sql) guest.checkedInAt = now();
    res.json({ tone: 'green', title: `Welcome ${guest.name.split(' ')[0]}`, detail: `Entry for ${Number(guest.plusOnes) + 1} · ${guest.track} · +20 points` });
  } catch (error) { next(error); }
});

app.post('/api/door/walk-ins', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Guest name is required.' });
    const guest = { id: `walkin-${crypto.randomUUID()}`, name, track: 'Walk-in', eventId: req.body.eventId || null, plusOnes: Math.max(0, Number(req.body.plusOnes || 1) - 1), code: `WALK-${crypto.randomUUID().slice(0, 6).toUpperCase()}`, checkedInAt: null, status: 'pending_review' };
    if (!sql) demo.guests.unshift(guest);
    else await sql`INSERT INTO guests (id, name, track, event_id, plus_ones, code, status) VALUES (${guest.id}, ${name}, 'Walk-in', ${guest.eventId}, ${guest.plusOnes}, ${guest.code}, 'pending_review')`;
    res.status(201).json(guest);
  } catch (error) { next(error); }
});

app.get('/api/*path', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
app.use((error, _req, res, _next) => {
  console.error(error);
  const missingSchema = error.message?.includes('does not exist');
  res.status(500).json({ error: missingSchema ? 'Neon tables are not set up yet. Run npm run db:setup after adding DATABASE_URL.' : 'Something went wrong while loading this data.' });
});

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.env.NODE_ENV === 'production' && !sql) throw new Error('DATABASE_URL must be configured before starting the admin portal in production.');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(root, 'dist')));
  app.get('*path', (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
}

app.listen(port, '0.0.0.0', () => console.log(`RSVP DXB API listening on port ${port}${sql ? ' · Neon connected' : ' · demo data mode'}`));
